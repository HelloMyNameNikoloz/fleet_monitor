import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useRobots } from '../context/RobotsContext';

export default function Settings() {
    const { trailDuration, setTrailDuration } = useRobots();
    const [simulationStatus, setSimulationStatus] = useState({ running: false, config: {} });
    const [loading, setLoading] = useState(true);

    // Settings state
    const [trailLength, setTrailLength] = useState(trailDuration);
    const [trailSelectedOnly, setTrailSelectedOnly] = useState(false);
    const [trailFadeOut, setTrailFadeOut] = useState(true);
    const [simulationInterval, setSimulationInterval] = useState(2000);
    const [simulationRadius, setSimulationRadius] = useState(0.001);
    const [soundAlerts, setSoundAlerts] = useState(true);
    const [desktopNotifications, setDesktopNotifications] = useState(false);

    useEffect(() => {
        loadSimulationStatus();
    }, []);

    const loadSimulationStatus = async () => {
        try {
            const status = await api.getSimulationStatus();
            setSimulationStatus(status);
            if (status.config) {
                setSimulationInterval(status.config.intervalMs || 2000);
                setSimulationRadius(status.config.moveRadius || 0.001);
            }
        } catch (error) {
            console.error('Failed to load simulation status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartSimulation = async () => {
        try {
            await api.startSimulation();
            loadSimulationStatus();
        } catch (error) {
            console.error('Failed to start simulation:', error);
        }
    };

    const handleStopSimulation = async () => {
        try {
            await api.stopSimulation();
            loadSimulationStatus();
        } catch (error) {
            console.error('Failed to stop simulation:', error);
        }
    };

    const handleUpdateSimulationConfig = async () => {
        try {
            await api.updateSimulationConfig({
                intervalMs: simulationInterval,
                moveRadius: simulationRadius
            });
            loadSimulationStatus();
        } catch (error) {
            console.error('Failed to update config:', error);
        }
    };

    const handleTrailLengthChange = (value) => {
        setTrailLength(value);
        setTrailDuration(value);
    };

    return (
        <div className="page-container">
            <div className="settings-page">
                <h2>Settings</h2>

                <div className="settings-sections">
                    {/* Trail Settings */}
                    <section className="settings-section">
                        <h3>Trail Settings</h3>

                        <div className="slider-container">
                            <div className="slider-header">
                                <span className="slider-label">Trail Length</span>
                                <span className="slider-value">{trailLength}s</span>
                            </div>
                            <input
                                type="range"
                                className="slider"
                                min="30"
                                max="300"
                                step="10"
                                value={trailLength}
                                onChange={(e) => handleTrailLengthChange(parseInt(e.target.value))}
                            />
                            <div className="slider-range">
                                <span>30s</span>
                                <span>300s</span>
                            </div>
                        </div>

                        <div className="toggle-container">
                            <div>
                                <span className="form-label">Only trail for selected robot</span>
                                <p className="form-hint">Show trail only for the currently selected robot</p>
                            </div>
                            <div
                                className={`toggle ${trailSelectedOnly ? 'active' : ''}`}
                                onClick={() => setTrailSelectedOnly(!trailSelectedOnly)}
                            >
                                <div className="toggle-handle" />
                            </div>
                        </div>

                        <div className="toggle-container">
                            <div>
                                <span className="form-label">Trail fade-out effect</span>
                                <p className="form-hint">Older positions fade out gradually</p>
                            </div>
                            <div
                                className={`toggle ${trailFadeOut ? 'active' : ''}`}
                                onClick={() => setTrailFadeOut(!trailFadeOut)}
                            >
                                <div className="toggle-handle" />
                            </div>
                        </div>
                    </section>

                    {/* Simulation Settings */}
                    <section className="settings-section">
                        <h3>Simulation Settings</h3>

                        <div className="simulation-status">
                            <div className={`status-indicator ${simulationStatus.running ? 'running' : 'stopped'}`}>
                                <span className="status-dot"></span>
                                {simulationStatus.running ? 'Running' : 'Stopped'}
                            </div>
                            {simulationStatus.running ? (
                                <button className="btn btn-danger" onClick={handleStopSimulation}>
                                    Stop Simulation
                                </button>
                            ) : (
                                <button className="btn btn-primary" onClick={handleStartSimulation}>
                                    Start Simulation
                                </button>
                            )}
                        </div>

                        <div className="slider-container">
                            <div className="slider-header">
                                <span className="slider-label">Update Interval</span>
                                <span className="slider-value">{simulationInterval / 1000}s</span>
                            </div>
                            <input
                                type="range"
                                className="slider"
                                min="1000"
                                max="5000"
                                step="500"
                                value={simulationInterval}
                                onChange={(e) => setSimulationInterval(parseInt(e.target.value))}
                            />
                        </div>

                        <div className="slider-container">
                            <div className="slider-header">
                                <span className="slider-label">Move Radius</span>
                                <span className="slider-value">{(simulationRadius * 111000).toFixed(0)}m</span>
                            </div>
                            <input
                                type="range"
                                className="slider"
                                min="0.0005"
                                max="0.005"
                                step="0.0005"
                                value={simulationRadius}
                                onChange={(e) => setSimulationRadius(parseFloat(e.target.value))}
                            />
                        </div>

                        <button
                            className="btn btn-secondary"
                            onClick={handleUpdateSimulationConfig}
                        >
                            Apply Changes
                        </button>
                    </section>

                    {/* Notification Settings */}
                    <section className="settings-section">
                        <h3>Notifications</h3>

                        <div className="toggle-container">
                            <div>
                                <span className="form-label">Sound alerts on geofence</span>
                                <p className="form-hint">Play sound when robot enters restricted zone</p>
                            </div>
                            <div
                                className={`toggle ${soundAlerts ? 'active' : ''}`}
                                onClick={() => setSoundAlerts(!soundAlerts)}
                            >
                                <div className="toggle-handle" />
                            </div>
                        </div>

                        <div className="toggle-container">
                            <div>
                                <span className="form-label">Desktop notifications</span>
                                <p className="form-hint">Show browser notifications for alerts</p>
                            </div>
                            <div
                                className={`toggle ${desktopNotifications ? 'active' : ''}`}
                                onClick={() => setDesktopNotifications(!desktopNotifications)}
                            >
                                <div className="toggle-handle" />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
                .settings-page {
                    flex: 1;
                    padding: var(--spacing-2xl);
                    overflow-y: auto;
                }

                .settings-page h2 {
                    font-size: var(--font-size-2xl);
                    margin-bottom: var(--spacing-lg);
                    letter-spacing: 0.01em;
                }

                .settings-sections {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-2xl);
                    max-width: 720px;
                }

                .settings-section {
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: var(--spacing-2xl);
                    box-shadow: var(--shadow-sm);
                }

                .settings-section h3 {
                    font-size: var(--font-size-lg);
                    margin-bottom: var(--spacing-lg);
                    padding-bottom: var(--spacing-md);
                    border-bottom: 1px solid var(--border-subtle);
                }

                .slider-container {
                    margin-bottom: var(--spacing-xl);
                    padding: var(--spacing-md) var(--spacing-lg);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    background: var(--base-elevated);
                }

                .slider-range {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: var(--spacing-xs);
                }

                .toggle-container {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--spacing-lg);
                    padding: var(--spacing-md) 0;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .toggle-container:last-child {
                    border-bottom: none;
                }

                .form-hint {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: var(--spacing-xs);
                }

                .simulation-status {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--spacing-lg);
                    background: var(--base-elevated);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    margin-bottom: var(--spacing-xl);
                }

                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    font-weight: var(--font-weight-medium);
                }

                .status-indicator .status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }

                .status-indicator.running .status-dot {
                    background: var(--success);
                    animation: pulse 2s ease-in-out infinite;
                }

                .status-indicator.stopped .status-dot {
                    background: var(--text-muted);
                }
            `}</style>
        </div>
    );
}
