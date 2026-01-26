require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const robotsRoutes = require('./routes/robots');
const eventsRoutes = require('./routes/events');
const zonesRoutes = require('./routes/zones');
const replayRoutes = require('./routes/replay');

// Import services
const websocketService = require('./services/websocket');
const simulationService = require('./services/simulation');
const bootstrap = require('./services/bootstrap');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://frontend:5173'],
    credentials: true
}));
app.use(express.json());

// Request logging middleware (Flask-style)
app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log request
    console.log(`\n\x1b[36m──────────────────────────────────────────────\x1b[0m`);
    console.log(`\x1b[33m${req.method}\x1b[0m ${req.path} \x1b[90m@ ${timestamp}\x1b[0m`);

    if (Object.keys(req.query).length > 0) {
        console.log(`\x1b[90m  Query:\x1b[0m`, req.query);
    }
    if (req.body && Object.keys(req.body).length > 0) {
        // Don't log passwords
        const safeBody = { ...req.body };
        if (safeBody.password) safeBody.password = '***';
        console.log(`\x1b[90m  Body:\x1b[0m`, safeBody);
    }

    // Capture response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${statusColor}← ${res.statusCode}\x1b[0m \x1b[90m(${duration}ms)\x1b[0m`);

        // Log error responses
        if (res.statusCode >= 400 && body?.error) {
            console.log(`\x1b[31m  Error: ${body.error}\x1b[0m`);
        }

        return originalJson(body);
    };

    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/robots', robotsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/replay', replayRoutes);

// Simulation control endpoints
app.post('/api/simulation/start', (req, res) => {
    simulationService.start();
    res.json({ message: 'Simulation started', status: simulationService.getStatus() });
});

app.post('/api/simulation/stop', (req, res) => {
    simulationService.stop();
    res.json({ message: 'Simulation stopped', status: simulationService.getStatus() });
});

app.get('/api/simulation/status', (req, res) => {
    res.json(simulationService.getStatus());
});

app.patch('/api/simulation/config', (req, res) => {
    simulationService.updateConfig(req.body);
    res.json({ message: 'Config updated', status: simulationService.getStatus() });
});

// Presence endpoint
app.get('/api/presence', (req, res) => {
    const opsState = websocketService.getOpsState();
    res.json({
        operatorsOnline: opsState.operatorsOnline,
        focusCounts: opsState.focusCounts
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = http.createServer(app);



// Initialize WebSocket
websocketService.initialize(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('Mini Fleet Monitor API Server started');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);

    simulationService.startOfflineMonitor();

    const ensureDemoUserWithRetry = async (attempt = 1) => {
        try {
            await bootstrap.ensurePatrolRoutesSchema();
            await bootstrap.ensureDemoUser();
        } catch (error) {
            const maxAttempts = 5;
            if (attempt >= maxAttempts) {
                console.error('Failed to ensure demo user after retries:', error);
                return;
            }
            setTimeout(() => ensureDemoUserWithRetry(attempt + 1), 3000);
        }
    };

    ensureDemoUserWithRetry().then(() => {
        // Start simulation if enabled AND after DB is ready
        if (process.env.SIMULATION_ENABLED === 'true') {
            console.log('Auto-starting simulation (SIMULATION_ENABLED=true)...');
            simulationService.start();
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    simulationService.stop();
    simulationService.stopOfflineMonitor();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
