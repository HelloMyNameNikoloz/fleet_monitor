const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get positions for replay
router.get('/:robotId', authenticate, async (req, res) => {
    try {
        const { robotId } = req.params;
        const { duration = 60, from, to } = req.query;

        let query;
        let params;

        if (from && to) {
            // Specific time range
            query = `
                SELECT lat, lon, battery, speed, heading, timestamp
                FROM robot_positions
                WHERE robot_id = $1 AND timestamp BETWEEN $2 AND $3
                ORDER BY timestamp ASC
            `;
            params = [robotId, from, to];
        } else {
            // Last N seconds
            query = `
                SELECT lat, lon, battery, speed, heading, timestamp
                FROM robot_positions
                WHERE robot_id = $1 AND timestamp > NOW() - INTERVAL '${parseInt(duration)} seconds'
                ORDER BY timestamp ASC
            `;
            params = [robotId];
        }

        const result = await db.query(query, params);
        res.json({ positions: result.rows });
    } catch (error) {
        console.error('Get replay error:', error);
        res.status(500).json({ error: 'Failed to get replay data' });
    }
});

// Get positions for all robots for replay
router.get('/', authenticate, async (req, res) => {
    try {
        const { duration = 60, from, to } = req.query;

        let query;
        let params = [];

        if (from && to) {
            query = `
                SELECT rp.robot_id, rp.lat, rp.lon, rp.battery, rp.speed, rp.heading, rp.timestamp,
                       r.name as robot_name
                FROM robot_positions rp
                JOIN robots r ON rp.robot_id = r.id
                WHERE rp.timestamp BETWEEN $1 AND $2
                ORDER BY rp.timestamp ASC
            `;
            params = [from, to];
        } else {
            query = `
                SELECT rp.robot_id, rp.lat, rp.lon, rp.battery, rp.speed, rp.heading, rp.timestamp,
                       r.name as robot_name
                FROM robot_positions rp
                JOIN robots r ON rp.robot_id = r.id
                WHERE rp.timestamp > NOW() - INTERVAL '${parseInt(duration)} seconds'
                ORDER BY rp.timestamp ASC
            `;
        }

        const result = await db.query(query, params);

        // Group by robot_id
        const grouped = result.rows.reduce((acc, row) => {
            if (!acc[row.robot_id]) {
                acc[row.robot_id] = {
                    robot_id: row.robot_id,
                    robot_name: row.robot_name,
                    positions: []
                };
            }
            acc[row.robot_id].positions.push({
                lat: row.lat,
                lon: row.lon,
                battery: row.battery,
                speed: row.speed,
                heading: row.heading,
                timestamp: row.timestamp
            });
            return acc;
        }, {});

        res.json({ replay: Object.values(grouped) });
    } catch (error) {
        console.error('Get all replay error:', error);
        res.status(500).json({ error: 'Failed to get replay data' });
    }
});

module.exports = router;
