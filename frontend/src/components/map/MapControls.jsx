export default function MapControls({
    followRobot,
    showTrails,
    showZones,
    showPatrols,
    addRobotOpen,
    patrolActive,
    patrolDirection,
    selectedRobotId,
    onToggleFollow,
    onToggleTrails,
    onToggleZones,
    onTogglePatrols,
    onToggleAddRobot,
    onCenterAll,
    onZoomIn,
    onZoomOut
}) {
    return (
        <div className="map-controls">
            <div className="map-controls-title">Map Tools</div>
            <button
                className={`map-control-btn ${followRobot ? 'active' : ''}`}
                onClick={onToggleFollow}
                title="Follow selected robot"
                disabled={!selectedRobotId}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>

            <button
                className={`map-control-btn ${showTrails ? 'active' : ''}`}
                onClick={onToggleTrails}
                title="Toggle trails"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10" />
                    <path d="M22 12c-2.76 0-5 2.24-5 5s2.24 5 5 5" />
                </svg>
            </button>

            <button
                className={`map-control-btn ${showZones ? 'active' : ''}`}
                onClick={onToggleZones}
                title="Toggle zones"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
            </button>

            <button
                className={`map-control-btn ${showPatrols ? 'active' : ''}`}
                onClick={onTogglePatrols}
                title="Toggle patrol routes"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h6l3 4 4-6 5 8" />
                    <circle cx="3" cy="6" r="1.5" />
                    <circle cx="12" cy="10" r="1.5" />
                    <circle cx="16" cy="4" r="1.5" />
                    <circle cx="21" cy="12" r="1.5" />
                </svg>
            </button>

            <button
                className={`map-control-btn ${addRobotOpen ? 'active' : ''}`}
                onClick={onToggleAddRobot}
                title="Add robot"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="3" />
                    <path d="M5 19c0-3.5 3.1-6 7-6s7 2.5 7 6" />
                    <line x1="19" y1="4" x2="19" y2="8" />
                    <line x1="17" y1="6" x2="21" y2="6" />
                </svg>
            </button>

            <div className="map-controls-divider" />

            <button
                className="map-control-btn"
                onClick={onCenterAll}
                title="Center all robots"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
            </button>

            <div className="map-route-pill">
                <span className="label">Route</span>
                <span className={`value ${patrolActive ? 'active' : ''}`}>
                    {patrolActive ? (patrolDirection === 'ccw' ? 'CCW' : 'CW') : 'Inactive'}
                </span>
            </div>

            <button className="map-control-btn" onClick={onZoomIn} title="Zoom in">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            <button className="map-control-btn" onClick={onZoomOut} title="Zoom out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>
    );
}
