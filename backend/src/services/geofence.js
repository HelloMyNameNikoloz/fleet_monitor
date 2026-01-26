const db = require('../config/db');
const redis = require('../config/redis');
const websocket = require('./websocket');

// Check if a point is inside a polygon
function pointInPolygon(point, polygon) {
    const [lat, lon] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [lat1, lon1] = polygon[i];
        const [lat2, lon2] = polygon[j];

        if (((lon1 > lon) !== (lon2 > lon)) &&
            (lat < (lat2 - lat1) * (lon - lon1) / (lon2 - lon1) + lat1)) {
            inside = !inside;
        }
    }

    return inside;
}

// Check if a point is inside a circle
function pointInCircle(point, center, radiusMeters) {
    const [lat, lon] = point;
    const [centerLat, centerLon] = center;

    // Haversine formula for distance
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat - centerLat) * Math.PI / 180;
    const dLon = (lon - centerLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(centerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
}

// Check if robot is in any zone
async function checkRobotZones(robotId, lat, lon) {
    try {
        const result = await db.query(
            'SELECT * FROM zones WHERE enabled = true'
        );

        const violations = [];

        for (const zone of result.rows) {
            const geometry = typeof zone.geometry === 'string'
                ? JSON.parse(zone.geometry)
                : zone.geometry;

            let isInZone = false;

            if (geometry.type === 'polygon') {
                isInZone = pointInPolygon([lat, lon], geometry.coordinates);
            } else if (geometry.type === 'circle') {
                isInZone = pointInCircle([lat, lon], geometry.center, geometry.radius);
            }

            if (isInZone) {
                violations.push({
                    zone,
                    robot_id: robotId,
                    type: zone.type,
                    lat,
                    lon
                });
            }
        }

        return violations;
    } catch (error) {
        console.error('Geofence check error:', error);
        return [];
    }
}

// Process zone violations
async function processViolations(robotId, robotName, violations) {
    for (const violation of violations) {
        // Only alert for restricted/warning zones
        if (violation.type === 'restricted' || violation.type === 'warning') {
            const severity = violation.type === 'restricted' ? 'error' : 'warning';

            // Create event
            const eventResult = await db.query(
                `INSERT INTO events (robot_id, type, severity, message, data) 
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [
                    robotId,
                    'zone_violation',
                    severity,
                    `${robotName} entered ${violation.zone.name}`,
                    JSON.stringify({
                        zone_id: violation.zone.id,
                        zone_name: violation.zone.name,
                        zone_type: violation.type,
                        lat: violation.lat,
                        lon: violation.lon
                    })
                ]
            );

            const event = eventResult.rows[0];
            await redis.publish('events', {
                type: 'event',
                event: {
                    ...event,
                    robot_name: robotName
                }
            });

            // Publish alert
            await redis.publish('alerts', {
                type: 'zone_violation',
                severity,
                robot_id: robotId,
                robot_name: robotName,
                zone: violation.zone.name,
                zone_type: violation.type,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = {
    checkRobotZones,
    processViolations,
    pointInPolygon,
    pointInCircle
};
