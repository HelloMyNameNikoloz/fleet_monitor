import { useMemo, useState } from 'react';
import { useRobots } from '../../context/RobotsContext';

// Icons
const BatteryIcon = ({ level }) => {
    const color = level > 50 ? 'var(--success)' : level > 20 ? 'var(--warning)' : 'var(--error)';
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" width="16" height="16">
            <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
            <line x1="23" y1="13" x2="23" y2="11" />
            <rect x="3" y="8" width={Math.max(1, (level / 100) * 14)} height="8" fill={color} stroke="none" />
        </svg>
    );
};

const RobotIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <circle cx="8" cy="16" r="1" />
        <circle cx="16" cy="16" r="1" />
    </svg>
);

export default function RobotList() {
    const {
        robots,
        filter,
        setFilter,
        selectedRobotId,
        setSelectedRobotId,
        loading
    } = useRobots();
    const [searchQuery, setSearchQuery] = useState('');

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'moving', label: 'Moving' },
        { key: 'idle', label: 'Idle' },
        { key: 'offline', label: 'Offline' },
    ];

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const filteredByStatus = useMemo(() => {
        if (filter === 'all') return robots;
        return robots.filter((robot) => robot.status === filter);
    }, [robots, filter]);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (robot) => {
        if (!normalizedQuery) return true;
        return robot.name.toLowerCase().includes(normalizedQuery);
    };

    const focusedRobot = filteredByStatus.find((robot) => robot.id === selectedRobotId && matchesQuery(robot)) || null;
    const offlineRobots = filteredByStatus
        .filter((robot) => robot.status === 'offline' && robot.id !== selectedRobotId)
        .filter(matchesQuery);
    const remainingRobots = filteredByStatus
        .filter((robot) => robot.id !== selectedRobotId && robot.status !== 'offline')
        .filter(matchesQuery);

    if (loading) {
        return (
            <div className="robot-list-loading">
                <span className="spinner"></span>
            </div>
        );
    }

    return (
        <div className="robot-list">
            <div className="robot-list-search">
                <input
                    type="text"
                    className="form-input"
                    placeholder="Search actors..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                />
            </div>
            <div className="robot-list-filters">
                <div className="filter-chips">
                    {filters.map(f => (
                        <button
                            key={f.key}
                            className={`filter-chip ${filter === f.key ? 'active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="robot-list-count">
                {filteredByStatus.length} robot{filteredByStatus.length !== 1 ? 's' : ''}
            </div>

            <div className="robot-list-items">
                {filteredByStatus.length === 0 ? (
                    <div className="robot-list-empty">
                        <p>No robots match this filter.</p>
                    </div>
                ) : (
                    <>
                        {focusedRobot && (
                            <div className="robot-list-section">
                                <div className="robot-list-section-title">Focused</div>
                                <RobotRow
                                    robot={focusedRobot}
                                    selectedRobotId={selectedRobotId}
                                    onSelect={setSelectedRobotId}
                                    formatLastSeen={formatLastSeen}
                                />
                            </div>
                        )}
                        {offlineRobots.length > 0 && (
                            <div className="robot-list-section">
                                <div className="robot-list-section-title">Offline</div>
                                {offlineRobots.map(robot => (
                                    <RobotRow
                                        key={robot.id}
                                        robot={robot}
                                        selectedRobotId={selectedRobotId}
                                        onSelect={setSelectedRobotId}
                                        formatLastSeen={formatLastSeen}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="robot-list-section">
                            <div className="robot-list-section-title">All</div>
                            {remainingRobots.map(robot => (
                                <RobotRow
                                    key={robot.id}
                                    robot={robot}
                                    selectedRobotId={selectedRobotId}
                                    onSelect={setSelectedRobotId}
                                    formatLastSeen={formatLastSeen}
                                />
                            ))}
                            {remainingRobots.length === 0 && !focusedRobot && offlineRobots.length === 0 && (
                                <div className="robot-list-empty">
                                    <p>No actors match your search.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                .robot-list {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .robot-list-search {
                    margin-bottom: var(--spacing-md);
                }

                .robot-list-filters {
                    margin-bottom: var(--spacing-md);
                }

                .robot-list-count {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                    margin-bottom: var(--spacing-md);
                }

                .robot-list-items {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    overflow-y: auto;
                    flex: 1;
                }

                .robot-list-section {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                }

                .robot-list-section-title {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .robot-list-loading,
                .robot-list-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 200px;
                    color: var(--text-muted);
                }

                .robot-card-time {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}

function RobotRow({ robot, selectedRobotId, onSelect, formatLastSeen }) {
    return (
        <div
            className={`robot-card ${selectedRobotId === robot.id ? 'selected' : ''}`}
            onClick={() => onSelect(robot.id)}
        >
            <div className="robot-card-icon">
                <RobotIcon />
            </div>
            <div className="robot-card-info">
                <div className="robot-card-name">{robot.name}</div>
                <div className="robot-card-meta">
                    <span className={`badge badge-${robot.status === 'moving' ? 'success' : robot.status === 'idle' ? 'warning' : 'error'}`}>
                        <span className={`status-dot ${robot.status}`}></span>
                        {robot.status}
                    </span>
                    <div className="robot-card-battery">
                        <BatteryIcon level={robot.battery} />
                        <span>{robot.battery}%</span>
                    </div>
                </div>
            </div>
            <div className="robot-card-time">
                {formatLastSeen(robot.last_seen)}
            </div>
        </div>
    );
}
