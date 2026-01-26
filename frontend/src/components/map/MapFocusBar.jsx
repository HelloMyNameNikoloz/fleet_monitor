export default function MapFocusBar({ selectedRobot, onReplay, onMoveRandom, onCenterSelected }) {
    return (
        <div className="map-focus-bar">
            {selectedRobot ? (
                <>
                    <div className="map-focus-title">
                        <span className={`status-dot ${selectedRobot.status}`}></span>
                        <span>{selectedRobot.name}</span>
                    </div>
                    <div className="map-focus-actions">
                        <button className="btn btn-secondary btn-sm" onClick={onReplay}>
                            Replay
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={onMoveRandom}>
                            Move
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={onCenterSelected}>
                            Center
                        </button>
                    </div>
                </>
            ) : (
                <div className="map-focus-empty">Select an actor to view quick actions.</div>
            )}
        </div>
    );
}
