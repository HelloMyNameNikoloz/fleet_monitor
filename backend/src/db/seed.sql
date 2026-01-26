-- =============================================
-- Mini Fleet Monitor - Seed Data
-- =============================================
-- Demo user (password: test123)
-- Hash generated with bcrypt cost factor 10
INSERT INTO users (email, password_hash, name, role)
VALUES (
        'admin@test.com',
        '$2b$10$mBNXEROQ2fNpsmppY6VRVehnxIC9gGWi0eLA8lBrqiLHMhqmnMsY6',
        'Admin',
        'admin'
    ) ON CONFLICT (email) DO NOTHING;
-- Insert demo robots (Leipzig-Engelsdorf area coordinates)
INSERT INTO robots (name, status, battery, lat, lon, speed)
VALUES (
        'Robot Alpha',
        'moving',
        85,
        51.3400,
        12.4550,
        2.5
    ),
    ('Robot Beta', 'idle', 92, 51.3390, 12.4530, 0),
    (
        'Robot Gamma',
        'moving',
        67,
        51.3410,
        12.4560,
        1.8
    ),
    (
        'Robot Delta',
        'offline',
        15,
        51.3380,
        12.4520,
        0
    ),
    (
        'Robot Epsilon',
        'moving',
        78,
        51.3420,
        12.4570,
        3.2
    ),
    ('Robot Zeta', 'idle', 100, 51.3395, 12.4545, 0),
    ('Robot Eta', 'moving', 54, 51.3405, 12.4555, 2.1),
    ('Robot Theta', 'idle', 88, 51.3385, 12.4535, 0) ON CONFLICT DO NOTHING;
-- Insert demo zones (Leipzig-Engelsdorf area)
INSERT INTO zones (name, type, geometry, color, enabled)
VALUES (
        'Restricted Area A',
        'restricted',
        '{"type": "polygon", "coordinates": [[51.341, 12.454], [51.341, 12.456], [51.339, 12.456], [51.339, 12.454]]}',
        '#EF4444',
        true
    ),
    (
        'Warning Zone B',
        'warning',
        '{"type": "circle", "center": [51.338, 12.452], "radius": 100}',
        '#F59E0B',
        true
    ),
    (
        'Safe Zone HQ',
        'safe',
        '{"type": "polygon", "coordinates": [[51.340, 12.455], [51.340, 12.456], [51.339, 12.456], [51.339, 12.455]]}',
        '#10B981',
        true
    ) ON CONFLICT DO NOTHING;
-- Insert some initial events
INSERT INTO events (robot_id, type, severity, message, data)
VALUES (
        1,
        'status_change',
        'info',
        'Robot Alpha started moving',
        '{"from": "idle", "to": "moving"}'
    ),
    (
        4,
        'battery_low',
        'warning',
        'Robot Delta battery critically low',
        '{"battery": 15}'
    ),
    (
        4,
        'status_change',
        'error',
        'Robot Delta went offline',
        '{"from": "idle", "to": "offline"}'
    ),
    (
        3,
        'zone_enter',
        'warning',
        'Robot Gamma entered Warning Zone B',
        '{"zone": "Warning Zone B"}'
    ) ON CONFLICT DO NOTHING;
