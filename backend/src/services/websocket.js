const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

let wss = null;
const clients = new Map(); // userId -> Set of ws connections
const operatorFocus = new Map(); // userId -> robotId

function initialize(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        console.log('New WebSocket connection');

        let userId = null;
        let isAuthenticated = false;

        // Set up ping/pong for connection keep-alive
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                // Handle authentication
                if (message.type === 'auth') {
                    try {
                        const decoded = jwt.verify(message.token, JWT_SECRET);
                        userId = decoded.userId;
                        isAuthenticated = true;

                        // Add to clients map
                        if (!clients.has(userId)) {
                            clients.set(userId, new Set());
                        }
                        clients.get(userId).add(ws);
                        operatorFocus.set(userId, operatorFocus.get(userId) ?? null);

                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            userId,
                            serverTime: Date.now()
                        }));

                        // Send current online count
                        broadcastPresence();
                        broadcastOpsState();

                        console.log(`User ${userId} authenticated via WebSocket`);
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'auth_error',
                            error: 'Invalid token'
                        }));
                    }
                    return;
                }

                // Require authentication for other messages
                if (!isAuthenticated) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Not authenticated'
                    }));
                    return;
                }

                // Handle other message types
                switch (message.type) {
                    case 'ping':
                        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                        break;

                    case 'subscribe':
                        // Client wants to subscribe to specific robot updates
                        ws.subscribedRobots = message.robotIds || [];
                        break;

                    case 'focus':
                        operatorFocus.set(userId, message.robotId ?? null);
                        broadcastOpsState();
                        break;

                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            console.log('WebSocket disconnected');

            if (userId && clients.has(userId)) {
                clients.get(userId).delete(ws);
                if (clients.get(userId).size === 0) {
                    clients.delete(userId);
                    operatorFocus.delete(userId);
                }
                broadcastPresence();
                broadcastOpsState();
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    // Ping interval to detect dead connections
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Subscribe to Redis robot_updates channel
    setupRedisSubscription();

    console.log('WebSocket server initialized');
}

async function setupRedisSubscription() {
    try {
        await redis.subscribe('robot_updates', (message) => {
            broadcast(message);
        });

        await redis.subscribe('alerts', (message) => {
            broadcast({ type: 'alert', ...message });
        });

        await redis.subscribe('events', (message) => {
            const payload = message && message.type ? message : { type: 'event', event: message };
            broadcast(payload);
        });

        console.log('Subscribed to Redis channels');
    } catch (error) {
        console.error('Redis subscription error:', error);
    }
}

function broadcast(message) {
    if (!wss) return;

    const payload = message && typeof message === 'object'
        ? { serverTime: Date.now(), ...message }
        : message;
    const data = JSON.stringify(payload);

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(data);
        }
    });
}

function broadcastPresence() {
    const onlineCount = clients.size;
    broadcast({
        type: 'presence',
        operatorsOnline: onlineCount
    });
}

function getOnlineCount() {
    return clients.size;
}

function getOpsState() {
    const focusCounts = {};
    operatorFocus.forEach((robotId) => {
        if (robotId === null || robotId === undefined || robotId === '') return;
        const key = String(robotId);
        focusCounts[key] = (focusCounts[key] || 0) + 1;
    });

    return {
        operatorsOnline: clients.size,
        focusCounts
    };
}

function broadcastOpsState() {
    broadcast({
        type: 'ops_state',
        ...getOpsState()
    });
}

function sendToUser(userId, message) {
    if (clients.has(userId)) {
        const payload = message && typeof message === 'object'
            ? { serverTime: Date.now(), ...message }
            : message;
        const data = JSON.stringify(payload);
        clients.get(userId).forEach((ws) => {
            if (ws.readyState === 1) {
                ws.send(data);
            }
        });
    }
}

module.exports = {
    initialize,
    broadcast,
    broadcastPresence,
    getOnlineCount,
    getOpsState,
    broadcastOpsState,
    sendToUser
};
