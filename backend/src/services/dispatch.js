const db = require('../config/db');
const redis = require('../config/redis');

const EVENTS_CHANNEL = 'events';
const ROBOT_UPDATES_CHANNEL = 'robot_updates';
const activeDispatches = new Set();

function isActive(robotId) {
    return activeDispatches.has(Number(robotId));
}

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
        console.error('Dispatch event publish error:', error);
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

function buildSteps(start, target, steps = 6) {
    const path = [];
    for (let i = 1; i <= steps; i += 1) {
        const ratio = i / steps;
        path.push({
            lat: start.lat + (target.lat - start.lat) * ratio,
            lon: start.lon + (target.lon - start.lon) * ratio
        });
    }
    return path;
}

async function dispatchRobotTo({ robotId, target, operatorId, eventId, reason }) {
    const numericId = Number(robotId);
    if (!Number.isFinite(numericId)) {
        return { error: 'Invalid robot id' };
    }

    if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) {
        return { error: 'Invalid dispatch target' };
    }

    if (isActive(numericId)) {
        return { error: 'Robot is already dispatching' };
    }

    const robotResult = await db.query(
        'SELECT id, name, lat, lon, status, battery FROM robots WHERE id = $1',
        [numericId]
    );

    if (robotResult.rows.length === 0) {
        return { error: 'Robot not found' };
    }

    const robot = robotResult.rows[0];
    activeDispatches.add(numericId);

    const steps = buildSteps({ lat: robot.lat, lon: robot.lon }, target, 6);
    const moveDelayMs = 900;

    await createEvent({
        robotId: robot.id,
        robotName: robot.name,
        type: 'dispatch',
        severity: 'info',
        message: `Dispatching ${robot.name} to alarm location`,
        data: {
            event_id: eventId,
            target,
            operator_id: operatorId,
            reason
        }
    });

    let stepIndex = 0;

    const moveNext = async () => {
        if (stepIndex >= steps.length) {
            return finalizeDispatch();
        }

        const point = steps[stepIndex];
        stepIndex += 1;

        try {
            const updateResult = await db.query(
                `UPDATE robots
                 SET lat = $1, lon = $2, status = 'moving', speed = $3, last_seen = NOW()
                 WHERE id = $4
                 RETURNING *`,
                [point.lat, point.lon, 1.6, robot.id]
            );

            const updatedRobot = updateResult.rows[0];

            await db.query(
                `INSERT INTO robot_positions (robot_id, lat, lon, battery, speed)
                 VALUES ($1, $2, $3, $4, $5)`,
                [robot.id, point.lat, point.lon, updatedRobot.battery, updatedRobot.speed]
            );

            await redis.publish(ROBOT_UPDATES_CHANNEL, {
                type: 'robot_update',
                robot: updatedRobot
            });
        } catch (error) {
            console.error('Dispatch step error:', error);
            activeDispatches.delete(numericId);
            return;
        }

        setTimeout(moveNext, moveDelayMs);
    };

    const finalizeDispatch = async () => {
        try {
            const finalResult = await db.query(
                `UPDATE robots
                 SET status = 'idle', speed = 0, last_seen = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [robot.id]
            );

            const finalRobot = finalResult.rows[0];

            await redis.publish(ROBOT_UPDATES_CHANNEL, {
                type: 'robot_update',
                robot: finalRobot
            });

            await createEvent({
                robotId: robot.id,
                robotName: robot.name,
                type: 'dispatch_complete',
                severity: 'info',
                message: `${robot.name} arrived at alarm location`,
                data: {
                    event_id: eventId,
                    target
                }
            });
        } catch (error) {
            console.error('Dispatch finalize error:', error);
        } finally {
            activeDispatches.delete(numericId);
        }
    };

    moveNext();

    return {
        robot,
        target,
        etaSeconds: Math.round((steps.length * moveDelayMs) / 1000)
    };
}

module.exports = {
    isActive,
    dispatchRobotTo
};
