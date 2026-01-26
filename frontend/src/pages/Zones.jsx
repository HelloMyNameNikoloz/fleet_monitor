import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { Style, Fill, Stroke, Text } from 'ol/style';
import 'ol/ol.css';

const DEFAULT_CENTER = [12.4547, 51.3397];
const DEFAULT_COLOR = '#B88A2D';

const TYPE_COLORS = {
    restricted: '#C44536',
    warning: '#C58A17',
    safe: '#1C9C72'
};

export default function Zones() {
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [drawMode, setDrawMode] = useState(null);
    const [editingZoneId, setEditingZoneId] = useState(null);
    const [draftGeometry, setDraftGeometry] = useState(null);
    const [form, setForm] = useState({
        name: '',
        type: 'restricted',
        color: DEFAULT_COLOR,
        enabled: true
    });
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const zonesSourceRef = useRef(null);
    const draftSourceRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const historyRef = useRef([]);
    const redoRef = useRef([]);

    const updateHistoryFlags = () => {
        setCanUndo(historyRef.current.length > 1);
        setCanRedo(redoRef.current.length > 0);
    };

    const resetHistory = (geometry) => {
        historyRef.current = [geometry ? JSON.stringify(geometry) : null];
        redoRef.current = [];
        updateHistoryFlags();
    };

    const pushHistory = (geometry) => {
        const snapshot = geometry ? JSON.stringify(geometry) : null;
        const history = historyRef.current;
        if (history.length > 0 && history[history.length - 1] === snapshot) {
            return;
        }
        history.push(snapshot);
        redoRef.current = [];
        updateHistoryFlags();
    };

    const buildWarning = (geometry) => {
        if (!geometry) return '';
        if (geometry.type === 'polygon' && Array.isArray(geometry.coordinates)) {
            if (geometry.coordinates.length >= 4 && isSelfIntersecting(geometry.coordinates)) {
                return 'Warning: polygon self-intersects. Adjust points.';
            }
        }
        return '';
    };

    const setDraftState = (geometry, options = {}) => {
        const { push = true, reset = false } = options;
        setDraftGeometry(geometry);
        setWarning(buildWarning(geometry));
        if (reset) {
            resetHistory(geometry);
        } else if (push) {
            pushHistory(geometry);
        }
    };

    const setDraftFeature = (geometry) => {
        if (!draftSourceRef.current) return;
        draftSourceRef.current.clear();
        if (!geometry) return;
        const feature = toOlFeature(geometry);
        if (feature) {
            draftSourceRef.current.addFeature(feature);
        }
    };

    const applySnapshot = (snapshot) => {
        const geometry = snapshot ? JSON.parse(snapshot) : null;
        setDraftFeature(geometry);
        setDraftState(geometry, { push: false });
    };

    const undoDraft = () => {
        if (drawMode && drawInteractionRef.current && drawInteractionRef.current.removeLastPoint) {
            drawInteractionRef.current.removeLastPoint();
            return;
        }
        const history = historyRef.current;
        if (history.length <= 1) return;
        const current = history.pop();
        redoRef.current.push(current);
        updateHistoryFlags();
        applySnapshot(history[history.length - 1]);
    };

    const redoDraft = () => {
        if (redoRef.current.length === 0) return;
        const snapshot = redoRef.current.pop();
        historyRef.current.push(snapshot);
        updateHistoryFlags();
        applySnapshot(snapshot);
    };

    const loadZones = async () => {
        setLoading(true);
        try {
            const data = await api.getZones();
            setZones(data);
        } catch (error) {
            console.error('Failed to load zones:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadZones();
    }, []);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        zonesSourceRef.current = new VectorSource();
        draftSourceRef.current = new VectorSource();

        const zonesLayer = new VectorLayer({
            source: zonesSourceRef.current,
            style: (feature) => {
                const zoneType = feature.get('zoneType');
                const color = feature.get('color') || TYPE_COLORS[zoneType] || DEFAULT_COLOR;
                return new Style({
                    fill: new Fill({ color: `${color}1A` }),
                    stroke: new Stroke({ color, width: 2, lineDash: [8, 6] }),
                    text: new Text({
                        text: feature.get('name'),
                        font: '12px "Bricolage Grotesque", sans-serif',
                        fill: new Fill({ color }),
                        stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 3 })
                    })
                });
            }
        });

        const draftLayer = new VectorLayer({
            source: draftSourceRef.current,
            style: new Style({
                fill: new Fill({ color: 'rgba(184, 138, 45, 0.18)' }),
                stroke: new Stroke({ color: DEFAULT_COLOR, width: 2 })
            })
        });

        const map = new Map({
            target: mapRef.current,
            layers: [
                new TileLayer({
                    source: new OSM({
                        url: 'https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
                    })
                }),
                zonesLayer,
                draftLayer
            ],
            view: new View({
                center: fromLonLat(DEFAULT_CENTER),
                zoom: 15
            })
        });

        const modify = new Modify({ source: draftSourceRef.current });
        map.addInteraction(modify);
        modify.on('modifyend', () => {
            syncDraftFromSource();
        });

        const snap = new Snap({ source: draftSourceRef.current });
        map.addInteraction(snap);

        mapInstanceRef.current = map;

        return () => {
            map.setTarget(undefined);
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!zonesSourceRef.current) return;
        zonesSourceRef.current.clear();

        zones.forEach((zone) => {
            const geometry = parseZoneGeometry(zone.geometry);
            if (!geometry) return;

            const feature = toOlFeature(geometry);
            if (!feature) return;

            feature.set('zoneType', zone.type);
            feature.set('name', zone.name);
            feature.set('color', zone.color || TYPE_COLORS[zone.type]);
            feature.setId(zone.id);
            zonesSourceRef.current.addFeature(feature);
        });
    }, [zones]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const tagName = event.target?.tagName;
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
                return;
            }

            const key = event.key.toLowerCase();
            const isMeta = event.ctrlKey || event.metaKey;

            if (isMeta && key === 'z') {
                event.preventDefault();
                if (event.shiftKey) {
                    redoDraft();
                } else {
                    undoDraft();
                }
                return;
            }

            if (isMeta && key === 'y') {
                event.preventDefault();
                redoDraft();
                return;
            }

            if (key === 'escape') {
                clearDraft();
                return;
            }

            if (key === 'enter' && drawMode && drawInteractionRef.current?.finishDrawing) {
                drawInteractionRef.current.finishDrawing();
                return;
            }

            if ((key === 'backspace' || key === 'delete') && drawMode && drawInteractionRef.current?.removeLastPoint) {
                event.preventDefault();
                drawInteractionRef.current.removeLastPoint();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [drawMode]);

    const parseZoneGeometry = (geometry) => {
        if (!geometry) return null;
        if (typeof geometry === 'string') {
            try {
                return JSON.parse(geometry);
            } catch (error) {
                return null;
            }
        }
        return geometry;
    };

    const toOlFeature = (geometry) => {
        if (geometry.type === 'polygon' && Array.isArray(geometry.coordinates)) {
            const ring = geometry.coordinates.map(([lat, lon]) => fromLonLat([lon, lat]));
            if (ring.length > 2) {
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    ring.push(first);
                }
            }
            return new Feature({
                geometry: new Polygon([ring])
            });
        }

        if (geometry.type === 'circle' && geometry.center && geometry.radius) {
            const [lat, lon] = geometry.center;
            return new Feature({
                geometry: new Circle(fromLonLat([lon, lat]), geometry.radius)
            });
        }

        return null;
    };

    const deriveGeometryFromFeature = (feature) => {
        if (!feature) return null;
        const geometry = feature.getGeometry();
        if (geometry instanceof Circle) {
            const [lon, lat] = toLonLat(geometry.getCenter());
            return {
                type: 'circle',
                center: [lat, lon],
                radius: Math.round(geometry.getRadius())
            };
        }

        if (geometry instanceof Polygon) {
            const coords = geometry.getCoordinates()[0].map((coord) => {
                const [lon, lat] = toLonLat(coord);
                return [lat, lon];
            });
            if (coords.length > 1) {
                const first = coords[0];
                const last = coords[coords.length - 1];
                if (first[0] === last[0] && first[1] === last[1]) {
                    coords.pop();
                }
            }
            return { type: 'polygon', coordinates: coords };
        }

        return null;
    };

    const getDraftGeometry = () => {
        const sourceFeature = draftSourceRef.current?.getFeatures?.()[0];
        let geometry = deriveGeometryFromFeature(sourceFeature);

        if (!geometry && drawInteractionRef.current?.getOverlay) {
            const overlaySource = drawInteractionRef.current.getOverlay().getSource();
            const overlayFeature = overlaySource?.getFeatures?.()[0];
            geometry = deriveGeometryFromFeature(overlayFeature);
        }

        return geometry || draftGeometry;
    };

    const validateGeometry = (geometry) => {
        if (!geometry) return 'Draw a polygon or circle on the map first.';
        if (geometry.type === 'polygon') {
            if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 3) {
                return 'Finish the polygon with at least 3 points.';
            }
        }
        if (geometry.type === 'circle') {
            if (!Array.isArray(geometry.center) || !geometry.radius) {
                return 'Finish the circle before saving.';
            }
        }
        return '';
    };

    const syncDraftFromSource = () => {
        if (!draftSourceRef.current) return;
        const feature = draftSourceRef.current.getFeatures()[0];
        const geometry = deriveGeometryFromFeature(feature);
        setDraftState(geometry, { push: true });
    };

    const startDraw = (mode) => {
        if (!mapInstanceRef.current || !draftSourceRef.current) return;
        setError('');
        setDrawMode(mode);
        draftSourceRef.current.clear();
        setDraftState(null, { reset: true });

        if (drawInteractionRef.current) {
            mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }

        const drawType = mode === 'circle' ? 'Circle' : 'Polygon';
        const draw = new Draw({
            source: draftSourceRef.current,
            type: drawType
        });

        draw.on('drawstart', () => {
            draftSourceRef.current.clear();
        });

        draw.on('drawend', () => {
            drawInteractionRef.current = null;
            mapInstanceRef.current.removeInteraction(draw);
            setDrawMode(null);
            syncDraftFromSource();
        });

        drawInteractionRef.current = draw;
        mapInstanceRef.current.addInteraction(draw);
    };

    const clearDraft = () => {
        if (drawInteractionRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (draftSourceRef.current) {
            draftSourceRef.current.clear();
        }
        setDrawMode(null);
        setDraftState(null, { reset: true });
    };

    const focusAllZones = () => {
        if (!mapInstanceRef.current || !zonesSourceRef.current) return;
        if (zonesSourceRef.current.getFeatures().length === 0) return;
        const extent = zonesSourceRef.current.getExtent();
        if (!extent) return;
        mapInstanceRef.current.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 300 });
    };

    const focusDraft = () => {
        if (!mapInstanceRef.current || !draftSourceRef.current) return;
        if (draftSourceRef.current.getFeatures().length === 0) return;
        const extent = draftSourceRef.current.getExtent();
        if (!extent) return;
        mapInstanceRef.current.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 300 });
    };

    const handleToggle = async (zone) => {
        try {
            await api.updateZone(zone.id, { enabled: !zone.enabled });
            loadZones();
        } catch (error) {
            console.error('Failed to toggle zone:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this zone?')) return;
        try {
            await api.deleteZone(id);
            loadZones();
            if (editingZoneId === id) {
                resetEditor();
            }
        } catch (error) {
            console.error('Failed to delete zone:', error);
        }
    };

    const resetEditor = () => {
        setEditingZoneId(null);
        setError('');
        setWarning('');
        setForm({
            name: '',
            type: 'restricted',
            color: DEFAULT_COLOR,
            enabled: true
        });
        clearDraft();
    };

    const handleEdit = (zone) => {
        setError('');
        const geometry = parseZoneGeometry(zone.geometry);
        if (!geometry) {
            setError('Zone geometry is invalid.');
            return;
        }

        if (drawInteractionRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }

        setEditingZoneId(zone.id);
        setForm({
            name: zone.name,
            type: zone.type,
            color: zone.color || TYPE_COLORS[zone.type] || DEFAULT_COLOR,
            enabled: zone.enabled
        });

        setDraftFeature(geometry);
        setDraftState(geometry, { reset: true });
        setDrawMode(null);
        focusDraft();
    };

    const handleSave = async () => {
        setError('');
        if (!form.name.trim()) {
            setError('Zone name is required.');
            return;
        }
        if (drawMode && drawInteractionRef.current?.finishDrawing) {
            try {
                drawInteractionRef.current.finishDrawing();
            } catch (error) {
                console.warn('Unable to finish drawing:', error);
            }
        }

        const geometryToSave = getDraftGeometry();
        const validationMessage = validateGeometry(geometryToSave);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        setDraftState(geometryToSave, { push: true });

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                type: form.type,
                color: form.color,
                enabled: form.enabled,
                geometry: geometryToSave
            };

            if (editingZoneId) {
                await api.updateZone(editingZoneId, payload);
            } else {
                await api.createZone(payload);
            }

            await loadZones();
            resetEditor();
        } catch (error) {
            console.error('Failed to save zone:', error);
            setError('Failed to save zone.');
        } finally {
            setSaving(false);
        }
    };

    const geometrySummary = () => {
        const geometry = getDraftGeometry();
        if (!geometry) return 'No geometry drawn';
        if (geometry.type === 'circle') {
            return `Circle - ${Math.round(geometry.radius)}m radius`;
        }
        if (geometry.type === 'polygon') {
            return `Polygon - ${geometry.coordinates.length} points`;
        }
        return 'Geometry ready';
    };

    return (
        <div className="page-container">
            <div className="zones-page">
                <div className="zones-header">
                    <div>
                        <h2>Geofence Zones</h2>
                        <p className="zones-subtitle">Create and manage restricted, warning, and safe zones.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={resetEditor}>
                        New Zone
                    </button>
                </div>

                <div className="zones-content">
                    <div className="zones-map-panel">
                        <div ref={mapRef} className="zones-map" />
                        <div className="zones-map-tools">
                            <div className="zones-map-tools-title">Draw Tools</div>
                            <button
                                className={`btn btn-secondary btn-sm ${drawMode === 'polygon' ? 'active' : ''}`}
                                onClick={() => startDraw('polygon')}
                            >
                                Draw Polygon
                            </button>
                            <button
                                className={`btn btn-secondary btn-sm ${drawMode === 'circle' ? 'active' : ''}`}
                                onClick={() => startDraw('circle')}
                            >
                                Draw Circle
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={clearDraft}>
                                Clear Draft
                            </button>
                            <div className="zones-map-divider" />
                            <button className="btn btn-ghost btn-sm" onClick={undoDraft} disabled={!canUndo}>
                                Undo
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={redoDraft} disabled={!canRedo}>
                                Redo
                            </button>
                            <div className="zones-map-divider" />
                            <button className="btn btn-ghost btn-sm" onClick={focusDraft}>
                                Focus Draft
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={focusAllZones}>
                                Fit All Zones
                            </button>
                            <div className="zones-map-shortcuts">
                                <span>Ctrl+Z Undo</span>
                                <span>Ctrl+Y Redo</span>
                                <span>Enter Finish</span>
                                <span>Esc Clear</span>
                            </div>
                        </div>
                        <div className="zones-map-hint">
                            {geometrySummary()}
                        </div>
                        {warning && <div className="zones-warning">{warning}</div>}
                    </div>

                    <div className="zones-list-panel">
                        <div className="zones-editor">
                            <div className="zones-editor-header">
                                <h3>{editingZoneId ? 'Edit Zone' : 'Create Zone'}</h3>
                                {editingZoneId && (
                                    <span className="badge badge-info">Editing</span>
                                )}
                            </div>

                            {error && <div className="zones-error">{error}</div>}

                            <div className="form-group">
                                <label className="form-label">Zone Name</label>
                                <input
                                    className="form-input"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Restricted Area A"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Zone Type</label>
                                <select
                                    className="form-input"
                                    value={form.type}
                                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                                >
                                    <option value="restricted">Restricted</option>
                                    <option value="warning">Warning</option>
                                    <option value="safe">Safe</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Color</label>
                                    <div className="color-input">
                                        <input
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                                        />
                                        <span>{form.color}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Enabled</label>
                                    <div
                                        className={`toggle ${form.enabled ? 'active' : ''}`}
                                        onClick={() => setForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                                    >
                                        <div className="toggle-handle" />
                                    </div>
                                </div>
                            </div>

                            <div className="zones-editor-actions">
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : editingZoneId ? 'Update Zone' : 'Save Zone'}
                                </button>
                                {editingZoneId && (
                                    <button className="btn btn-ghost" onClick={resetEditor}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="zones-divider" />

                        <h3>Saved Zones</h3>

                        {loading ? (
                            <div className="zones-loading">
                                <span className="spinner"></span>
                            </div>
                        ) : zones.length === 0 ? (
                            <div className="zones-empty">
                                <p>No zones defined yet.</p>
                            </div>
                        ) : (
                            <div className="zones-list">
                                {zones.map(zone => (
                                    <div key={zone.id} className="zone-card">
                                        <div
                                            className="zone-color"
                                            style={{ background: zone.color || TYPE_COLORS[zone.type] }}
                                        />
                                        <div className="zone-info">
                                            <div className="zone-name">{zone.name}</div>
                                            <div className="zone-type">
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: `${TYPE_COLORS[zone.type]}20`,
                                                        color: TYPE_COLORS[zone.type]
                                                    }}
                                                >
                                                    {zone.type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="zone-actions">
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                onClick={() => handleEdit(zone)}
                                                title="Edit zone"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                </svg>
                                            </button>
                                            <div
                                                className={`toggle ${zone.enabled ? 'active' : ''}`}
                                                onClick={() => handleToggle(zone)}
                                            >
                                                <div className="toggle-handle" />
                                            </div>
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                onClick={() => handleDelete(zone.id)}
                                                title="Delete zone"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .zones-page {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: var(--spacing-2xl);
                    gap: var(--spacing-lg);
                    overflow: hidden;
                }

                .zones-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .zones-header h2 {
                    font-size: var(--font-size-2xl);
                    letter-spacing: 0.01em;
                }

                .zones-subtitle {
                    color: var(--text-muted);
                    font-size: var(--font-size-sm);
                    margin-top: var(--spacing-xs);
                }

                .zones-content {
                    flex: 1;
                    display: flex;
                    gap: var(--spacing-xl);
                    overflow: hidden;
                }

                .zones-map-panel {
                    flex: 1;
                    position: relative;
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }

                .zones-map {
                    width: 100%;
                    height: 100%;
                }

                .zones-map .ol-zoom,
                .zones-map .ol-attribution {
                    display: none;
                }

                .zones-map-tools {
                    position: absolute;
                    top: var(--spacing-lg);
                    left: var(--spacing-lg);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-md);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md);
                    min-width: 160px;
                }

                .zones-map-tools-title {
                    font-size: var(--font-size-xs);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-muted);
                }

                .zones-map-divider {
                    height: 1px;
                    background: var(--border-subtle);
                    margin: var(--spacing-xs) 0;
                }

                .zones-map-hint {
                    position: absolute;
                    bottom: var(--spacing-lg);
                    left: var(--spacing-lg);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-sm);
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .zones-warning {
                    position: absolute;
                    bottom: var(--spacing-lg);
                    right: var(--spacing-lg);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--warning-bg);
                    color: var(--warning);
                    border: 1px solid rgba(197, 138, 23, 0.25);
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-sm);
                    font-size: var(--font-size-xs);
                }

                .zones-map-shortcuts {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: var(--spacing-xs);
                }

                .zones-list-panel {
                    width: 440px;
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: var(--spacing-xl);
                    overflow-y: auto;
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xl);
                }

                .zones-editor-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .zones-editor-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .zones-map-tools .btn.active {
                    border-color: var(--primary-color);
                    box-shadow: var(--shadow-sm);
                }

                .zones-error {
                    background: var(--error-bg);
                    color: var(--error);
                    border: 1px solid rgba(196, 69, 54, 0.2);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                }

                .form-row {
                    display: flex;
                    gap: var(--spacing-lg);
                    align-items: center;
                }

                .color-input {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .color-input input {
                    width: 40px;
                    height: 32px;
                    border: none;
                    background: transparent;
                }

                .zones-divider {
                    height: 1px;
                    background: var(--border-subtle);
                }

                .zones-loading,
                .zones-empty {
                    padding: var(--spacing-xl);
                    text-align: center;
                    color: var(--text-muted);
                }

                .zones-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .zone-card {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding: var(--spacing-lg);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                }

                .zone-color {
                    width: 8px;
                    height: 40px;
                    border-radius: var(--radius-sm);
                }

                .zone-info {
                    flex: 1;
                }

                .zone-name {
                    font-weight: var(--font-weight-medium);
                    margin-bottom: 2px;
                }

                .zone-actions {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }
            `}</style>
        </div>
    );
}

function isSelfIntersecting(coords) {
    const points = coords.map(([lat, lon]) => ({ x: lon, y: lat }));
    if (points.length < 4) return false;

    const segments = points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return { a: point, b: next };
    });

    for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
            if (Math.abs(i - j) <= 1) continue;
            if (i === 0 && j === segments.length - 1) continue;
            if (segmentsIntersect(segments[i].a, segments[i].b, segments[j].a, segments[j].b)) {
                return true;
            }
        }
    }

    return false;
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

function orientation(p, q, r) {
    const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
    return (
        q.x <= Math.max(p.x, r.x) + 1e-12 &&
        q.x >= Math.min(p.x, r.x) - 1e-12 &&
        q.y <= Math.max(p.y, r.y) + 1e-12 &&
        q.y >= Math.min(p.y, r.y) - 1e-12
    );
}
