const API_URL = import.meta.env.VITE_API_URL || '';

// Get stored token
function getToken() {
    return localStorage.getItem('fleet_token');
}

// Set token
function setToken(token) {
    localStorage.setItem('fleet_token', token);
}

// Remove token
function removeToken() {
    localStorage.removeItem('fleet_token');
}

// Base fetch with auth
async function fetchWithAuth(url, options = {}) {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
    });

    // Handle 401 - unauthorized
    if (response.status === 401) {
        removeToken();
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    return response;
}

// API Methods
export const api = {
    // Auth
    async login(email, password) {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setToken(data.token);
        return data;
    },

    async register(email, password, name) {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        setToken(data.token);
        return data;
    },

    async getMe() {
        const res = await fetchWithAuth('/api/auth/me');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    logout() {
        removeToken();
    },

    // Robots
    async getRobots() {
        const res = await fetchWithAuth('/api/robots');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.robots;
    },

    async getRobot(id) {
        const res = await fetchWithAuth(`/api/robots/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.robot;
    },

    async getRobotTrail(id, duration = 60) {
        const res = await fetchWithAuth(`/api/robots/${id}/trail?duration=${duration}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.trail;
    },

    async getRobotHistory(id, minutes = 5) {
        const res = await fetchWithAuth(`/api/robots/${id}/history?minutes=${minutes}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.history;
    },

    async moveRobot(id) {
        const res = await fetchWithAuth(`/api/robots/${id}/move`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.robot;
    },

    async createRobot(name, lat, lon) {
        const res = await fetchWithAuth('/api/robots', {
            method: 'POST',
            body: JSON.stringify({ name, lat, lon }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.robot;
    },

    // Events
    async getEvents(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetchWithAuth(`/api/events?${queryString}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async getLogs(limit = 200) {
        const res = await fetchWithAuth(`/api/logs?limit=${limit}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load logs');
        return data.logs || [];
    },

    async createAlarm(lat, lon, message) {
        const res = await fetchWithAuth('/api/events/alarm', {
            method: 'POST',
            body: JSON.stringify({ lat, lon, message }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.event;
    },

    async dispatchEvent(eventId) {
        const res = await fetchWithAuth(`/api/events/${eventId}/dispatch`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    // Zones
    async getZones() {
        const res = await fetchWithAuth('/api/zones');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.zones;
    },

    async createZone(zone) {
        const res = await fetchWithAuth('/api/zones', {
            method: 'POST',
            body: JSON.stringify(zone),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.zone;
    },

    async updateZone(id, updates) {
        const res = await fetchWithAuth(`/api/zones/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.zone;
    },

    async deleteZone(id) {
        const res = await fetchWithAuth(`/api/zones/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    // Replay
    async getReplay(duration = 60, robotId = null) {
        const url = robotId
            ? `/api/replay/${robotId}?duration=${duration}`
            : `/api/replay?duration=${duration}`;
        const res = await fetchWithAuth(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return robotId ? data.positions : data.replay;
    },

    async getRobotReplay(robotId, duration = 60) {
        const res = await fetchWithAuth(`/api/replay/${robotId}?duration=${duration}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.positions;
    },

    // Simulation
    async startSimulation() {
        const res = await fetchWithAuth('/api/simulation/start', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async stopSimulation() {
        const res = await fetchWithAuth('/api/simulation/stop', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async getSimulationStatus() {
        const res = await fetchWithAuth('/api/simulation/status');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async updateSimulationConfig(config) {
        const res = await fetchWithAuth('/api/simulation/config', {
            method: 'PATCH',
            body: JSON.stringify(config),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    // Presence
    async getPresence() {
        const res = await fetchWithAuth('/api/presence');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    // Patrol Paths
    async getPatrolRoutes(robotId) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/routes`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.routes;
    },

    async createPatrolRoute(robotId, route) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/routes`, {
            method: 'POST',
            body: JSON.stringify(route),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.route;
    },

    async updatePatrolRoute(robotId, routeId, updates) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/routes/${routeId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.route;
    },

    async activatePatrolRoute(robotId, routeId) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/routes/${routeId}/activate`, {
            method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.route;
    },

    async deletePatrolRoute(robotId, routeId) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/routes/${routeId}`, {
            method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.route;
    },

    async setPatrolPath(robotId, waypoints, options = {}) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/patrol`, {
            method: 'POST',
            body: JSON.stringify({ waypoints, ...options }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.route || data.robot;
    },

    async clearPatrolPath(robotId) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/patrol`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async assignRobotToZone(robotId, zoneId) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/assign-zone`, {
            method: 'POST',
            body: JSON.stringify({ zoneId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.robot;
    },

    async generatePatrolFromZone(robotId, zoneId, offsetMeters = 0) {
        const res = await fetchWithAuth(`/api/robots/${robotId}/generate-patrol`, {
            method: 'POST',
            body: JSON.stringify({ zoneId, offsetMeters }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.waypoints;
    },
};

export { getToken, setToken, removeToken };
