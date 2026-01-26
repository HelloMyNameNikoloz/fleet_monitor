export default function MapStyles() {
    return (
        <style>{`
            .ol-map {
                width: 100%;
                height: 100%;
            }

            .ol-map .ol-zoom,
            .ol-map .ol-attribution {
                display: none;
            }

            .map-focus-bar {
                position: absolute;
                top: var(--spacing-md);
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
                padding: var(--spacing-sm) var(--spacing-md);
                background: var(--base-surface);
                border: 1px solid var(--border-subtle);
                border-radius: var(--radius-full);
                box-shadow: var(--shadow-md);
                z-index: 12;
            }

            .map-focus-title {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
            }

            .map-focus-actions {
                display: flex;
                gap: var(--spacing-xs);
            }

            .map-focus-empty {
                color: var(--text-muted);
                font-size: var(--font-size-sm);
            }

            .map-controls {
                align-items: center;
            }

            .map-controls-divider {
                height: 1px;
                background: var(--border-subtle);
                margin: var(--spacing-xs) 0;
            }

            .map-add-panel {
                position: absolute;
                left: calc(var(--spacing-lg) + 8px);
                bottom: var(--spacing-lg);
                width: 240px;
                display: flex;
                flex-direction: column;
                gap: var(--spacing-sm);
                padding: var(--spacing-md);
                background: var(--base-surface);
                border: 1px solid var(--border-subtle);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
                z-index: 12;
            }

            .map-add-title {
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
            }

            .map-add-actions {
                display: flex;
                gap: var(--spacing-xs);
            }

            .map-add-error {
                font-size: var(--font-size-xs);
                color: var(--error);
            }

            .map-add-hint {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }

            .map-route-pill {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 6px 10px;
                border-radius: var(--radius-md);
                background: var(--secondary-bg);
                border: 1px solid var(--border-subtle);
                font-size: var(--font-size-xs);
                text-transform: uppercase;
                letter-spacing: 0.08em;
            }

            .map-route-pill .label {
                color: var(--text-muted);
            }

            .map-route-pill .value {
                font-weight: var(--font-weight-semibold);
                color: var(--text-secondary);
            }

            .map-route-pill .value.active {
                color: var(--success);
            }

            .map-hover-card {
                position: absolute;
                background: var(--base-surface);
                border: 1px solid var(--border-subtle);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-md);
                padding: var(--spacing-sm) var(--spacing-md);
                z-index: 15;
                pointer-events: none;
                min-width: 180px;
            }

            .map-hover-title {
                font-weight: var(--font-weight-semibold);
                margin-bottom: 2px;
                color: var(--text-primary);
            }

            .map-hover-meta {
                font-size: var(--font-size-xs);
                color: var(--text-muted);
            }
        `}</style>
    );
}
