-- =============================================
-- Mini Fleet Monitor - Database Schema
-- =============================================
-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Zones table for geofencing (created BEFORE robots due to FK reference)
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'restricted',
    geometry JSONB NOT NULL,
    color VARCHAR(20) DEFAULT '#EF4444',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Robots table - main entity
CREATE TABLE IF NOT EXISTS robots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'idle',
    battery INTEGER DEFAULT 100 CHECK (
        battery >= 0
        AND battery <= 100
    ),
    lat DOUBLE PRECISION DEFAULT 52.52,
    lon DOUBLE PRECISION DEFAULT 13.405,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    assigned_zone_id INTEGER REFERENCES zones(id) ON DELETE
    SET NULL,
        patrol_path JSONB DEFAULT '[]',
        patrol_index INTEGER DEFAULT 0,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Patrol routes per robot (multiple routes, one active)
CREATE TABLE IF NOT EXISTS robot_patrol_routes (
    id SERIAL PRIMARY KEY,
    robot_id INTEGER REFERENCES robots(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    waypoints JSONB NOT NULL,
    direction VARCHAR(10) DEFAULT 'cw',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patrol_routes_robot ON robot_patrol_routes(robot_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patrol_routes_active_unique
ON robot_patrol_routes(robot_id) WHERE is_active = true;
-- Robot position history for replay
CREATE TABLE IF NOT EXISTS robot_positions (
    id SERIAL PRIMARY KEY,
    robot_id INTEGER REFERENCES robots(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    battery INTEGER,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_positions_robot_time ON robot_positions(robot_id, timestamp DESC);
-- Events table for timeline
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    robot_id INTEGER REFERENCES robots(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    message TEXT,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create index for time-based event queries
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_robot ON events(robot_id, created_at DESC);
-- Saved views / filter presets
CREATE TABLE IF NOT EXISTS saved_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    filters JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- User sessions for presence tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';
-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_robots_updated_at BEFORE
UPDATE ON robots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE
UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patrol_routes_updated_at BEFORE
UPDATE ON robot_patrol_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
