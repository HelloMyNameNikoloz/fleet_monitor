const db = require('../config/db');
const redis = require('../config/redis');
const geofence = require('./geofence');
const dispatch = require('./dispatch');
const patrol = require('./patrol');

let simulationInterval = null;
let isRunning = false;
let offlineInterval = null;

const ROBOTS_CACHE_KEY = 'robots:all';
const EVENTS_CHANNEL = 'events';

// Configuration
const config = {
    intervalMs: parseInt(process.env.SIMULATION_INTERVAL_MS, 10) || 2000,
    moveRadius: parseFloat(process.env.SIMULATION_MOVE_RADIUS) || 0.001,
    batteryDrainRate: 0.1,
    offlineChance: 0.02,
    idleChance: 0.15,
    offlineAfterMs: parseInt(process.env.OFFLINE_AFTER_MS, 10) || 10000,
    offlineCheckMs: parseInt(process.env.OFFLINE_CHECK_MS, 10) || 5000
};

async function publishEvent(event, robotName) {
    try {
        await redis.publish(EVENTS_CHANNEL, {
            type: 'event',
            event: {
                ...event,
                robot_name: robotName
            }
        });
    } catch (error) {
        console.error('Event publish error:', error);
    }
}

async function createEvent({ robotId, robotName, type, severity, message, data }) {
    const result = await db.query(
        `INSERT INTO events (robot_id, type, severity, message, data) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [robotId, type, severity, message, data ? JSON.stringify(data) : null]
    );

    const event = result.rows[0];
    await publishEvent(event, robotName);
    return event;
}

async function checkOfflineRobots() {
    if (!config.offlineAfterMs || config.offlineAfterMs <= 0) {
        return;
    }

    try {
        const result = await db.query(
            `
            WITH stale AS (
                SELECT id, name, status
                FROM robots
                WHERE status != 'offline'
                  AND last_seen < NOW() - ($1 * INTERVAL '1 millisecond')
            )
            UPDATE robots r
            SET status = 'offline'
            FROM stale
            WHERE r.id = stale.id
            RETURNING r.*, stale.status AS previous_status
            `,
            [config.offlineAfterMs]
        );

        if (result.rows.length === 0) {
            return;
        }

        for (const row of result.rows) {
            await createEvent({
                robotId: row.id,
                robotName: row.name,
                type: 'status_change',
                severity: 'error',
                message: `Robot status changed from ${row.previous_status} to offline (no updates)`,
                data: { from: row.previous_status, to: 'offline', reason: 'timeout' }
            });

            await redis.publish('robot_updates', {
                type: 'robot_update',
                robot: row
            });
        }

        await redis.cacheDelete(ROBOTS_CACHE_KEY);
    } catch (error) {
        console.error('Offline check error:', error);
    }
}

async function simulateRobotMovement() {
    try {
        // Get all robots that aren't offline
        const result = await db.query(
            `SELECT r.id, r.name, r.lat, r.lon, r.status, r.battery
             FROM robots r
             WHERE r.status != 'offline'
               AND (r.patrol_path IS NULL OR jsonb_array_length(r.patrol_path) = 0)
               AND NOT EXISTS (
                   SELECT 1 FROM robot_patrol_routes pr
                   WHERE pr.robot_id = r.id AND pr.is_active = true
               )`
        );

        for (const robot of result.rows) {
            if (dispatch.isActive(robot.id)) {
                continue;
            }
            // Random chance to go idle or offline
            let newStatus = robot.status;
            let newSpeed = 0;

            if (robot.battery <= 5) {
                newStatus = 'offline';
            } else if (Math.random() < config.offlineChance && robot.battery < 20) {
                newStatus = 'offline';
            } else if (Math.random() < config.idleChance) {
                newStatus = 'idle';
            } else {
                newStatus = 'moving';
                newSpeed = Math.random() * 5 + 0.5;
            }

            // Calculate new position if moving
            let newLat = robot.lat;
            let newLon = robot.lon;

            if (newStatus === 'moving') {
                newLat = robot.lat + (Math.random() - 0.5) * config.moveRadius * 2;
                newLon = robot.lon + (Math.random() - 0.5) * config.moveRadius * 2;
            }

            // Calculate battery drain
            const batteryDrain = newStatus === 'moving' ? config.batteryDrainRate : 0;
            const newBattery = Math.round(Math.max(0, robot.battery - batteryDrain));

            // Update robot in database
            const updateResult = await db.query(
                `UPDATE robots 
                 SET lat = $1, lon = $2, status = $3, speed = $4, battery = $5, last_seen = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [newLat, newLon, newStatus, newSpeed, newBattery, robot.id]
            );

            const updatedRobot = updateResult.rows[0];

            // Store position history if moving
            if (newStatus === 'moving') {
                await db.query(
                    `INSERT INTO robot_positions (robot_id, lat, lon, battery, speed) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [robot.id, newLat, newLon, Math.round(newBattery), newSpeed]
                );
            }

            // Create events for status changes
            if (robot.status !== newStatus) {
                await createEvent({
                    robotId: robot.id,
                    robotName: robot.name,
                    type: 'status_change',
                    severity: newStatus === 'offline' ? 'error' : 'info',
                    message: `Robot status changed from ${robot.status} to ${newStatus}`,
                    data: { from: robot.status, to: newStatus }
                });
            }

            // Battery low warning
            if (robot.battery > 20 && newBattery <= 20) {
                await createEvent({
                    robotId: robot.id,
                    robotName: robot.name,
                    type: 'battery_low',
                    severity: 'warning',
                    message: `Robot battery is low: ${Math.round(newBattery)}%`,
                    data: { battery: newBattery }
                });
            }

            // Check geofence violations
            const violations = await geofence.checkRobotZones(
                updatedRobot.id,
                updatedRobot.lat,
                updatedRobot.lon
            );
            if (violations.length > 0) {
                await geofence.processViolations(updatedRobot.id, updatedRobot.name, violations);
            }

            // Publish update via Redis
            await redis.publish('robot_updates', {
                type: 'robot_update',
                robot: updatedRobot
            });
        }

        // Invalidate cache
        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        // Update patrol robots on the same tick
        await patrol.processPatrols();

    } catch (error) {
        console.error('Simulation error:', error);
    }
}



async function start() {
    if (isRunning) {
        console.log('Simulation already running');
        return;
    }

    console.log('Starting robot simulation...');

    // Reset all robots to idle/online so they participate in simulation immediately
    try {
        await db.query(`
            UPDATE robots 
            SET status = 'idle', last_seen = NOW() 
            WHERE status IN ('offline', 'idle', 'moving')
        `);
        console.log('Robots woken up for simulation');

        // Invalidate cache to reflect status changes
        await redis.cacheDelete(ROBOTS_CACHE_KEY);
    } catch (err) {
        console.error('Failed to wake robots:', err);
    }

    isRunning = true;
    simulationInterval = setInterval(simulateRobotMovement, config.intervalMs);
}

function stop() {
    if (!isRunning) {
        console.log('Simulation not running');
        return;
    }

    console.log('Stopping robot simulation...');
    clearInterval(simulationInterval);
    simulationInterval = null;
    isRunning = false;
}

function startOfflineMonitor() {
    if (offlineInterval) {
        return;
    }

    offlineInterval = setInterval(checkOfflineRobots, config.offlineCheckMs);
    checkOfflineRobots();
}

function stopOfflineMonitor() {
    if (!offlineInterval) {
        return;
    }

    clearInterval(offlineInterval);
    offlineInterval = null;
}

function getStatus() {
    return {
        running: isRunning,
        config
    };
}

function updateConfig(newConfig) {
    const normalized = { ...newConfig };
    if (normalized.intervalMs !== undefined) {
        normalized.intervalMs = parseInt(normalized.intervalMs, 10);
    }
    if (normalized.moveRadius !== undefined) {
        normalized.moveRadius = parseFloat(normalized.moveRadius);
    }

    Object.assign(config, normalized);

    // Restart if running to apply new interval
    if (isRunning && normalized.intervalMs) {
        stop();
        start();
    }

    if (normalized.offlineCheckMs && offlineInterval) {
        stopOfflineMonitor();
        startOfflineMonitor();
    }
}

module.exports = {
    start,
    stop,
    startOfflineMonitor,
    stopOfflineMonitor,
    getStatus,
    updateConfig
};
