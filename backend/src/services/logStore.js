const MAX_LOGS = Math.max(50, parseInt(process.env.LOG_BUFFER_SIZE || '500', 10) || 500);
const logs = [];

function addLog(entry) {
    if (!entry) return;
    logs.push(entry);
    if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
    }
}

function listLogs(limit = 200) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, MAX_LOGS));
    return logs.slice(-safeLimit).reverse();
}

module.exports = {
    addLog,
    listLogs,
    MAX_LOGS
};
