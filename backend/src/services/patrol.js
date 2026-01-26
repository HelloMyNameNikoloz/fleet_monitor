const db = require('../config/db');
const redis = require('../config/redis');
const dispatch = require('./dispatch');
const geofence = require('./geofence');

const ROBOTS_CACHE_KEY = 'robots:all';
const PATROL_MOVE_SPEED = 0.0002;
const PATROL_SPEED = 1.5;

/**
 * Patrol Service - Manages robot patrol routes and waypoint following
 */

function normalizeWaypoints(path) {
    if (!Array.isArray(path)) return [];
    const normalized = path
        .map((point) => {
            if (Array.isArray(point)) {
                return { lat: Number(point[0]), lon: Number(point[1]) };
            }
            if (point && typeof point === 'object') {
                return { lat: Number(point.lat), lon: Number(point.lon) };
            }
            return null;
        })
        .filter((point) =>
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon)
        );

    if (normalized.length > 1) {
        const first = normalized[0];
        const last = normalized[normalized.length - 1];
        if (first.lat === last.lat && first.lon === last.lon) {
            normalized.pop();
        }
    }

    return normalized;
}

function serializeWaypoints(waypoints) {
    if (!waypoints) return '[]';
    if (typeof waypoints === 'string') {
        return waypoints;
    }
    return JSON.stringify(waypoints);
}

function normalizeDirection(direction) {
    const raw = String(direction || '').toLowerCase();
    if (raw === 'ccw' || raw === 'counterclockwise' || raw === 'counter-clockwise') {
        return 'ccw';
    }
    return 'cw';
}

// Calculate distance between two points (in degrees, simplified)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    return Math.sqrt(dLat * dLat + dLon * dLon);
}

function projectPointToSegment(point, start, end) {
    const ax = start.lon;
    const ay = start.lat;
    const bx = end.lon;
    const by = end.lat;
    const px = point.lon;
    const py = point.lat;

    const abx = bx - ax;
    const aby = by - ay;
    const abLengthSq = abx * abx + aby * aby;
    if (abLengthSq === 0) {
        return { point: { lat: ay, lon: ax }, t: 0 };
    }

    const apx = px - ax;
    const apy = py - ay;
    const tRaw = (apx * abx + apy * aby) / abLengthSq;
    const t = Math.max(0, Math.min(1, tRaw));

    return {
        point: {
            lat: ay + aby * t,
            lon: ax + abx * t
        },
        t
    };
}

function findNearestPointOnPath(robot, patrolPath) {
    if (!patrolPath || patrolPath.length < 2) {
        return null;
    }

    const point = { lat: robot.lat, lon: robot.lon };
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestPoint = null;
    let segmentStartIndex = 0;
    let segmentEndIndex = 1;

    for (let i = 0; i < patrolPath.length; i++) {
        const start = patrolPath[i];
        const end = patrolPath[(i + 1) % patrolPath.length];
        const projection = projectPointToSegment(point, start, end);
        const distance = calculateDistance(point.lat, point.lon, projection.point.lat, projection.point.lon);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPoint = projection.point;
            segmentStartIndex = i;
            segmentEndIndex = (i + 1) % patrolPath.length;
        }
    }

    return {
        point: nearestPoint,
        distance: nearestDistance,
        segmentStartIndex,
        segmentEndIndex
    };
}

// Calculate bearing from point1 to point2
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return Math.atan2(y, x) * (180 / Math.PI);
}

// Move robot towards next waypoint
async function moveTowardsWaypoint(robot, waypoint, moveSpeed = PATROL_MOVE_SPEED) {
    const distance = calculateDistance(robot.lat, robot.lon, waypoint.lat, waypoint.lon);

    if (distance < moveSpeed * 2) {
        return { arrived: true, newLat: waypoint.lat, newLon: waypoint.lon };
    }

    const ratio = moveSpeed / distance;
    const newLat = robot.lat + (waypoint.lat - robot.lat) * ratio;
    const newLon = robot.lon + (waypoint.lon - robot.lon) * ratio;
    const heading = calculateBearing(robot.lat, robot.lon, waypoint.lat, waypoint.lon);

    return { arrived: false, newLat, newLon, heading };
}

function getMetersPerLon(lat) {
    return 111000 * Math.cos((lat * Math.PI) / 180);
}

function offsetPolygon(points, offsetMeters) {
    if (!offsetMeters) {
        return points;
    }
    const centroid = points.reduce(
        (acc, point) => ({
            lat: acc.lat + point.lat,
            lon: acc.lon + point.lon
        }),
        { lat: 0, lon: 0 }
    );
    centroid.lat /= points.length;
    centroid.lon /= points.length;

    const metersPerLat = 111000;
    const metersPerLon = getMetersPerLon(centroid.lat) || 1;

    return points.map((point) => {
        const x = (point.lon - centroid.lon) * metersPerLon;
        const y = (point.lat - centroid.lat) * metersPerLat;
        const length = Math.sqrt(x * x + y * y);
        if (!Number.isFinite(length) || length === 0) {
            return point;
        }
        const scale = (length + offsetMeters) / length;
        const newX = x * scale;
        const newY = y * scale;
        return {
            lat: centroid.lat + newY / metersPerLat,
            lon: centroid.lon + newX / metersPerLon
        };
    });
}

function buildCircleWaypoints(centerLat, centerLon, radiusMeters) {
    const points = [];
    const segments = 12;
    const metersPerLat = 111000;
    const metersPerLon = getMetersPerLon(centerLat) || 1;
    const radiusLat = radiusMeters / metersPerLat;
    const radiusLon = radiusMeters / metersPerLon;

    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
            lat: centerLat + radiusLat * Math.cos(angle),
            lon: centerLon + radiusLon * Math.sin(angle)
        });
    }

    return points;
}

async function processRobotPatrol(robot, route) {
    const patrolPath = normalizeWaypoints(route.waypoints || []);

    if (patrolPath.length < 2) {
        return null;
    }

    let currentIndex = Number.isInteger(robot.patrol_index) ? robot.patrol_index : 0;
    if (currentIndex < 0 || currentIndex >= patrolPath.length) {
        currentIndex = 0;
    }

    const targetWaypoint = patrolPath[currentIndex];
    const nearestPointData = findNearestPointOnPath(robot, patrolPath);

    let rejoinTarget = null;
    let rejoinNextIndex = currentIndex;
    const rejoinThreshold = PATROL_MOVE_SPEED * 1.2;

    if (nearestPointData?.point && nearestPointData.distance > rejoinThreshold) {
        rejoinTarget = nearestPointData.point;
        rejoinNextIndex = normalizeDirection(route.direction) === 'ccw'
            ? nearestPointData.segmentStartIndex
            : nearestPointData.segmentEndIndex;
    }

    const activeTarget = rejoinTarget || targetWaypoint;
    if (!activeTarget) {
        return null;
    }

    const result = await moveTowardsWaypoint(robot, activeTarget);
    let nextIndex = currentIndex;
    if (result.arrived) {
        if (rejoinTarget) {
            nextIndex = rejoinNextIndex;
        } else {
            const step = normalizeDirection(route.direction) === 'ccw' ? -1 : 1;
            nextIndex = (currentIndex + step + patrolPath.length) % patrolPath.length;
        }
    }

    const updateResult = await db.query(
        `UPDATE robots 
         SET lat = $1, lon = $2, heading = $3, patrol_index = $4, 
             status = 'moving', speed = $5, last_seen = NOW()
         WHERE id = $6
         RETURNING *`,
        [result.newLat, result.newLon, result.heading || robot.heading, nextIndex, PATROL_SPEED, robot.id]
    );

    return updateResult.rows[0];
}

async function processPatrols() {
    try {
        const result = await db.query(
            `SELECT r.id, r.name, r.lat, r.lon, r.status, r.battery, r.speed, r.heading,
                    r.patrol_index, r.patrol_path, pr.id AS route_id, pr.waypoints, pr.direction
             FROM robots r
             LEFT JOIN robot_patrol_routes pr
               ON pr.robot_id = r.id AND pr.is_active = true
             WHERE r.status != 'offline'
               AND r.battery > 5
               AND (pr.id IS NOT NULL OR (r.patrol_path IS NOT NULL AND jsonb_array_length(r.patrol_path) > 0))`
        );

        for (const row of result.rows) {
            if (dispatch.isActive(row.id)) {
                continue;
            }
            const route = row.route_id
                ? { waypoints: row.waypoints, direction: row.direction }
                : { waypoints: row.patrol_path, direction: 'cw' };
            const updated = await processRobotPatrol(row, route);

            if (updated) {
                await redis.publish('robot_updates', {
                    type: 'robot_update',
                    robot: updated
                });

                await db.query(
                    `INSERT INTO robot_positions (robot_id, lat, lon, battery, speed, heading) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [row.id, updated.lat, updated.lon, updated.battery, updated.speed, updated.heading]
                );

                const violations = await geofence.checkRobotZones(
                    updated.id,
                    updated.lat,
                    updated.lon
                );
                if (violations.length > 0) {
                    await geofence.processViolations(updated.id, updated.name, violations);
                }
            }
        }
    } catch (error) {
        console.error('Patrol processing error:', error);
    }
}

async function listRoutes(robotId) {
    const result = await db.query(
        `SELECT id, robot_id, name, waypoints, direction, is_active, created_at, updated_at
         FROM robot_patrol_routes
         WHERE robot_id = $1
         ORDER BY created_at DESC`,
        [robotId]
    );
    return result.rows;
}

async function createRoute(robotId, { name, waypoints, direction, isActive } = {}) {
    const normalized = normalizeWaypoints(waypoints);
    if (normalized.length < 2) {
        throw new Error('At least 2 valid waypoints required');
    }

    const routeName = (name || '').trim() || `Route ${new Date().toISOString()}`;
    const normalizedDirection = normalizeDirection(direction);
    const activeFlag = Boolean(isActive);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        if (activeFlag) {
            await client.query(
                'UPDATE robot_patrol_routes SET is_active = false WHERE robot_id = $1',
                [robotId]
            );
        }

        const result = await client.query(
            `INSERT INTO robot_patrol_routes (robot_id, name, waypoints, direction, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [robotId, routeName, JSON.stringify(normalized), normalizedDirection, activeFlag]
        );

        if (activeFlag) {
            await client.query(
                'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
                [robotId, JSON.stringify(normalized)]
            );
        }

        await client.query('COMMIT');

        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function updateRoute(robotId, routeId, updates = {}) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(String(updates.name).trim());
    }

    if (updates.direction !== undefined) {
        fields.push(`direction = $${paramCount++}`);
        values.push(normalizeDirection(updates.direction));
    }

    if (updates.waypoints !== undefined) {
        const normalized = normalizeWaypoints(updates.waypoints);
        if (normalized.length < 2) {
            throw new Error('At least 2 valid waypoints required');
        }
        fields.push(`waypoints = $${paramCount++}`);
        values.push(JSON.stringify(normalized));
    }

    if (updates.isActive !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(Boolean(updates.isActive));
    }

    if (fields.length === 0) {
        return null;
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        if (updates.isActive) {
            await client.query(
                'UPDATE robot_patrol_routes SET is_active = false WHERE robot_id = $1',
                [robotId]
            );
        }

        values.push(robotId, routeId);
        const result = await client.query(
            `UPDATE robot_patrol_routes
             SET ${fields.join(', ')}
             WHERE robot_id = $${paramCount++} AND id = $${paramCount}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const updatedRoute = result.rows[0];

        if (updates.isActive) {
            await client.query(
                'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
                [robotId, serializeWaypoints(updatedRoute?.waypoints)]
            );
        } else if (updatedRoute?.is_active && updates.waypoints !== undefined) {
            await client.query(
                'UPDATE robots SET patrol_path = $2 WHERE id = $1',
                [robotId, serializeWaypoints(updatedRoute?.waypoints)]
            );
        } else if (updates.isActive === false) {
            const activeResult = await client.query(
                `SELECT waypoints FROM robot_patrol_routes
                 WHERE robot_id = $1 AND is_active = true
                 LIMIT 1`,
                [robotId]
            );
            const activeWaypoints = serializeWaypoints(activeResult.rows[0]?.waypoints);
            await client.query(
                'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
                [robotId, activeWaypoints]
            );
        }

        await client.query('COMMIT');

        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        return updatedRoute;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function deleteRoute(robotId, routeId) {
    const result = await db.query(
        `DELETE FROM robot_patrol_routes
         WHERE robot_id = $1 AND id = $2
         RETURNING *`,
        [robotId, routeId]
    );

    if (result.rows[0]?.is_active) {
        await db.query(
            'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
            [robotId, '[]']
        );
    }

    await redis.cacheDelete(ROBOTS_CACHE_KEY);

    return result.rows[0];
}

async function activateRoute(robotId, routeId) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(
            'UPDATE robot_patrol_routes SET is_active = false WHERE robot_id = $1',
            [robotId]
        );

        const result = await client.query(
            `UPDATE robot_patrol_routes
             SET is_active = true
             WHERE robot_id = $1 AND id = $2
             RETURNING *`,
            [robotId, routeId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        const activeRoute = result.rows[0];
        await client.query(
            'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
            [robotId, serializeWaypoints(activeRoute?.waypoints)]
        );

        await client.query('COMMIT');

        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        return activeRoute;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function deactivateAllRoutes(robotId) {
    await db.query(
        'UPDATE robot_patrol_routes SET is_active = false WHERE robot_id = $1',
        [robotId]
    );
    await db.query(
        'UPDATE robots SET patrol_index = 0, patrol_path = $2 WHERE id = $1',
        [robotId, '[]']
    );
    await redis.cacheDelete(ROBOTS_CACHE_KEY);
}

async function assignToZone(robotId, zoneId) {
    const result = await db.query(
        `UPDATE robots 
         SET assigned_zone_id = $1
         WHERE id = $2
         RETURNING *`,
        [zoneId, robotId]
    );

    await redis.cacheDelete(ROBOTS_CACHE_KEY);

    return result.rows[0];
}

async function generatePatrolFromZone(zoneId, offsetMeters = 0) {
    const zoneResult = await db.query('SELECT * FROM zones WHERE id = $1', [zoneId]);

    if (zoneResult.rows.length === 0) {
        throw new Error('Zone not found');
    }

    const zone = zoneResult.rows[0];
    let geometry = zone.geometry;
    if (typeof geometry === 'string') {
        try {
            geometry = JSON.parse(geometry);
        } catch (error) {
            geometry = null;
        }
    }

    if (!geometry || typeof geometry !== 'object') {
        return [];
    }

    let waypoints = [];
    const safeOffset = Number.isFinite(Number(offsetMeters)) ? Number(offsetMeters) : 0;

    if (geometry.type === 'polygon' && geometry.coordinates) {
        const points = geometry.coordinates
            .map((point) => {
                if (Array.isArray(point)) {
                    return { lat: Number(point[0]), lon: Number(point[1]) };
                }
                if (point && typeof point === 'object') {
                    return { lat: Number(point.lat), lon: Number(point.lon) };
                }
                return null;
            })
            .filter((point) =>
                point &&
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lon)
            );

        const normalizedPoints = normalizeWaypoints(points);
        waypoints = offsetPolygon(normalizedPoints, safeOffset);
    } else if (geometry.type === 'circle' && geometry.center && geometry.radius) {
        let centerLat;
        let centerLon;
        if (Array.isArray(geometry.center)) {
            [centerLat, centerLon] = geometry.center;
        } else if (geometry.center && typeof geometry.center === 'object') {
            centerLat = geometry.center.lat;
            centerLon = geometry.center.lon;
        }
        const radiusMeters = Math.max(0, Number(geometry.radius) + safeOffset);

        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) {
            return [];
        }

        waypoints = buildCircleWaypoints(centerLat, centerLon, radiusMeters);
    }

    return waypoints;
}

module.exports = {
    processPatrols,
    processRobotPatrol,
    listRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    activateRoute,
    deactivateAllRoutes,
    assignToZone,
    generatePatrolFromZone
};
