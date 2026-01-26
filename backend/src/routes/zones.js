const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const ALLOW_SELF_INTERSECTION = process.env.ZONE_ALLOW_SELF_INTERSECTION === 'true';

// Get all zones
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM zones ORDER BY created_at DESC`
        );
        res.json({ zones: result.rows });
    } catch (error) {
        console.error('Get zones error:', error);
        res.status(500).json({ error: 'Failed to get zones' });
    }
});

// Get single zone
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'SELECT * FROM zones WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Zone not found' });
        }

        res.json({ zone: result.rows[0] });
    } catch (error) {
        console.error('Get zone error:', error);
        res.status(500).json({ error: 'Failed to get zone' });
    }
});

// Create zone
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, type = 'restricted', geometry, color = '#EF4444', enabled = true } = req.body;

        if (!name || !geometry) {
            return res.status(400).json({ error: 'Name and geometry required' });
        }

        const geometryValidation = validateGeometry(geometry);
        if (geometryValidation.error) {
            return res.status(400).json({ error: geometryValidation.error });
        }

        const result = await db.query(
            `INSERT INTO zones (name, type, geometry, color, enabled) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, type, JSON.stringify(geometryValidation.geometry), color, enabled]
        );

        res.status(201).json({ zone: result.rows[0] });
    } catch (error) {
        console.error('Create zone error:', error);
        res.status(500).json({ error: 'Failed to create zone' });
    }
});

// Update zone
router.patch('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, geometry, color, enabled } = req.body;

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (type !== undefined) {
            updates.push(`type = $${paramCount++}`);
            values.push(type);
        }
        if (geometry !== undefined) {
            const geometryValidation = validateGeometry(geometry);
            if (geometryValidation.error) {
                return res.status(400).json({ error: geometryValidation.error });
            }
            updates.push(`geometry = $${paramCount++}`);
            values.push(JSON.stringify(geometryValidation.geometry));
        }
        if (color !== undefined) {
            updates.push(`color = $${paramCount++}`);
            values.push(color);
        }
        if (enabled !== undefined) {
            updates.push(`enabled = $${paramCount++}`);
            values.push(enabled);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(id);
        const result = await db.query(
            `UPDATE zones SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Zone not found' });
        }

        res.json({ zone: result.rows[0] });
    } catch (error) {
        console.error('Update zone error:', error);
        res.status(500).json({ error: 'Failed to update zone' });
    }
});

// Delete zone
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM zones WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Zone not found' });
        }

        res.json({ message: 'Zone deleted', id: result.rows[0].id });
    } catch (error) {
        console.error('Delete zone error:', error);
        res.status(500).json({ error: 'Failed to delete zone' });
    }
});

module.exports = router;

function validateGeometry(input) {
    const geometry = parseGeometry(input);
    if (!geometry || typeof geometry !== 'object') {
        return { error: 'Invalid geometry payload.' };
    }

    if (geometry.type === 'polygon') {
        const normalized = normalizePolygon(geometry.coordinates);
        if (normalized.error) return { error: normalized.error };
        if (!ALLOW_SELF_INTERSECTION && isSelfIntersecting(normalized.coordinates)) {
            return { error: 'Polygon self-intersection is not allowed.' };
        }
        return { geometry: { type: 'polygon', coordinates: normalized.coordinates } };
    }

    if (geometry.type === 'circle') {
        const normalized = normalizeCircle(geometry.center, geometry.radius);
        if (normalized.error) return { error: normalized.error };
        return { geometry: { type: 'circle', center: normalized.center, radius: normalized.radius } };
    }

    return { error: 'Geometry type must be polygon or circle.' };
}

function parseGeometry(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        try {
            return JSON.parse(input);
        } catch (error) {
            return null;
        }
    }
    return input;
}

function normalizePolygon(coords) {
    if (!Array.isArray(coords)) {
        return { error: 'Polygon coordinates must be an array.' };
    }
    const normalized = coords
        .map((pair) => (Array.isArray(pair) ? pair.slice(0, 2) : null))
        .filter((pair) => Array.isArray(pair) && pair.length === 2);

    if (normalized.length < 3) {
        return { error: 'Polygon must have at least 3 points.' };
    }

    const last = normalized[normalized.length - 1];
    const first = normalized[0];
    if (first && last && first[0] === last[0] && first[1] === last[1]) {
        normalized.pop();
    }

    for (const point of normalized) {
        const [lat, lon] = point;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return { error: 'Polygon coordinates must be numbers.' };
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return { error: 'Polygon coordinates out of range.' };
        }
    }

    if (normalized.length < 3) {
        return { error: 'Polygon must have at least 3 points.' };
    }

    return { coordinates: normalized };
}

function normalizeCircle(center, radius) {
    if (!Array.isArray(center) || center.length < 2) {
        return { error: 'Circle center must be a [lat, lon] array.' };
    }
    const [lat, lon] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { error: 'Circle center must be numbers.' };
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { error: 'Circle center out of range.' };
    }
    if (!Number.isFinite(radius) || radius <= 0) {
        return { error: 'Circle radius must be a positive number.' };
    }
    return { center: [lat, lon], radius };
}

function isSelfIntersecting(coords) {
    const points = coords.map(([lat, lon]) => ({ x: lon, y: lat }));
    if (points.length < 4) return false;

    const segments = points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return { a: point, b: next };
    });

    for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
            if (Math.abs(i - j) <= 1) continue;
            if (i === 0 && j === segments.length - 1) continue;
            if (segmentsIntersect(segments[i].a, segments[i].b, segments[j].a, segments[j].b)) {
                return true;
            }
        }
    }

    return false;
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

function orientation(p, q, r) {
    const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
    return (
        q.x <= Math.max(p.x, r.x) + 1e-12 &&
        q.x >= Math.min(p.x, r.x) - 1e-12 &&
        q.y <= Math.max(p.y, r.y) + 1e-12 &&
        q.y >= Math.min(p.y, r.y) - 1e-12
    );
}
