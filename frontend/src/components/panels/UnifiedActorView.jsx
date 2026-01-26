import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots } from '../../context/RobotsContext';
import RobotList from './RobotList';
import PatrolRouteEditor from './PatrolRouteEditor';

const formatRelative = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
};

export default function UnifiedActorView({ zones = [] }) {
    const navigate = useNavigate();
    const {
        robots,
        robotsMap,
        selectedRobot,
        selectedRobotId,
        setSelectedRobotId,
        operatorsOnline,
        connected,
        moveRobot,
        trails,
        trailDuration,
        wsLagMs,
        lastRobotUpdateAt,
        focusCounts,
        loadRobots
    } = useRobots();

    const [routeEditorOpen, setRouteEditorOpen] = useState(false);
    const [routeEditorRobotId, setRouteEditorRobotId] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [actorsOpen, setActorsOpen] = useState(false);
    const [focusOpen, setFocusOpen] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const allRobots = useMemo(() => Object.values(robotsMap), [robotsMap]);

    const handleMoveRandom = () => {
        if (!selectedRobotId) return;
        moveRobot(selectedRobotId);
    };

    const handleReplay = () => {
        if (!selectedRobotId) return;
        navigate('/replay', { state: { robotId: selectedRobotId } });
    };

    const trailCount = selectedRobotId ? trails[selectedRobotId]?.length || 0 : 0;
    const batteryLevel = selectedRobot?.battery ?? 0;
    const batteryClass = batteryLevel > 50 ? '' : batteryLevel > 20 ? 'low' : 'critical';

    const patrolWaypoints = useMemo(
        () => normalizeWaypoints(selectedRobot?.patrol_path),
        [selectedRobot]
    );
    const patrolActive = patrolWaypoints.length >= 2;
    const assignedZone = useMemo(() => {
        if (!selectedRobot?.assigned_zone_id) return null;
        return zones.find((zone) => Number(zone.id) === Number(selectedRobot.assigned_zone_id)) || null;
    }, [zones, selectedRobot]);

    const heartbeatMs = lastRobotUpdateAt ? now - lastRobotUpdateAt : null;
    const heartbeatOk = heartbeatMs !== null && heartbeatMs < 6000;
    const lagLabel = wsLagMs === null ? 'Lag --' : `Lag ${Math.round(wsLagMs)}ms`;
    const focusCount = selectedRobotId ? (focusCounts?.[String(selectedRobotId)] || 0) : 0;

    const clearRoute = async () => {
        if (!selectedRobotId) return;
        try {
            await api.clearPatrolPath(selectedRobotId);
            await loadRobots();
        } catch (error) {
            console.error('Failed to clear patrol route:', error);
        }
    };

    const openRouteEditor = (robotId = null) => {
        setRouteEditorRobotId(robotId);
        setRouteEditorOpen(true);
    };

    return (
        <div className="unified-actor-view">
            <div className="unified-header">
                <div>
                    <h3>Unified Actor View</h3>
                </div>
                <div className="unified-badges">
                </div>
            </div>

            <div className={`card unified-focus ${focusOpen ? 'open' : 'collapsed'}`}>
                <button
                    type="button"
                    className="card-header unified-focus-header"
                    onClick={() => setFocusOpen((prev) => !prev)}
                >
                    <div>
                        <h3>{selectedRobot ? selectedRobot.name : 'Actor Focus'}</h3>
                        <p className="unified-focus-subtitle">
                            {selectedRobot ? `Last seen ${formatRelative(selectedRobot.last_seen)}` : 'Select a robot to focus'}
                        </p>
                    </div>
                    <div className="unified-focus-header-right">
                        {selectedRobot && (
                            <span className={`badge badge-${selectedRobot.status === 'moving' ? 'success' : selectedRobot.status === 'idle' ? 'warning' : 'error'}`}>
                                <span className={`status-dot ${selectedRobot.status}`}></span>
                                {selectedRobot.status}
                            </span>
                        )}
                        <span className="collapse-chevron">{focusOpen ? '-' : '+'}</span>
                    </div>
                </button>

                {focusOpen && (
                    <div className="card-body unified-focus-body">
                        {!selectedRobot ? (
                            <div className="unified-focus-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="10" rx="2" />
                                    <circle cx="12" cy="5" r="2" />
                                    <path d="M12 7v4" />
                                </svg>
                                <div>
                                    <div className="unified-focus-empty-title">No actor selected</div>
                                    <p>Pick a robot from the actor list to see live telemetry.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="unified-focus-strip">
                                    <div className="unified-strip-item">
                                        <span className="label">Battery</span>
                                        <div className="value">
                                            <div className="unified-battery-bar">
                                                <div className={`unified-battery-fill ${batteryClass}`} style={{ width: `${batteryLevel}%` }} />
                                            </div>
                                            <span>{batteryLevel}%</span>
                                        </div>
                                    </div>
                                    <div className="unified-strip-item">
                                        <span className="label">Speed</span>
                                        <span className="value">{selectedRobot.speed?.toFixed(2) || '0.00'} m/s</span>
                                    </div>
                                    <div className="unified-strip-item">
                                        <span className="label">Last seen</span>
                                        <span className="value">{formatRelative(selectedRobot.last_seen)}</span>
                                    </div>
                                    <div className="unified-strip-item">
                                        <span className="label">Patrol</span>
                                        <span className="value">{patrolActive ? `${patrolWaypoints.length} pts` : 'Inactive'}</span>
                                    </div>
                                </div>

                                <div className="unified-focus-actions">
                                    <button className="btn btn-secondary" onClick={handleReplay}>
                                        Replay
                                    </button>
                                    <button className="btn btn-primary" onClick={handleMoveRandom}>
                                        Move Random
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => setSelectedRobotId(null)}>
                                        Clear Focus
                                    </button>
                                </div>

                                <div className="unified-patrol-inline">
                                    <div>
                                        <span className="label">Patrol</span>
                                        <div className="value">
                                            {patrolActive ? `${patrolWaypoints.length} pts` : 'Inactive'}
                                            {assignedZone?.name ? ` | ${assignedZone.name}` : ''}
                                        </div>
                                    </div>
                                    <div className="unified-patrol-inline-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openRouteEditor(selectedRobotId)}>
                                            Route Editor
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={clearRoute} disabled={!patrolActive}>
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="unified-grid">
                <div className={`card unified-actors ${actorsOpen ? 'open' : 'collapsed'}`}>
                    <button
                        type="button"
                        className="card-header unified-actors-header"
                        onClick={() => setActorsOpen((prev) => !prev)}
                    >
                        <h3>Actors</h3>
                        <span className="collapse-chevron">{actorsOpen ? '-' : '+'}</span>
                    </button>
                    {actorsOpen && (
                        <div className="card-body unified-actors-body">
                            <RobotList />
                        </div>
                    )}
                </div>
            </div>

            {routeEditorOpen && (
                <PatrolRouteEditor
                    open={routeEditorOpen}
                    onClose={() => setRouteEditorOpen(false)}
                    robots={allRobots}
                    zones={zones}
                    initialRobotId={routeEditorRobotId || selectedRobotId}
                    onSaved={loadRobots}
                />
            )}

            <style>{`
                .unified-actor-view {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .unified-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--spacing-lg);
                }

                .unified-subtitle {
                    color: var(--text-muted);
                    font-size: var(--font-size-sm);
                    margin-top: var(--spacing-xs);
                }

                .unified-badges {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                .unified-focus {
                    overflow: hidden;
                }

                .unified-focus-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--spacing-md);
                    width: 100%;
                    background: transparent;
                    border: none;
                    text-align: left;
                    cursor: pointer;
                }

                .unified-focus-header-right {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .collapse-chevron {
                    width: 28px;
                    height: 28px;
                    border-radius: var(--radius-full);
                    border: 1px solid var(--border-subtle);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    font-weight: var(--font-weight-semibold);
                }

                .unified-focus-subtitle {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: 4px;
                }

                .unified-focus-body {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .unified-focus-empty {
                    display: flex;
                    gap: var(--spacing-md);
                    align-items: center;
                    color: var(--text-muted);
                }

                .unified-focus-empty svg {
                    width: 40px;
                    height: 40px;
                    opacity: 0.6;
                }

                .unified-focus-empty-title {
                    font-weight: var(--font-weight-semibold);
                    color: var(--text-primary);
                    margin-bottom: 4px;
                }

                .unified-focus-strip {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: var(--spacing-sm);
                }

                .unified-strip-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                }

                .unified-strip-item .label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .unified-strip-item .value {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    font-weight: var(--font-weight-medium);
                    font-size: var(--font-size-sm);
                }

                .unified-battery-bar {
                    width: 80px;
                    height: 6px;
                    background: var(--border-subtle);
                    border-radius: var(--radius-full);
                    overflow: hidden;
                }

                .unified-battery-fill {
                    height: 100%;
                    background: var(--success);
                    border-radius: var(--radius-full);
                    transition: width var(--transition-base);
                }

                .unified-battery-fill.low {
                    background: var(--warning);
                }

                .unified-battery-fill.critical {
                    background: var(--error);
                }

                .unified-focus-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-wrap: wrap;
                }

                .unified-patrol-inline {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-md);
                    border-radius: var(--radius-md);
                    background: var(--secondary-bg);
                }

                .unified-patrol-inline .label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .unified-patrol-inline .value {
                    font-weight: var(--font-weight-medium);
                    margin-top: 4px;
                    font-size: var(--font-size-sm);
                }

                .unified-patrol-inline-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-wrap: wrap;
                }

                .unified-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: var(--spacing-lg);
                }

                .unified-actors-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--spacing-md);
                    background: transparent;
                    border: none;
                    text-align: left;
                    cursor: pointer;
                    width: 100%;
                }

                .unified-actors-body {
                    padding-top: var(--spacing-md);
                }

                @media (min-width: 1280px) {
                    .unified-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                }
            `}</style>
        </div>
    );
}

function normalizeWaypoints(input) {
    if (!input) return [];
    let raw = input;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (error) {
            return [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw
        .map((point) => {
            if (Array.isArray(point)) {
                return { lat: Number(point[0]), lon: Number(point[1]) };
            }
            if (point && typeof point === 'object') {
                return { lat: Number(point.lat), lon: Number(point.lon) };
            }
            return null;
        })
        .filter((point) =>
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon)
        );
}
