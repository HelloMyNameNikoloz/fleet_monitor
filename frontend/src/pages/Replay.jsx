import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import 'ol/ol.css';

import { useLocation } from 'react-router-dom';

export default function Replay() {
    const location = useLocation();
    const [replayData, setReplayData] = useState([]);
    const [robots, setRobots] = useState([]);
    const [selectedRobotId, setSelectedRobotId] = useState('all');

    // Handle initial state from navigation
    useEffect(() => {
        if (location.state?.robotId) {
            setSelectedRobotId(String(location.state.robotId));
        }
    }, [location.state]);

    const [duration, setDuration] = useState(60);
    const [speed, setSpeed] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [loading, setLoading] = useState(false);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const robotsLayerRef = useRef(null);
    const trailsLayerRef = useRef(null);
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Load robots list for dropdown
    useEffect(() => {
        const fetchRobots = async () => {
            try {
                const robotsList = await api.getRobots();
                setRobots(robotsList || []);
            } catch (error) {
                console.error('Failed to fetch robots:', error);
            }
        };
        fetchRobots();
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        // Create trails layer
        const trailsSource = new VectorSource();
        const trailsLayer = new VectorLayer({
            source: trailsSource,
            style: new Style({
                stroke: new Stroke({
                    color: 'rgba(184, 138, 45, 0.5)',
                    width: 3
                })
            })
        });
        trailsLayerRef.current = trailsLayer;

        // Create robots layer
        const robotsSource = new VectorSource();
        const robotsLayer = new VectorLayer({
            source: robotsSource,
            style: (feature) => {
                const isActive = feature.get('isActive');
                return new Style({
                    image: new CircleStyle({
                        radius: isActive ? 12 : 8,
                        fill: new Fill({ color: isActive ? '#10B981' : '#9CA3AF' }),
                        stroke: new Stroke({
                            color: isActive ? '#B88A2D' : 'rgba(255,255,255,0.8)',
                            width: isActive ? 3 : 2
                        })
                    }),
                    text: new Text({
                        text: feature.get('name'),
                        offsetY: -20,
                        font: '12px "Bricolage Grotesque", sans-serif',
                        fill: new Fill({ color: '#FFFFFF' }),
                        stroke: new Stroke({ color: '#000000', width: 3 })
                    }),
                    zIndex: isActive ? 100 : 50
                });
            }
        });
        robotsLayerRef.current = robotsLayer;

        // Create map
        const map = new Map({
            target: mapRef.current,
            layers: [
                new TileLayer({
                    source: new OSM({
                        url: 'https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                    })
                }),
                trailsLayer,
                robotsLayer
            ],
            view: new View({
                center: fromLonLat([12.4547, 51.3397]),
                zoom: 15
            })
        });

        mapInstance.current = map;

        return () => {
            map.setTarget(undefined);
            mapInstance.current = null;
        };
    }, []);

    // Load replay data
    const loadReplay = useCallback(async () => {
        setLoading(true);
        try {
            let data = [];

            if (selectedRobotId === 'all') {
                // Get all robots replay - returns array of { robot_id, robot_name, positions }
                const allData = await api.getReplay(duration);
                data = Array.isArray(allData) ? allData : [];
            } else {
                // Get single robot replay - returns array of positions directly
                const minutes = Math.max(1, Math.round(duration / 60));
                const positions = await api.getRobotHistory(selectedRobotId, minutes);
                const robot = robots.find(r => r.id.toString() === selectedRobotId.toString());

                // Normalize to same format as all robots
                data = [{
                    robot_id: selectedRobotId,
                    robot_name: robot?.name || `Robot ${selectedRobotId}`,
                    positions: Array.isArray(positions) ? positions : []
                }];
            }

            setReplayData(data);
            setCurrentTime(0);
            setIsPlaying(false);

            // Draw initial trails and position robots at start
            if (data.length > 0) {
                updateMapDisplay(data, 0);
            }
        } catch (error) {
            console.error('Failed to load replay:', error);
            setReplayData([]);
        } finally {
            setLoading(false);
        }
    }, [duration, selectedRobotId, robots]);

    useEffect(() => {
        if (robots.length > 0) {
            loadReplay();
        }
    }, [duration, selectedRobotId, robots.length]);

    // Get interpolated position at time
    const getPositionAtTime = useCallback((positions, timeMs) => {
        if (!positions || positions.length === 0) return null;

        // Find the two positions surrounding our target time
        const minTime = new Date(positions[0].timestamp).getTime();
        const maxTime = new Date(positions[positions.length - 1].timestamp).getTime();
        const targetTime = minTime + timeMs;

        // Clamp to available range
        if (targetTime <= minTime) {
            return { lat: positions[0].lat, lon: positions[0].lon };
        }
        if (targetTime >= maxTime) {
            return { lat: positions[positions.length - 1].lat, lon: positions[positions.length - 1].lon };
        }

        // Find surrounding positions
        for (let i = 0; i < positions.length - 1; i++) {
            const t1 = new Date(positions[i].timestamp).getTime();
            const t2 = new Date(positions[i + 1].timestamp).getTime();

            if (targetTime >= t1 && targetTime <= t2) {
                // Interpolate between positions
                const ratio = (targetTime - t1) / (t2 - t1);
                return {
                    lat: positions[i].lat + (positions[i + 1].lat - positions[i].lat) * ratio,
                    lon: positions[i].lon + (positions[i + 1].lon - positions[i].lon) * ratio
                };
            }
        }

        return { lat: positions[0].lat, lon: positions[0].lon };
    }, []);

    // Update map display
    const updateMapDisplay = useCallback((data, timeMs) => {
        if (!robotsLayerRef.current || !trailsLayerRef.current) return;
        if (!Array.isArray(data)) return;

        const robotsSource = robotsLayerRef.current.getSource();
        const trailsSource = trailsLayerRef.current.getSource();

        robotsSource.clear();
        trailsSource.clear();

        data.forEach(robotData => {
            const positions = robotData?.positions;
            if (!positions || !Array.isArray(positions) || positions.length === 0) return;

            // Get current position at time
            const pos = getPositionAtTime(positions, timeMs);
            if (!pos) return;

            // Create robot marker
            const robotFeature = new Feature({
                geometry: new Point(fromLonLat([pos.lon, pos.lat])),
                name: robotData.robot_name || `Robot ${robotData.robot_id}`,
                isActive: true
            });
            robotsSource.addFeature(robotFeature);

            // Create trail up to current time
            const minTime = new Date(positions[0].timestamp).getTime();
            const targetTime = minTime + timeMs;
            const trailPositions = positions.filter(p =>
                new Date(p.timestamp).getTime() <= targetTime
            );

            if (trailPositions.length >= 2) {
                const coords = trailPositions.map(p => fromLonLat([p.lon, p.lat]));
                const trailFeature = new Feature({
                    geometry: new LineString(coords)
                });
                trailsSource.addFeature(trailFeature);
            }
        });
    }, [getPositionAtTime]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            return;
        }

        const animate = (timestamp) => {
            if (!lastTimeRef.current) {
                lastTimeRef.current = timestamp;
            }

            const delta = (timestamp - lastTimeRef.current) * speed;
            lastTimeRef.current = timestamp;

            setCurrentTime(prev => {
                const next = prev + delta;
                if (next >= duration * 1000) {
                    setIsPlaying(false);
                    return duration * 1000;
                }
                return next;
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, speed, duration]);

    // Update map when time changes
    useEffect(() => {
        if (replayData.length > 0) {
            updateMapDisplay(replayData, currentTime);
        }
    }, [currentTime, replayData, updateMapDisplay]);

    const handlePlayPause = () => {
        if (currentTime >= duration * 1000) {
            setCurrentTime(0);
        }
        lastTimeRef.current = null;
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e) => {
        const value = parseFloat(e.target.value);
        setCurrentTime(value);
        setIsPlaying(false);
    };

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate total data points safely
    const totalDataPoints = replayData.reduce((acc, r) => {
        const positions = r?.positions;
        return acc + (Array.isArray(positions) ? positions.length : 0);
    }, 0);

    return (
        <div className="page-container">
            <div className="replay-page">
                <div className="replay-map" ref={mapRef} />

                <div className="replay-controls-panel">
                    <div className="replay-controls-header">
                        <h3>Playback Controls</h3>
                    </div>

                    <div className="replay-controls">
                        <div className="replay-robot-select">
                            <label className="form-label">Robot</label>
                            <select
                                className="form-select"
                                value={selectedRobotId}
                                onChange={(e) => setSelectedRobotId(e.target.value)}
                            >
                                <option value="all">All Robots</option>
                                {robots.map(robot => (
                                    <option key={robot.id} value={robot.id}>
                                        {robot.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="replay-duration">
                            <label className="form-label">Duration</label>
                            <div className="filter-chips">
                                {[60, 120, 300, 600].map(d => (
                                    <button
                                        key={d}
                                        className={`filter-chip ${duration === d ? 'active' : ''}`}
                                        onClick={() => setDuration(d)}
                                    >
                                        {d < 60 ? `${d}s` : `${d / 60}min`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="replay-speed">
                            <label className="form-label">Speed</label>
                            <div className="filter-chips">
                                {[0.5, 1, 2, 4].map(s => (
                                    <button
                                        key={s}
                                        className={`filter-chip ${speed === s ? 'active' : ''}`}
                                        onClick={() => setSpeed(s)}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="replay-timeline">
                            <div className="replay-time">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration * 1000)}</span>
                            </div>
                            <input
                                type="range"
                                className="slider"
                                min="0"
                                max={duration * 1000}
                                value={currentTime}
                                onChange={handleSeek}
                            />
                        </div>

                        <div className="replay-actions">
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handlePlayPause}
                                disabled={loading || replayData.length === 0}
                            >
                                {isPlaying ? (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                        </svg>
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                        Play
                                    </>
                                )}
                            </button>

                            <button
                                className="btn btn-secondary"
                                onClick={loadReplay}
                                disabled={loading}
                            >
                                {loading ? <span className="spinner spinner-sm"></span> : 'Reload'}
                            </button>
                        </div>

                        <div className="replay-info">
                            <div className="replay-info-item">
                                <span className="replay-info-label">Robots</span>
                                <span className="replay-info-value">{replayData.length}</span>
                            </div>
                            <div className="replay-info-item">
                                <span className="replay-info-label">Data Points</span>
                                <span className="replay-info-value">{totalDataPoints}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .replay-page {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                    gap: var(--spacing-lg);
                }

                .replay-map {
                    flex: 1;
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }

                .replay-map .ol-zoom,
                .replay-map .ol-attribution {
                    display: none;
                }

                .replay-controls-panel {
                    width: var(--panel-width);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-sm);
                }

                .replay-controls-header {
                    padding: var(--spacing-lg);
                    border-bottom: 1px solid var(--border-subtle);
                }

                .replay-controls-header h3 {
                    font-size: var(--font-size-lg);
                }

                .replay-controls {
                    flex: 1;
                    padding: var(--spacing-lg);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xl);
                }

                .replay-robot-select {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .form-select {
                    width: 100%;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: var(--font-size-md);
                    cursor: pointer;
                }

                .form-select:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(184, 138, 45, 0.2);
                }

                .replay-duration,
                .replay-speed {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .replay-timeline {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .replay-time {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--font-size-sm);
                    font-family: var(--font-mono);
                    color: var(--text-secondary);
                }

                .replay-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .replay-actions .btn-primary {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                }

                .replay-info {
                    display: flex;
                    gap: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                }

                .replay-info-item {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }

                .replay-info-label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                }

                .replay-info-value {
                    font-size: var(--font-size-xl);
                    font-weight: var(--font-weight-bold);
                    color: var(--primary-color);
                }
            `}</style>
        </div>
    );
}
