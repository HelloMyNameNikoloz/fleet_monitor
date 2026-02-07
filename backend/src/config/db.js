const { Pool } = require('pg');

const shouldUseSsl =
    process.env.DATABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool
};
