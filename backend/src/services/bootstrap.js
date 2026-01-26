const bcrypt = require('bcrypt');
const db = require('../config/db');

const DEFAULT_EMAIL = 'admin@test.com';
const DEFAULT_PASSWORD = 'test123';

async function ensureDemoUser() {
    const email = process.env.DEMO_USER_EMAIL || DEFAULT_EMAIL;
    const password = process.env.DEMO_USER_PASSWORD || DEFAULT_PASSWORD;

    const result = await db.query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
    );

    const passwordHash = await bcrypt.hash(password, 10);

    if (result.rows.length === 0) {
        await db.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4)`,
            [email, passwordHash, 'Admin', 'admin']
        );
        console.log(`Demo user created: ${email}`);
        return;
    }

    const user = result.rows[0];
    let isValid = false;
    try {
        isValid = await bcrypt.compare(password, user.password_hash || '');
    } catch (error) {
        isValid = false;
    }

    if (!isValid) {
        await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, user.id]
        );
        console.log(`Demo user password updated: ${email}`);
    }
}

async function ensurePatrolRoutesSchema() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS robot_patrol_routes (
            id SERIAL PRIMARY KEY,
            robot_id INTEGER REFERENCES robots(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            waypoints JSONB NOT NULL,
            direction VARCHAR(10) DEFAULT 'cw',
            is_active BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await db.query(
        `CREATE INDEX IF NOT EXISTS idx_patrol_routes_robot
         ON robot_patrol_routes(robot_id)`
    );

    await db.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_patrol_routes_active_unique
         ON robot_patrol_routes(robot_id) WHERE is_active = true`
    );

    await db.query(
        `DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_patrol_routes_updated_at'
            ) THEN
                CREATE TRIGGER update_patrol_routes_updated_at
                BEFORE UPDATE ON robot_patrol_routes
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$`
    );
}

module.exports = {
    ensureDemoUser,
    ensurePatrolRoutesSchema
};
