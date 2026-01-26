const websocket = require('./websocket');

// Map of userId -> last active timestamp
const presenceMap = new Map();
const TIMEOUT_MS = 60000; // 1 minute timeout

function updatePresence(userId) {
    presenceMap.set(userId, Date.now());
}

function removePresence(userId) {
    presenceMap.delete(userId);
    websocket.broadcastPresence();
}

function getOnlineOperators() {
    const now = Date.now();
    const online = [];

    presenceMap.forEach((lastActive, odUserId) => {
        if (now - lastActive < TIMEOUT_MS) {
            online.push(odUserId);
        }
    });

    return online;
}

function getOnlineCount() {
    return getOnlineOperators().length;
}

// Cleanup stale entries periodically
setInterval(() => {
    const now = Date.now();
    let removed = false;

    presenceMap.forEach((lastActive, userId) => {
        if (now - lastActive >= TIMEOUT_MS) {
            presenceMap.delete(userId);
            removed = true;
        }
    });

    if (removed) {
        websocket.broadcastPresence();
    }
}, 30000);

module.exports = {
    updatePresence,
    removePresence,
    getOnlineOperators,
    getOnlineCount
};
