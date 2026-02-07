const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_PASSWORD_LENGTH = 72;
const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
}

// Register new user
router.post('/register', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ error: 'Password length invalid' });
        }
        if (name && name.length > 100) {
            return res.status(400).json({ error: 'Name too long' });
        }

        // Check if user exists
        const existing = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role',
            [email, passwordHash, name || email.split('@')[0]]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Find user
        const result = await db.query(
            'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user.id);

        res.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// Logout (client-side token removal, server just acknowledges)
router.post('/logout', authenticate, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
