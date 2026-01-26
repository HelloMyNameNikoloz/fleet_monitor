import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useRobots } from '../../context/RobotsContext';

export default function RobotDrawer() {
    const navigate = useNavigate();
    const {
        selectedRobot,
        selectedRobotId,
        setSelectedRobotId,
        trails,
        loadTrail,
        moveRobot,
        trailDuration
    } = useRobots();

    useEffect(() => {
        console.log('RobotDrawer MOUNTED - v2 (Replay button debug)');
        if (selectedRobotId) {
            loadTrail(selectedRobotId, trailDuration);
        }
    }, [selectedRobotId, loadTrail, trailDuration]);

    if (!selectedRobot) {
        return (
            <div className="robot-drawer-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                </svg>
                <p>Select a robot to view details</p>
            </div>
        );
    }

    const trail = trails[selectedRobotId] || [];

    const formatTime = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const handleMoveRandom = () => {
        moveRobot(selectedRobotId);
    };

    const handleReplay = () => {
        console.log('Replay button clicked for robot:', selectedRobotId);
        try {
            navigate('/replay', { state: { robotId: selectedRobotId } });
            console.log('Navigation called');
        } catch (error) {
            console.error('Navigation failed:', error);
        }
    };

    return (
        <div className="robot-drawer">
            <div className="robot-drawer-header">
                <div className="robot-drawer-title">
                    <h3>{selectedRobot.name}</h3>
                    <span className={`badge badge-${selectedRobot.status === 'moving' ? 'success' : selectedRobot.status === 'idle' ? 'warning' : 'error'}`}>
                        {selectedRobot.status}
                    </span>
                </div>
                <button
                    className="btn btn-icon btn-ghost"
                    onClick={() => setSelectedRobotId(null)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="robot-drawer-stats">
                <div className="robot-stat">
                    <span className="robot-stat-label">Battery</span>
                    <div className="robot-stat-value">
                        <div className="battery-bar">
                            <div
                                className={`battery-fill ${selectedRobot.battery > 50 ? '' : selectedRobot.battery > 20 ? 'low' : 'critical'}`}
                                style={{ width: `${selectedRobot.battery}%` }}
                            />
                        </div>
                        <span>{selectedRobot.battery}%</span>
                    </div>
                </div>

                <div className="robot-stat">
                    <span className="robot-stat-label">Speed</span>
                    <span className="robot-stat-value">{selectedRobot.speed?.toFixed(2) || '0.00'} m/s</span>
                </div>

                <div className="robot-stat">
                    <span className="robot-stat-label">Position</span>
                    <span className="robot-stat-value robot-stat-mono">
                        {selectedRobot.lat?.toFixed(6)}, {selectedRobot.lon?.toFixed(6)}
                    </span>
                </div>

                <div className="robot-stat">
                    <span className="robot-stat-label">Last Update</span>
                    <span className="robot-stat-value">{formatTime(selectedRobot.last_seen)}</span>
                </div>
            </div>

            <div className="robot-drawer-trail">
                <h4>Trail ({trail.length} points)</h4>
                <p className="robot-drawer-trail-hint">
                    Last {trailDuration} seconds of movement
                </p>
            </div>

            <div className="robot-drawer-actions">
                <button className="btn btn-secondary" onClick={handleReplay} style={{ zIndex: 10, position: 'relative' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="10 8 16 12 10 16 10 8" />
                    </svg>
                    Replay
                </button>

                <button className="btn btn-primary" onClick={handleMoveRandom}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <polyline points="5 9 2 12 5 15" />
                        <polyline points="9 5 12 2 15 5" />
                        <polyline points="15 19 12 22 9 19" />
                        <polyline points="19 9 22 12 19 15" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                    </svg>
                    Move Random
                </button>
            </div>

            <style>{`
                .robot-drawer {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .robot-drawer-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-muted);
                    text-align: center;
                }

                .robot-drawer-empty svg {
                    margin-bottom: var(--spacing-md);
                    opacity: 0.5;
                }

                .robot-drawer-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: var(--spacing-lg);
                }

                .robot-drawer-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .robot-drawer-title h3 {
                    font-size: var(--font-size-lg);
                }

                .robot-drawer-stats {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                    padding: var(--spacing-md);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--spacing-lg);
                }

                .robot-stat {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .robot-stat-label {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }

                .robot-stat-value {
                    font-weight: var(--font-weight-medium);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .robot-stat-mono {
                    font-family: var(--font-mono);
                    font-size: var(--font-size-xs);
                }

                .battery-bar {
                    width: 60px;
                    height: 8px;
                    background: var(--border-subtle);
                    border-radius: var(--radius-full);
                    overflow: hidden;
                }

                .battery-fill {
                    height: 100%;
                    background: var(--success);
                    border-radius: var(--radius-full);
                    transition: width var(--transition-base);
                }

                .battery-fill.low {
                    background: var(--warning);
                }

                .battery-fill.critical {
                    background: var(--error);
                }

                .robot-drawer-trail {
                    padding: var(--spacing-md);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--spacing-lg);
                }

                .robot-drawer-trail h4 {
                    font-size: var(--font-size-sm);
                    margin-bottom: var(--spacing-xs);
                }

                .robot-drawer-trail-hint {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .robot-drawer-actions {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    margin-top: auto;
                }

                .robot-drawer-actions .btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                }
            `}</style>
        </div>
    );
}
