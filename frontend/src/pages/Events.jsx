import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const severityIcons = {
    info: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    ),
    warning: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    error: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    ),
    success: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
};

export default function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [exporting, setExporting] = useState(false);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const params = filter !== 'all' ? { severity: filter } : {};
            const data = await api.getEvents({ limit: 100, ...params });
            setEvents(data.events);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [filter]);

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const url = `/api/events/export/${format}`;
            const token = localStorage.getItem('fleet_token');
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `events.${format}`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <div className="page-container">
            <div className="events-page">
                <div className="events-header">
                    <h2>Events Timeline</h2>
                    <div className="events-actions">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                        >
                            Export CSV
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExport('json')}
                            disabled={exporting}
                        >
                            Export JSON
                        </button>
                    </div>
                </div>

                <div className="events-filters">
                    <div className="filter-chips">
                        {['all', 'info', 'warning', 'error'].map(f => (
                            <button
                                key={f}
                                className={`filter-chip ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="events-list">
                    {loading ? (
                        <div className="events-loading">
                            <span className="spinner"></span>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                            </div>
                            <h3 className="empty-state-title">No Events</h3>
                            <p className="empty-state-message">No events found matching your filter.</p>
                        </div>
                    ) : (
                        <div className="timeline">
                            {events.map(event => (
                                <div key={event.id} className="timeline-item">
                                    <div className={`timeline-icon ${event.severity}`}>
                                        {severityIcons[event.severity] || severityIcons.info}
                                    </div>
                                    <div className="timeline-content">
                                        <div className="timeline-title">
                                            {event.type.replace(/_/g, ' ')}
                                            {event.robot_name && (
                                                <span className="badge badge-primary" style={{ marginLeft: '8px' }}>
                                                    {event.robot_name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="timeline-message">{event.message}</p>
                                    </div>
                                    <span className="timeline-time">
                                        {formatTime(event.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .events-page {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: var(--spacing-2xl);
                    gap: var(--spacing-lg);
                    overflow: hidden;
                }

                .events-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .events-header h2 {
                    font-size: var(--font-size-2xl);
                    letter-spacing: 0.01em;
                }

                .events-actions {
                    display: flex;
                    gap: var(--spacing-md);
                }

                .events-filters {
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                }

                .events-list {
                    flex: 1;
                    overflow-y: auto;
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-xl);
                    box-shadow: var(--shadow-sm);
                }

                .events-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                }

                .events-list .timeline {
                    gap: var(--spacing-md);
                }

                .events-list .timeline-item {
                    background: var(--base-elevated);
                    border: 1px solid var(--border-subtle);
                }

                .timeline-icon svg {
                    width: 16px;
                    height: 16px;
                }
            `}</style>
        </div>
    );
}
