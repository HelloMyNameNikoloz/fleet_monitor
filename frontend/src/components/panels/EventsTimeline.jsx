import { useState, useEffect } from 'react';
import { useRobots } from '../../context/RobotsContext';
import { api } from '../../utils/api';

export default function EventsTimeline() {
    const { events: liveEvents } = useRobots();
    const [historicalEvents, setHistoricalEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dispatchingId, setDispatchingId] = useState(null);
    const [triggeringAlarm, setTriggeringAlarm] = useState(false);

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            const data = await api.getEvents({ limit: 50 });
            setHistoricalEvents(data.events);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    };

    // Combine live and historical events
    const allEvents = [...liveEvents, ...historicalEvents]
        .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
        .slice(0, 50);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    const getEventIcon = (type, severity) => {
        if (type === 'zone_violation') {
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            );
        }
        if (type === 'alarm_triggered') {
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M5.3 18.7a9 9 0 1 1 13.4 0" />
                </svg>
            );
        }
        if (type === 'dispatch' || type === 'dispatch_complete') {
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
            );
        }
        if (type === 'status_change') {
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
            );
        }
        if (type === 'battery_low') {
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
                    <line x1="23" y1="13" x2="23" y2="11" />
                </svg>
            );
        }
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
        );
    };

    const parseEventData = (event) => {
        if (!event?.data) return null;
        if (typeof event.data === 'string') {
            try {
                return JSON.parse(event.data);
            } catch (error) {
                return null;
            }
        }
        return event.data;
    };

    const getEventLocation = (event) => {
        const data = parseEventData(event);
        if (!data) return null;
        const lat = Number(data.lat);
        const lon = Number(data.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat, lon };
    };

    const triggerAlarm = async () => {
        setTriggeringAlarm(true);
        try {
            const baseLat = 51.3397;
            const baseLon = 12.4547;
            const lat = baseLat + (Math.random() - 0.5) * 0.01;
            const lon = baseLon + (Math.random() - 0.5) * 0.02;
            const event = await api.createAlarm(lat, lon, 'Fence sensor triggered');
            setHistoricalEvents(prev => [event, ...prev]);
        } catch (error) {
            console.error('Failed to trigger alarm:', error);
        } finally {
            setTriggeringAlarm(false);
        }
    };

    const dispatchClosest = async (eventId) => {
        setDispatchingId(eventId);
        try {
            await api.dispatchEvent(eventId);
        } catch (error) {
            console.error('Failed to dispatch robot:', error);
        } finally {
            setDispatchingId(null);
        }
    };

    if (loading) {
        return (
            <div className="events-timeline-loading">
                <span className="spinner"></span>
            </div>
        );
    }

    return (
        <div className="events-timeline-panel">
            <div className="events-timeline-header">
                <div className="events-timeline-title">
                    <span>Live Events</span>
                    <span className="events-count">{allEvents.length}</span>
                </div>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={triggerAlarm}
                    disabled={triggeringAlarm}
                >
                    {triggeringAlarm ? 'Triggering...' : 'Trigger Alarm'}
                </button>
            </div>

            <div className="events-timeline-list">
                {allEvents.length === 0 ? (
                    <div className="events-timeline-empty">
                        <p>No events yet</p>
                    </div>
                ) : (
                    allEvents.map((event, index) => (
                        (() => {
                            const location = getEventLocation(event);
                            const canDispatch = location && !!event.id;
                            const isDispatching = dispatchingId === event.id;
                            return (
                        <div key={event.id || index} className="timeline-item">
                            <div className={`timeline-icon ${event.severity || 'info'}`}>
                                {getEventIcon(event.type, event.severity)}
                            </div>
                            <div className="timeline-content">
                                <div className="timeline-title">
                                    {event.type?.replace(/_/g, ' ') || 'Event'}
                                </div>
                                <p className="timeline-message">
                                    {event.message || event.robot_name || 'No details'}
                                </p>
                                {canDispatch && (
                                    <button
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => dispatchClosest(event.id)}
                                        disabled={isDispatching}
                                    >
                                        {isDispatching ? 'Dispatching...' : 'Dispatch closest robot'}
                                    </button>
                                )}
                            </div>
                            <span className="timeline-time">
                                {formatTime(event.created_at || event.timestamp)}
                            </span>
                        </div>
                            );
                        })()
                    ))
                )}
            </div>

            <style>{`
                .events-timeline-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .events-timeline-loading,
                .events-timeline-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 200px;
                    color: var(--text-muted);
                }

                .events-timeline-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-md);
                    font-weight: var(--font-weight-medium);
                }

                .events-timeline-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .events-count {
                    background: var(--primary-muted);
                    color: var(--primary-color);
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-xs);
                }

                .events-timeline-list {
                    flex: 1;
                    overflow-y: auto;
                }

                .timeline-icon svg {
                    width: 14px;
                    height: 14px;
                }

                .btn-xs {
                    padding: 4px 10px;
                    font-size: var(--font-size-xs);
                    border-radius: var(--radius-full);
                }
            `}</style>
        </div>
    );
}
