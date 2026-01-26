export default function MapHoverCard({ hoveredRobot }) {
    if (!hoveredRobot) return null;

    return (
        <div className="map-hover-card" style={{ left: hoveredRobot.x, top: hoveredRobot.y }}>
            <div className="map-hover-title">{hoveredRobot.robot.name}</div>
            <div className="map-hover-meta">
                Battery {hoveredRobot.robot.battery ?? 0}% | Last seen {hoveredRobot.robot.last_seen ? new Date(hoveredRobot.robot.last_seen).toLocaleTimeString() : 'N/A'}
            </div>
        </div>
    );
}
