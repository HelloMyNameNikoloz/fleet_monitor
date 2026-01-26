const express = require('express');
const db = require('../config/db');
const redis = require('../config/redis');
const dispatch = require('../services/dispatch');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get events with pagination
router.get('/', authenticate, async (req, res) => {
    try {
        const {
            limit = 50,
            offset = 0,
            robot_id,
            type,
            severity,
            from,
            to
        } = req.query;

        let query = `
            SELECT e.*, r.name as robot_name
            FROM events e
            LEFT JOIN robots r ON e.robot_id = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (robot_id) {
            query += ` AND e.robot_id = $${paramCount++}`;
            params.push(robot_id);
        }

        if (type) {
            query += ` AND e.type = $${paramCount++}`;
            params.push(type);
        }

        if (severity) {
            query += ` AND e.severity = $${paramCount++}`;
            params.push(severity);
        }

        if (from) {
            query += ` AND e.created_at >= $${paramCount++}`;
            params.push(from);
        }

        if (to) {
            query += ` AND e.created_at <= $${paramCount++}`;
            params.push(to);
        }

        query += ` ORDER BY e.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        // Get total count
        const countResult = await db.query(
            'SELECT COUNT(*) FROM events' +
            (robot_id ? ' WHERE robot_id = $1' : ''),
            robot_id ? [robot_id] : []
        );

        res.json({
            events: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

// Export events as JSON
router.get('/export/json', authenticate, async (req, res) => {
    try {
        const { robot_id, from, to, limit = 1000 } = req.query;

        let query = `
            SELECT e.*, r.name as robot_name
            FROM events e
            LEFT JOIN robots r ON e.robot_id = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (robot_id) {
            query += ` AND e.robot_id = $${paramCount++}`;
            params.push(robot_id);
        }

        if (from) {
            query += ` AND e.created_at >= $${paramCount++}`;
            params.push(from);
        }

        if (to) {
            query += ` AND e.created_at <= $${paramCount++}`;
            params.push(to);
        }

        query += ` ORDER BY e.created_at DESC LIMIT $${paramCount++}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=events.json');
        res.json(result.rows);
    } catch (error) {
        console.error('Export JSON error:', error);
        res.status(500).json({ error: 'Failed to export events' });
    }
});

// Export events as CSV
router.get('/export/csv', authenticate, async (req, res) => {
    try {
        const { robot_id, from, to, limit = 1000 } = req.query;

        let query = `
            SELECT e.id, e.robot_id, r.name as robot_name, e.type, e.severity, e.message, e.created_at
            FROM events e
            LEFT JOIN robots r ON e.robot_id = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (robot_id) {
            query += ` AND e.robot_id = $${paramCount++}`;
            params.push(robot_id);
        }

        if (from) {
            query += ` AND e.created_at >= $${paramCount++}`;
            params.push(from);
        }

        if (to) {
            query += ` AND e.created_at <= $${paramCount++}`;
            params.push(to);
        }

        query += ` ORDER BY e.created_at DESC LIMIT $${paramCount++}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        // Convert to CSV
        const headers = ['id', 'robot_id', 'robot_name', 'type', 'severity', 'message', 'created_at'];
        const csv = [
            headers.join(','),
            ...result.rows.map(row =>
                headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=events.csv');
        res.send(csv);
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ error: 'Failed to export events' });
    }
});

// Create event (internal use)
router.post('/', authenticate, async (req, res) => {
    try {
        const { robot_id, type, severity = 'info', message, data } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'Event type required' });
        }

        const result = await db.query(
            `INSERT INTO events (robot_id, type, severity, message, data) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [robot_id, type, severity, message, data ? JSON.stringify(data) : null]
        );

        const event = result.rows[0];
        await redis.publish('events', { type: 'event', event });

        res.status(201).json({ event });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Create alarm event (manual trigger)
router.post('/alarm', authenticate, async (req, res) => {
    try {
        const { lat, lon, message, severity = 'critical' } = req.body;
        const parsedLat = Number(lat);
        const parsedLon = Number(lon);

        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
            return res.status(400).json({ error: 'Valid lat/lon required' });
        }

        const result = await db.query(
            `INSERT INTO events (type, severity, message, data)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                'alarm_triggered',
                severity,
                message || 'Alarm triggered',
                JSON.stringify({ lat: parsedLat, lon: parsedLon })
            ]
        );

        const event = result.rows[0];
        await redis.publish('events', { type: 'event', event });

        res.status(201).json({ event });
    } catch (error) {
        console.error('Create alarm error:', error);
        res.status(500).json({ error: 'Failed to create alarm' });
    }
});

// Dispatch closest robot to an alarm event
router.post('/:id/dispatch', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [id]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = eventResult.rows[0];
        let data = event.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (error) {
                data = null;
            }
        }
        const lat = Number(data?.lat);
        const lon = Number(data?.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ error: 'Event has no dispatchable location' });
        }

        const robotsResult = await db.query(
            `SELECT id, name, lat, lon, status
             FROM robots
             WHERE status != 'offline'`
        );

        if (robotsResult.rows.length === 0) {
            return res.status(404).json({ error: 'No available robots' });
        }

        let closest = null;
        let closestDistance = null;

        robotsResult.rows.forEach((robot) => {
            const dLat = robot.lat - lat;
            const dLon = robot.lon - lon;
            const distance = Math.sqrt(dLat * dLat + dLon * dLon);

            if (closestDistance === null || distance < closestDistance) {
                closestDistance = distance;
                closest = robot;
            }
        });

        if (!closest) {
            return res.status(404).json({ error: 'No available robots' });
        }

        const dispatchResult = await dispatch.dispatchRobotTo({
            robotId: closest.id,
            target: { lat, lon },
            operatorId: req.user?.id,
            eventId: event.id,
            reason: event.type
        });

        if (dispatchResult.error) {
            return res.status(409).json({ error: dispatchResult.error });
        }

        res.status(200).json({
            event,
            robot: closest,
            dispatch: dispatchResult
        });
    } catch (error) {
        console.error('Dispatch error:', error);
        res.status(500).json({ error: 'Failed to dispatch robot' });
    }
});

module.exports = router;
