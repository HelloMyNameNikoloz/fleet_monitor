export default function MapAddRobotPanel({
    open,
    name,
    error,
    busy,
    placing,
    onNameChange,
    onStart,
    onCancel
}) {
    if (!open) return null;

    return (
        <div className="map-add-panel">
            <div className="map-add-title">Add Robot</div>
            <input
                type="text"
                className="form-input"
                placeholder="Robot name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        onStart();
                    }
                }}
                disabled={busy}
            />
            {error && <div className="map-add-error">{error}</div>}
            <div className="map-add-actions">
                <button
                    className="btn btn-primary btn-sm"
                    onClick={onStart}
                    disabled={busy}
                >
                    {placing ? 'Click on map...' : 'Place on map'}
                </button>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onCancel}
                    disabled={busy}
                >
                    Cancel
                </button>
            </div>
            <div className="map-add-hint">
                {placing ? 'Click anywhere on the map to drop the robot.' : 'Enter a name, then place it on the map.'}
            </div>
        </div>
    );
}
