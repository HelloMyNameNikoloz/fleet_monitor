import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

export default function Logging() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filter, setFilter] = useState('');
    const [limit, setLimit] = useState(200);
    const [error, setError] = useState('');

    const loadLogs = async () => {
        setError('');
        try {
            const data = await api.getLogs(limit);
            setLogs(data);
        } catch (err) {
            console.error('Failed to load logs:', err);
            setError('Failed to load logs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [limit]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            loadLogs();
        }, 4000);
        return () => clearInterval(interval);
    }, [autoRefresh, limit]);

    const filteredLogs = useMemo(() => {
        const term = filter.trim().toLowerCase();
        if (!term) return logs;
        return logs.filter((log) => {
            const haystack = [
                log.method,
                log.path,
                String(log.status),
                String(log.userId || ''),
                JSON.stringify(log.query || {}),
                JSON.stringify(log.body || {})
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }, [logs, filter]);

    return (
        <div className="page-container">
            <div className="logging-page">
                <div className="logging-header">
                    <div>
                        <h2>Live Logs</h2>
                        <p className="logging-subtitle">Latest backend requests (buffered in memory).</p>
                    </div>
                    <div className="logging-controls">
                        <div className="logging-toggle">
                            <span>Auto refresh</span>
                            <button
                                type="button"
                                className={`toggle ${autoRefresh ? 'active' : ''}`}
                                onClick={() => setAutoRefresh((prev) => !prev)}
                            >
                                <div className="toggle-handle" />
                            </button>
                        </div>
                        <button className="btn btn-secondary" onClick={loadLogs}>
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="logging-toolbar">
                    <input
                        className="form-input"
                        placeholder="Filter by path, status, user, payload..."
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                    />
                    <select
                        className="form-input"
                        value={limit}
                        onChange={(event) => setLimit(Number(event.target.value))}
                    >
                        <option value={50}>Last 50</option>
                        <option value={200}>Last 200</option>
                        <option value={500}>Last 500</option>
                    </select>
                </div>

                {error && <div className="logging-error">{error}</div>}

                <div className="logging-list">
                    {loading ? (
                        <div className="logging-empty">Loading logs...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="logging-empty">No logs yet.</div>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <div key={`${log.timestamp}-${index}`} className="logging-entry">
                                <div className="logging-entry-header">
                                    <span className={`logging-status ${log.status >= 400 ? 'error' : 'ok'}`}>
                                        {log.status}
                                    </span>
                                    <span className="logging-method">{log.method}</span>
                                    <span className="logging-path">{log.path}</span>
                                    <span className="logging-duration">{log.durationMs}ms</span>
                                    <span className="logging-time">{log.timestamp}</span>
                                </div>
                                {(log.query || log.body) && (
                                    <pre className="logging-payload">
                                        {JSON.stringify({ query: log.query, body: log.body }, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                .logging-page {
                    flex: 1;
                    padding: var(--spacing-2xl);
                    overflow-y: auto;
                }

                .logging-header {
                    display: flex;
                    justify-content: space-between;
                    gap: var(--spacing-lg);
                    align-items: flex-start;
                    flex-wrap: wrap;
                    margin-bottom: var(--spacing-lg);
                }

                .logging-subtitle {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                    margin-top: 4px;
                }

                .logging-controls {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    flex-wrap: wrap;
                }

                .logging-toggle {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                }

                .logging-toolbar {
                    display: flex;
                    gap: var(--spacing-md);
                    flex-wrap: wrap;
                    margin-bottom: var(--spacing-lg);
                }

                .logging-toolbar .form-input {
                    min-width: 220px;
                }

                .logging-error {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-md);
                    background: var(--error-bg);
                    color: var(--error);
                    border: 1px solid rgba(196, 69, 54, 0.2);
                    font-size: var(--font-size-sm);
                    margin-bottom: var(--spacing-md);
                }

                .logging-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .logging-entry {
                    padding: var(--spacing-md);
                    border-radius: var(--radius-lg);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    box-shadow: var(--shadow-sm);
                }

                .logging-entry-header {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--spacing-sm);
                    align-items: center;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }

                .logging-status {
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--font-size-xs);
                    background: var(--secondary-bg);
                }

                .logging-status.ok {
                    background: rgba(35, 161, 105, 0.15);
                    color: var(--success);
                }

                .logging-status.error {
                    background: rgba(196, 69, 54, 0.15);
                    color: var(--error);
                }

                .logging-method {
                    font-weight: var(--font-weight-semibold);
                }

                .logging-path {
                    color: var(--text-primary);
                    font-weight: var(--font-weight-medium);
                }

                .logging-duration {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .logging-time {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-left: auto;
                }

                .logging-payload {
                    margin-top: var(--spacing-sm);
                    padding: var(--spacing-sm);
                    background: var(--secondary-bg);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-xs);
                    color: var(--text-secondary);
                    overflow-x: auto;
                }

                .logging-empty {
                    padding: var(--spacing-lg);
                    border-radius: var(--radius-lg);
                    background: var(--secondary-bg);
                    color: var(--text-muted);
                    text-align: center;
                }
            `}</style>
        </div>
    );
}
