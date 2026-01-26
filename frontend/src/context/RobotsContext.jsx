import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, getToken } from '../utils/api';

const RobotsContext = createContext(null);

// Direct connection to backend (bypass Vite proxy which can be unstable for specific WS headers)
const WS_URL = 'ws://127.0.0.1:3001';

export function RobotsProvider({ children }) {
    console.log('ROBOTS CONTEXT LOADED - DIRECT CONNECTION MODE');
    const [robots, setRobots] = useState({});
    const [trails, setTrails] = useState({});
    const [events, setEvents] = useState([]);
    const [selectedRobotId, setSelectedRobotId] = useState(() => {
        const stored = localStorage.getItem('fleet_selected_robot_id');
        if (!stored) return null;
        const parsed = Number(stored);
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [operatorsOnline, setOperatorsOnline] = useState(0);
    const [filter, setFilter] = useState('all');
    const [trailDuration, setTrailDuration] = useState(60);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [wsLagMs, setWsLagMs] = useState(null);
    const [lastMessageAt, setLastMessageAt] = useState(null);
    const [lastRobotUpdateAt, setLastRobotUpdateAt] = useState(null);
    const [focusCounts, setFocusCounts] = useState({});

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const selectedRobotIdRef = useRef(null);
    const robotsRef = useRef({});

    // Load initial robots and their trails
    const loadRobots = useCallback(async () => {
        try {
            const robotsList = await api.getRobots();
            const robotsMap = {};
            robotsList.forEach(robot => {
                robotsMap[robot.id] = robot;
            });
            setRobots(robotsMap);

            // Fetch trails for all robots in parallel
            const trailPromises = robotsList.map(robot =>
                api.getRobotTrail(robot.id, trailDuration)
                    .then(trail => ({ id: robot.id, trail }))
                    .catch(err => {
                        console.error(`Failed to load trail for robot ${robot.id}`, err);
                        return { id: robot.id, trail: [] };
                    })
            );

            const trailsResults = await Promise.all(trailPromises);
            const trailsMap = {};

            trailsResults.forEach(({ id, trail }) => {
                const robot = robotsMap[id];
                let fullTrail = trail || [];

                // Ensure we have a starting point (current position) if trail is empty
                if (robot && fullTrail.length === 0) {
                    fullTrail = [{
                        lat: robot.lat,
                        lon: robot.lon,
                        timestamp: new Date().toISOString()
                    }];
                }
                trailsMap[id] = fullTrail;
            });

            setTrails(trailsMap);

        } catch (error) {
            console.error('Failed to load robots:', error);
        } finally {
            setLoading(false);
        }
    }, [trailDuration]);

    // Load trail for a robot - includes starting position
    const loadTrail = useCallback(async (robotId, duration = trailDuration) => {
        try {
            const trail = await api.getRobotTrail(robotId, duration);

            // Get the robot's current position to use as starting point
            setRobots(currentRobots => {
                const robot = currentRobots[robotId];
                if (robot) {
                    // Create trail with robot's current position as first point if trail is empty
                    // or if the first trail point is different from current position
                    let fullTrail = trail || [];

                    // Add current robot position at the START if not already included
                    // This ensures we have a starting point for the trail
                    const currentPos = {
                        lat: robot.lat,
                        lon: robot.lon,
                        timestamp: new Date().toISOString()
                    };

                    // If trail is empty, just use current position
                    if (fullTrail.length === 0) {
                        fullTrail = [currentPos];
                    }

                    setTrails(prev => ({
                        ...prev,
                        [robotId]: fullTrail
                    }));
                }
                return currentRobots; // Don't actually change robots state
            });
        } catch (error) {
            console.error('Failed to load trail:', error);
        }
    }, [trailDuration]);

    // WebSocket connection
    const connectWebSocket = useCallback(() => {
        const token = getToken();
        if (!token) return;

        // Prevent multiple connections
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
            return;
        }

        console.log('Attempting WebSocket connection to:', `${WS_URL}/ws`);
        const ws = new WebSocket(`${WS_URL}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            // Authenticate
            ws.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (typeof message.serverTime === 'number') {
                    setWsLagMs(Math.max(0, Date.now() - message.serverTime));
                    setLastMessageAt(Date.now());
                }

                switch (message.type) {
                    case 'auth_success':
                        console.log('WebSocket authenticated');
                        setConnected(true);
                        if (selectedRobotIdRef.current !== null) {
                            ws.send(JSON.stringify({
                                type: 'focus',
                                robotId: selectedRobotIdRef.current
                            }));
                        }
                        break;

                    case 'robot_update':
                        const robotId = message.robot.id;
                        const previousRobot = robotsRef.current[robotId];

                        setRobots(prev => ({
                            ...prev,
                            [robotId]: message.robot
                        }));

                        // Update trail for ANY robot (keep all trails live)
                        setTrails(prev => {
                            const existingTrail = prev[robotId] || [];
                            let trail = existingTrail;

                            // Append new position
                            const newPosition = {
                                lat: message.robot.lat,
                                lon: message.robot.lon,
                                timestamp: new Date().toISOString()
                            };

                            if (existingTrail.length === 0 && previousRobot) {
                                const seedPosition = {
                                    lat: previousRobot.lat,
                                    lon: previousRobot.lon,
                                    timestamp: newPosition.timestamp
                                };
                                trail = [seedPosition];
                            }

                            const last = trail[trail.length - 1];
                            if (!last || last.lat !== newPosition.lat || last.lon !== newPosition.lon) {
                                trail = [...trail, newPosition];
                            }

                            // Keep only last N seconds based on duration
                            const cutoff = Date.now() - (trailDuration * 1000);
                            const filteredTrail = trail.filter(p =>
                                new Date(p.timestamp).getTime() > cutoff
                            );

                            return {
                                ...prev,
                                [robotId]: filteredTrail
                            };
                        });
                        setLastRobotUpdateAt(Date.now());
                        break;

                    case 'presence':
                        setOperatorsOnline(message.operatorsOnline);
                        break;

                    case 'ops_state':
                        if (typeof message.operatorsOnline === 'number') {
                            setOperatorsOnline(message.operatorsOnline);
                        }
                        if (message.focusCounts && typeof message.focusCounts === 'object') {
                            setFocusCounts(message.focusCounts);
                        }
                        break;

                    case 'alert':
                        setEvents(prev => [message, ...prev].slice(0, 100));
                        break;

                    case 'event':
                        if (message.event) {
                            setEvents(prev => [message.event, ...prev].slice(0, 100));
                        }
                        break;

                    default:
                        break;
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        ws.onclose = (event) => {
            console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
            setConnected(false);
            setWsLagMs(null);
            setLastMessageAt(null);
            wsRef.current = null;

            // Reconnect after 3 seconds
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log('Reconnecting WebSocket...');
                connectWebSocket();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error event:', error);
        };
    }, [trailDuration]);

    // Initialize
    useEffect(() => {
        loadRobots();
        connectWebSocket();

        return () => {
            console.log('Cleaning up WebSocket connection');
            if (wsRef.current) {
                // Remove listener to prevent auto-reconnect logic during cleanup
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [loadRobots, connectWebSocket]);

    // Keep selectedRobotIdRef in sync with state for WebSocket handler
    useEffect(() => {
        selectedRobotIdRef.current = selectedRobotId;
    }, [selectedRobotId]);

    useEffect(() => {
        if (selectedRobotId === null || selectedRobotId === undefined) {
            localStorage.removeItem('fleet_selected_robot_id');
        } else {
            localStorage.setItem('fleet_selected_robot_id', String(selectedRobotId));
        }
    }, [selectedRobotId]);

    useEffect(() => {
        if (!connected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'focus',
            robotId: selectedRobotId ?? null
        }));
    }, [selectedRobotId, connected]);

    useEffect(() => {
        robotsRef.current = robots;
    }, [robots]);

    // Filter robots
    const filteredRobots = Object.values(robots).filter(robot => {
        if (filter === 'all') return true;
        return robot.status === filter;
    });

    // Get selected robot
    const selectedRobot = selectedRobotId ? robots[selectedRobotId] : null;

    // Move robot
    const moveRobot = useCallback(async (robotId) => {
        try {
            const robot = await api.moveRobot(robotId);
            setRobots(prev => ({
                ...prev,
                [robot.id]: robot
            }));
        } catch (error) {
            console.error('Failed to move robot:', error);
        }
    }, []);

    const createRobot = useCallback(async (name, lat, lon) => {
        try {
            const robot = await api.createRobot(name, lat, lon);
            setRobots(prev => ({
                ...prev,
                [robot.id]: robot
            }));
            setTrails(prev => ({
                ...prev,
                [robot.id]: [{
                    lat: robot.lat,
                    lon: robot.lon,
                    timestamp: new Date().toISOString()
                }]
            }));
            return robot;
        } catch (error) {
            console.error('Failed to create robot:', error);
            throw error;
        }
    }, []);

    const value = {
        robots: filteredRobots,
        robotsMap: robots,
        trails,
        events,
        selectedRobot,
        selectedRobotId,
        setSelectedRobotId,
        filter,
        setFilter,
        trailDuration,
        setTrailDuration,
        operatorsOnline,
        loading,
        connected,
        wsLagMs,
        lastMessageAt,
        lastRobotUpdateAt,
        focusCounts,
        loadRobots,
        loadTrail,
        moveRobot,
        createRobot,
    };

    return (
        <RobotsContext.Provider value={value}>
            {children}
        </RobotsContext.Provider>
    );
}

export function useRobots() {
    const context = useContext(RobotsContext);
    if (!context) {
        throw new Error('useRobots must be used within a RobotsProvider');
    }
    return context;
}
