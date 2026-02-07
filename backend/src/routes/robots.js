const express = require('express');
const db = require('../config/db');
const redis = require('../config/redis');
const { authenticate } = require('../middleware/auth');
const patrol = require('../services/patrol');
const geofence = require('../services/geofence');

const router = express.Router();

// Cache key for robots list
const ROBOTS_CACHE_KEY = 'robots:all';
const CACHE_TTL = 10; // seconds

function parseCoordinate(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function isValidLatLon(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Get all robots (cached)
router.get('/', authenticate, async (req, res) => {
    try {
        // Try cache first
        const cached = await redis.cacheGet(ROBOTS_CACHE_KEY);
        if (cached) {
            return res.json({ robots: cached, cached: true });
        }

        // Query database
        const result = await db.query(
            `SELECT r.id, r.name, r.status, r.battery, r.lat, r.lon, r.speed, r.heading,
                    r.assigned_zone_id, r.patrol_index, r.last_seen, r.created_at,
                    pr.id AS patrol_route_id, pr.name AS patrol_route_name,
                    pr.direction AS patrol_direction, COALESCE(pr.waypoints, r.patrol_path) AS patrol_path
             FROM robots r
             LEFT JOIN robot_patrol_routes pr
               ON pr.robot_id = r.id AND pr.is_active = true
             ORDER BY r.name`
        );

        const robots = result.rows;

        // Cache the result
        await redis.cacheSet(ROBOTS_CACHE_KEY, robots, CACHE_TTL);

        res.json({ robots, cached: false });
    } catch (error) {
        console.error('Get robots error:', error);
        res.status(500).json({ error: 'Failed to get robots' });
    }
});

// Get single robot
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT r.id, r.name, r.status, r.battery, r.lat, r.lon, r.speed, r.heading,
                    r.assigned_zone_id, r.patrol_index, r.last_seen, r.created_at,
                    pr.id AS patrol_route_id, pr.name AS patrol_route_name,
                    pr.direction AS patrol_direction, COALESCE(pr.waypoints, r.patrol_path) AS patrol_path
             FROM robots r
             LEFT JOIN robot_patrol_routes pr
               ON pr.robot_id = r.id AND pr.is_active = true
             WHERE r.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Robot not found' });
        }

        res.json({ robot: result.rows[0] });
    } catch (error) {
        console.error('Get robot error:', error);
        res.status(500).json({ error: 'Failed to get robot' });
    }
});

// Get robot trail (position history)
router.get('/:id/trail', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { duration = 60 } = req.query; // seconds

        const result = await db.query(
            `SELECT lat, lon, battery, speed, timestamp
             FROM robot_positions
             WHERE robot_id = $1 AND timestamp > NOW() - INTERVAL '${parseInt(duration)} seconds'
             ORDER BY timestamp ASC
             LIMIT 1000`,
            [id]
        );

        res.json({ trail: result.rows });
    } catch (error) {
        console.error('Get trail error:', error);
        res.status(500).json({ error: 'Failed to get trail' });
    }
});

// Get robot history (minutes)
router.get('/:id/history', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const minutes = Math.max(1, parseInt(req.query.minutes, 10) || 5);

        const result = await db.query(
            `SELECT lat, lon, battery, speed, heading, timestamp
             FROM robot_positions
             WHERE robot_id = $1
               AND timestamp > NOW() - ($2 * INTERVAL '1 minute')
             ORDER BY timestamp ASC
             LIMIT 5000`,
            [id, minutes]
        );

        res.json({ history: result.rows, minutes });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get robot history' });
    }
});

// Trigger random move for a robot
router.post('/:id/move', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Get current position
        const current = await db.query(
            'SELECT lat, lon FROM robots WHERE id = $1',
            [id]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Robot not found' });
        }

        const { lat, lon } = current.rows[0];
        const radius = 0.001; // ~100m

        // Random movement
        const newLat = lat + (Math.random() - 0.5) * radius * 2;
        const newLon = lon + (Math.random() - 0.5) * radius * 2;
        const speed = Math.random() * 5;

        // Check if this is the first move - if so, record the starting position first
        const positionCheck = await db.query(
            `SELECT COUNT(*) as count FROM robot_positions WHERE robot_id = $1`,
            [id]
        );

        if (parseInt(positionCheck.rows[0].count) === 0) {
            // Record starting position before the move
            await db.query(
                `INSERT INTO robot_positions (robot_id, lat, lon, speed, timestamp) VALUES ($1, $2, $3, 0, NOW() - INTERVAL '1 second')`,
                [id, lat, lon]
            );
        }

        // Update robot
        const result = await db.query(
            `UPDATE robots 
             SET lat = $1, lon = $2, speed = $3, status = 'moving', last_seen = NOW()
             WHERE id = $4
             RETURNING *`,
            [newLat, newLon, speed, id]
        );
        const updatedRobot = result.rows[0];

        // Store new position in history
        await db.query(
            `INSERT INTO robot_positions (robot_id, lat, lon, speed) VALUES ($1, $2, $3, $4)`,
            [id, newLat, newLon, speed]
        );

        const violations = await geofence.checkRobotZones(
            updatedRobot.id,
            updatedRobot.lat,
            updatedRobot.lon
        );
        if (violations.length > 0) {
            await geofence.processViolations(updatedRobot.id, updatedRobot.name, violations);
        }

        // Invalidate cache
        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        // Publish update via Redis
        await redis.publish('robot_updates', {
            type: 'robot_update',
            robot: updatedRobot
        });

        res.json({ robot: updatedRobot });
    } catch (error) {
        console.error('Move robot error:', error);
        res.status(500).json({ error: 'Failed to move robot' });
    }
});

// Create new robot
router.post('/', authenticate, async (req, res) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const lat = parseCoordinate(req.body?.lat, 52.52);
        const lon = parseCoordinate(req.body?.lon, 13.405);

        if (!name) {
            return res.status(400).json({ error: 'Robot name required' });
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Robot name too long' });
        }
        if (!isValidLatLon(lat, lon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const result = await db.query(
            `INSERT INTO robots (name, lat, lon) VALUES ($1, $2, $3) RETURNING *`,
            [name, lat, lon]
        );

        // Invalidate cache
        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        res.status(201).json({ robot: result.rows[0] });
    } catch (error) {
        console.error('Create robot error:', error);
        res.status(500).json({ error: 'Failed to create robot' });
    }
});

// Update robot
router.patch('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, battery } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        if (battery !== undefined) {
            updates.push(`battery = $${paramCount++}`);
            values.push(battery);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(id);
        const result = await db.query(
            `UPDATE robots SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Robot not found' });
        }

        // Invalidate cache
        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        res.json({ robot: result.rows[0] });
    } catch (error) {
        console.error('Update robot error:', error);
        res.status(500).json({ error: 'Failed to update robot' });
    }
});

// Delete robot
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM robots WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Robot not found' });
        }

        // Invalidate cache
        await redis.cacheDelete(ROBOTS_CACHE_KEY);

        res.json({ message: 'Robot deleted', id: result.rows[0].id });
    } catch (error) {
        console.error('Delete robot error:', error);
        res.status(500).json({ error: 'Failed to delete robot' });
    }
});

// Get patrol routes for a robot
router.get('/:id/routes', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const routes = await patrol.listRoutes(id);
        res.json({ routes });
    } catch (error) {
        console.error('List patrol routes error:', error);
        res.status(500).json({ error: 'Failed to list patrol routes' });
    }
});

// Create a patrol route for a robot
router.post('/:id/routes', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, waypoints, direction, isActive } = req.body;

        if (!waypoints || !Array.isArray(waypoints)) {
            return res.status(400).json({ error: 'Waypoints array required' });
        }

        const route = await patrol.createRoute(id, { name, waypoints, direction, isActive });
        res.status(201).json({ route });
    } catch (error) {
        console.error('Create patrol route error:', error);
        const status = error.message?.includes('waypoints') ? 400 : 500;
        res.status(status).json({ error: error.message || 'Failed to create patrol route' });
    }
});

// Update a patrol route
router.patch('/:id/routes/:routeId', authenticate, async (req, res) => {
    try {
        const { id, routeId } = req.params;
        const { name, waypoints, direction, isActive } = req.body;

        if (name === undefined && waypoints === undefined && direction === undefined && isActive === undefined) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const route = await patrol.updateRoute(id, routeId, { name, waypoints, direction, isActive });
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json({ route });
    } catch (error) {
        console.error('Update patrol route error:', error);
        const status = error.message?.includes('waypoints') ? 400 : 500;
        res.status(status).json({ error: error.message || 'Failed to update patrol route' });
    }
});

// Activate a patrol route
router.post('/:id/routes/:routeId/activate', authenticate, async (req, res) => {
    try {
        const { id, routeId } = req.params;
        const route = await patrol.activateRoute(id, routeId);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json({ route });
    } catch (error) {
        console.error('Activate patrol route error:', error);
        res.status(500).json({ error: 'Failed to activate patrol route' });
    }
});

// Delete a patrol route
router.delete('/:id/routes/:routeId', authenticate, async (req, res) => {
    try {
        const { id, routeId } = req.params;
        const route = await patrol.deleteRoute(id, routeId);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json({ route });
    } catch (error) {
        console.error('Delete patrol route error:', error);
        res.status(500).json({ error: 'Failed to delete patrol route' });
    }
});

// Set patrol path for a robot
router.post('/:id/patrol', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { waypoints, name, direction } = req.body;

        if (!waypoints || !Array.isArray(waypoints)) {
            return res.status(400).json({ error: 'Waypoints array required' });
        }

        const route = await patrol.createRoute(id, {
            name,
            waypoints,
            direction,
            isActive: true
        });
        res.json({ route });
    } catch (error) {
        console.error('Set patrol path error:', error);
        res.status(500).json({ error: error.message || 'Failed to set patrol path' });
    }
});

// Clear patrol path
router.delete('/:id/patrol', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        await patrol.deactivateAllRoutes(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear patrol path error:', error);
        res.status(500).json({ error: 'Failed to clear patrol path' });
    }
});

// Assign robot to zone
router.post('/:id/assign-zone', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { zoneId } = req.body;

        if (!zoneId) {
            return res.status(400).json({ error: 'Zone ID required' });
        }

        const robot = await patrol.assignToZone(id, zoneId);
        res.json({ robot });
    } catch (error) {
        console.error('Assign zone error:', error);
        res.status(500).json({ error: 'Failed to assign zone' });
    }
});

// Generate patrol path from zone boundary
router.post('/:id/generate-patrol', authenticate, async (req, res) => {
    try {
        const { zoneId, offsetMeters } = req.body;

        if (!zoneId) {
            return res.status(400).json({ error: 'Zone ID required' });
        }

        const waypoints = await patrol.generatePatrolFromZone(zoneId, offsetMeters);
        res.json({ waypoints });
    } catch (error) {
        console.error('Generate patrol error:', error);
        res.status(500).json({ error: 'Failed to generate patrol path' });
    }
});

module.exports = router;
