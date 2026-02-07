import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../utils/api';
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
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style';
import 'ol/ol.css';

const DEFAULT_CENTER = [12.4547, 51.3397];

export default function PatrolRouteEditor({
    open,
    onClose,
    robots = [],
    zones = [],
    initialRobotId = null,
    onSaved = () => {}
}) {
    const mapRef = useRef(null);
    const controlsRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const routeSourceRef = useRef(null);
    const robotSourceRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const modifyInteractionRef = useRef(null);
    const snapInteractionRef = useRef(null);

    const [selectedRobotId, setSelectedRobotId] = useState(initialRobotId || '');
    const [draftWaypoints, setDraftWaypoints] = useState([]);
    const [drawMode, setDrawMode] = useState(false);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [zoneOffsetMeters, setZoneOffsetMeters] = useState(1);
    const [routes, setRoutes] = useState([]);
    const [editingRouteId, setEditingRouteId] = useState(null);
    const [routeName, setRouteName] = useState('');
    const [routeDirection, setRouteDirection] = useState('cw');
    const [activateOnSave, setActivateOnSave] = useState(true);
    const [manualDraft, setManualDraft] = useState(false);
    const [newRouteMode, setNewRouteMode] = useState(false);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [mapReady, setMapReady] = useState(false);
    const centerPendingRef = useRef(false);

    const selectedRobot = useMemo(
        () => robots.find((robot) => Number(robot.id) === Number(selectedRobotId)),
        [robots, selectedRobotId]
    );

    const activeRoute = useMemo(
        () => routes.find((route) => route.is_active),
        [routes]
    );

    const hasRouteContext = Boolean(editingRouteId || newRouteMode);
    const hasDraft = draftWaypoints.length >= 2;

    const refreshRoutes = async (robotId) => {
        if (!robotId) return;
        setLoadingRoutes(true);
        try {
            const data = await api.getPatrolRoutes(robotId);
            setRoutes(Array.isArray(data) ? data : []);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Failed to load patrol routes:', err);
            setRoutes([]);
            return [];
        } finally {
            setLoadingRoutes(false);
        }
    };

    const loadRouteIntoDraft = (route) => {
        const normalized = normalizeWaypoints(route?.waypoints);
        setDraftWaypoints(normalized);
        setRouteFeature(normalized);
        setEditingRouteId(route?.id || null);
        setRouteName(route?.name || '');
        setRouteDirection(route?.direction || 'cw');
        setActivateOnSave(Boolean(route?.is_active));
        setManualDraft(false);
        setNewRouteMode(false);
        setError('');
        if (controlsRef.current) {
            controlsRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const centerSelectedRobotOnce = (robot) => {
        if (!centerPendingRef.current) return;
        if (!mapInstanceRef.current || !robot) return;
        if (Number(robot.id) !== Number(selectedRobotId)) return;
        const lat = Number(robot.lat);
        const lon = Number(robot.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        mapInstanceRef.current.getView().animate({
            center: fromLonLat([lon, lat]),
            zoom: 15,
            duration: 300
        });
        centerPendingRef.current = false;
    };

    const initializedSelectionRef = useRef(false);

    useEffect(() => {
        if (!open) {
            initializedSelectionRef.current = false;
            return;
        }
        if (initializedSelectionRef.current) return;

        if (initialRobotId) {
            setSelectedRobotId(initialRobotId);
        } else if (!selectedRobotId && robots.length > 0) {
            setSelectedRobotId(robots[0].id);
        }

        initializedSelectionRef.current = true;
    }, [open, initialRobotId, robots, selectedRobotId]);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        routeSourceRef.current = new VectorSource();
        robotSourceRef.current = new VectorSource();

        const routeLayer = new VectorLayer({
            source: routeSourceRef.current,
            style: new Style({
                stroke: new Stroke({ color: '#2F6FDB', width: 3 }),
                image: new CircleStyle({
                    radius: 4,
                    fill: new Fill({ color: '#2F6FDB' }),
                    stroke: new Stroke({ color: '#FFFFFF', width: 2 })
                })
            })
        });

        const robotLayer = new VectorLayer({
            source: robotSourceRef.current,
            style: new Style({
                image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: '#B88A2D' }),
                    stroke: new Stroke({ color: '#FFFFFF', width: 2 })
                })
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
                robotLayer,
                routeLayer
            ],
            view: new View({
                center: fromLonLat(DEFAULT_CENTER),
                zoom: 14
            })
        });

        modifyInteractionRef.current = new Modify({ source: routeSourceRef.current });
        modifyInteractionRef.current.on('modifyend', () => {
            syncDraftFromSource();
        });
        map.addInteraction(modifyInteractionRef.current);

        snapInteractionRef.current = new Snap({ source: routeSourceRef.current });
        map.addInteraction(snapInteractionRef.current);

        mapInstanceRef.current = map;
        setMapReady(true);

        return () => {
            map.setTarget(undefined);
            mapInstanceRef.current = null;
            setMapReady(false);
        };
    }, []);

    const previousRobotIdRef = useRef(null);

    useEffect(() => {
        if (!routeSourceRef.current || !mapReady) return;
        if (previousRobotIdRef.current === selectedRobotId) {
            return;
        }
        previousRobotIdRef.current = selectedRobotId;

        if (!selectedRobotId) {
            routeSourceRef.current.clear();
            robotSourceRef.current?.clear();
            setDraftWaypoints([]);
            setRoutes([]);
            setEditingRouteId(null);
            setRouteName('');
            setRouteDirection('cw');
            setActivateOnSave(true);
            setManualDraft(false);
            setNewRouteMode(false);
            centerPendingRef.current = false;
            return;
        }

        centerPendingRef.current = true;
        setError('');
        setSelectedZoneId('');
        setEditingRouteId(null);
        setRouteName('');
        setRouteDirection('cw');
        setActivateOnSave(true);
        setManualDraft(false);
        setNewRouteMode(false);
        setDraftWaypoints([]);
        setRouteFeature([]);
        refreshRoutes(selectedRobotId);

        centerSelectedRobotOnce(selectedRobot);
    }, [selectedRobotId, selectedRobot, mapReady]);

    useEffect(() => {
        if (!mapReady) return;
        robotSourceRef.current?.clear();
        if (selectedRobot) {
            const lat = Number(selectedRobot.lat);
            const lon = Number(selectedRobot.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            const feature = new Feature({
                geometry: new Point(fromLonLat([lon, lat]))
            });
            robotSourceRef.current?.addFeature(feature);
            centerSelectedRobotOnce(selectedRobot);
        }
    }, [selectedRobot, mapReady]);

    useEffect(() => {
        if (!mapReady || !selectedRobot) return;
        if (editingRouteId) {
            const route = routes.find((item) => item.id === editingRouteId);
            if (!route) {
                setEditingRouteId(null);
            }
            return;
        }
        if (!manualDraft && activeRoute) {
            loadRouteIntoDraft(activeRoute);
            return;
        }
        if (!manualDraft) {
            setDraftWaypoints([]);
            setRouteFeature([]);
            setRouteName('');
            setRouteDirection('cw');
            setActivateOnSave(true);
        }
    }, [activeRoute, routes, editingRouteId, mapReady, selectedRobot, manualDraft]);

    const setRouteFeature = (waypoints) => {
        if (!routeSourceRef.current) return;
        routeSourceRef.current.clear();
        if (!waypoints || waypoints.length < 2) return;
        const coords = waypoints.map((point) => fromLonLat([point.lon, point.lat]));
        if (coords.length > 2) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push(first);
            }
        }
        const feature = new Feature({
            geometry: new LineString(coords)
        });
        routeSourceRef.current.addFeature(feature);
    };

    const syncDraftFromSource = () => {
        if (!routeSourceRef.current) return;
        const feature = routeSourceRef.current.getFeatures()[0];
        const geometry = feature?.getGeometry();
        if (!geometry) return;
        let coords = [];
        if (geometry instanceof LineString) {
            coords = geometry.getCoordinates();
        } else if (geometry instanceof Polygon) {
            coords = geometry.getCoordinates()[0] || [];
        } else {
            return;
        }
        const points = coords.map((coord) => {
            const [lon, lat] = toLonLat(coord);
            return { lat, lon };
        });
        if (points.length > 1) {
            const first = points[0];
            const last = points[points.length - 1];
            if (first.lat === last.lat && first.lon === last.lon) {
                points.pop();
            }
        }
        setDraftWaypoints(points);
        setRouteFeature(points);
        setManualDraft(true);
    };

    const startDraw = () => {
        if (!mapInstanceRef.current || !routeSourceRef.current) return;
        if (!editingRouteId && !newRouteMode) {
            setError('Press "New Route" to start a fresh route.');
            return;
        }
        setError('');
        setDrawMode(true);
        setManualDraft(true);
        routeSourceRef.current.clear();

        if (drawInteractionRef.current) {
            mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
        }

        const draw = new Draw({
            source: routeSourceRef.current,
            type: 'Polygon',
            snapTolerance: 20
        });

        draw.on('drawstart', () => {
            routeSourceRef.current.clear();
        });

        draw.on('drawend', (event) => {
            const geometry = event.feature?.getGeometry();
            if (geometry instanceof Polygon) {
                const ring = geometry.getCoordinates()[0] || [];
                const points = ring
                    .map((coord) => {
                        const [lon, lat] = toLonLat(coord);
                        return { lat, lon };
                    })
                    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
                if (points.length > 1) {
                    const first = points[0];
                    const last = points[points.length - 1];
                    if (first.lat === last.lat && first.lon === last.lon) {
                        points.pop();
                    }
                }
                setDraftWaypoints(points);
                setRouteFeature(points);
                setManualDraft(true);
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.removeInteraction(draw);
            }
            drawInteractionRef.current = null;
            setDrawMode(false);
        });

        drawInteractionRef.current = draw;
        mapInstanceRef.current.addInteraction(draw);
    };

    const clearDraft = () => {
        routeSourceRef.current?.clear();
        setDraftWaypoints([]);
        setError('');
    };

    const startNewRoute = () => {
        clearDraft();
        setEditingRouteId(null);
        setRouteName('');
        setRouteDirection('cw');
        setActivateOnSave(true);
        setManualDraft(true);
        setNewRouteMode(true);
        setError('');
        if (controlsRef.current) {
            controlsRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const saveRoute = async () => {
        if (!selectedRobotId) {
            setError('Select a robot first.');
            return;
        }
        if (!draftWaypoints || draftWaypoints.length < 2) {
            setError('Draw at least 2 waypoints to save.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            if (editingRouteId) {
                await api.updatePatrolRoute(selectedRobotId, editingRouteId, {
                    name: routeName,
                    waypoints: draftWaypoints,
                    direction: routeDirection,
                    isActive: activateOnSave
                });
            } else {
                const created = await api.createPatrolRoute(selectedRobotId, {
                    name: routeName,
                    waypoints: draftWaypoints,
                    direction: routeDirection,
                    isActive: activateOnSave
                });
                if (created?.id) {
                    setEditingRouteId(created.id);
                }
            }
            await refreshRoutes(selectedRobotId);
            await onSaved();
        } catch (err) {
            console.error('Failed to save route:', err);
            setError('Failed to save route.');
        } finally {
            setSaving(false);
        }
    };

    const activateRoute = async (routeId) => {
        if (!selectedRobotId || !routeId) return;
        setSaving(true);
        setError('');
        try {
            await api.activatePatrolRoute(selectedRobotId, routeId);
            const updatedRoutes = await refreshRoutes(selectedRobotId);
            const activated = updatedRoutes?.find((route) => route.id === routeId);
            if (activated) {
                loadRouteIntoDraft(activated);
            }
            await onSaved();
        } catch (err) {
            console.error('Failed to activate route:', err);
            setError('Failed to activate route.');
        } finally {
            setSaving(false);
        }
    };

    const deleteRoute = async (routeId) => {
        if (!selectedRobotId || !routeId) return;
        setSaving(true);
        setError('');
        try {
            await api.deletePatrolRoute(selectedRobotId, routeId);
            if (editingRouteId === routeId) {
                startNewRoute();
            }
            await refreshRoutes(selectedRobotId);
            await onSaved();
        } catch (err) {
            console.error('Failed to delete route:', err);
            setError('Failed to delete route.');
        } finally {
            setSaving(false);
        }
    };

    const clearPatrol = async () => {
        if (!selectedRobotId) return;
        setSaving(true);
        setError('');
        try {
            await api.clearPatrolPath(selectedRobotId);
            await refreshRoutes(selectedRobotId);
            await onSaved();
        } catch (err) {
            console.error('Failed to clear patrol:', err);
            setError('Failed to clear patrol.');
        } finally {
            setSaving(false);
        }
    };

    const generateFromZone = async () => {
        if (!selectedRobotId || !selectedZoneId) return;
        setSaving(true);
        setError('');
        try {
            const waypoints = await api.generatePatrolFromZone(selectedRobotId, selectedZoneId, zoneOffsetMeters);
            const normalized = normalizeWaypoints(waypoints);
            setDraftWaypoints(normalized);
            setRouteFeature(normalized);
            setEditingRouteId(null);
            setManualDraft(true);
            setNewRouteMode(true);
            await onSaved();
        } catch (err) {
            console.error('Failed to generate patrol:', err);
            setError('Failed to generate route.');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="modal-overlay">
            <div className="modal patrol-editor-modal">
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">Patrol Route Editor</h3>
                        <p className="patrol-editor-subtitle">Draw a waypoint loop on a clean map.</p>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body patrol-editor-body">
                    <div className="patrol-editor-map-panel">
                        <div ref={mapRef} className="patrol-editor-map" />
                        <div className="patrol-editor-hint">
                            {drawMode ? 'Drawing... click the first point to finish.' : 'Click "Draw Route" to start.'}
                        </div>
                    </div>

                    <div className="patrol-editor-controls" ref={controlsRef}>
                        {error && <div className="patrol-editor-error">{error}</div>}

                        <div className="patrol-editor-guide">
                            <div className="patrol-guide-header">
                                Route Builder
                                <span className="patrol-guide-status">
                                    {hasDraft ? 'Ready to save' : hasRouteContext ? 'Drawing' : 'Start a new route'}
                                </span>
                            </div>
                            <div className="patrol-guide-steps">
                                <div className={`patrol-guide-step ${selectedRobotId ? 'done' : ''}`}>
                                    <span className="step-index">1</span>
                                    <div>
                                        <div className="step-title">Choose robot</div>
                                        <div className="step-subtitle">{selectedRobot ? selectedRobot.name : 'Select a robot'}</div>
                                    </div>
                                </div>
                                <div className={`patrol-guide-step ${hasRouteContext ? 'done' : ''}`}>
                                    <span className="step-index">2</span>
                                    <div>
                                        <div className="step-title">Start a route</div>
                                        <div className="step-subtitle">{editingRouteId ? 'Editing existing' : newRouteMode ? 'New route started' : 'Press “New Route”'}</div>
                                    </div>
                                </div>
                                <div className={`patrol-guide-step ${hasDraft ? 'done' : ''}`}>
                                    <span className="step-index">3</span>
                                    <div>
                                        <div className="step-title">Draw loop</div>
                                        <div className="step-subtitle">{hasDraft ? `${draftWaypoints.length} points` : 'Click “Draw Route”'}</div>
                                    </div>
                                </div>
                                <div className={`patrol-guide-step ${hasDraft ? 'ready' : ''}`}>
                                    <span className="step-index">4</span>
                                    <div>
                                        <div className="step-title">Save & activate</div>
                                        <div className="step-subtitle">{hasDraft ? 'Save when ready' : 'Needs a loop'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="patrol-guide-tip">Tip: click the first point to snap & finish.</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Robot</label>
                            <select
                                className="form-input"
                                value={selectedRobotId}
                                onChange={(event) => setSelectedRobotId(event.target.value)}
                            >
                                {robots.length === 0 && <option value="">No robots</option>}
                                {robots.map((robot) => (
                                    <option key={robot.id} value={robot.id}>
                                        {robot.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="patrol-editor-actions patrol-editor-actions-primary">
                            <button className="btn btn-primary" onClick={startNewRoute}>
                                New Route
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Route Name</label>
                            <input
                                className="form-input"
                                type="text"
                                value={routeName}
                                onChange={(event) => setRouteName(event.target.value)}
                                placeholder={editingRouteId || newRouteMode ? 'Patrol Route' : 'Press "New Route" to start'}
                                disabled={!editingRouteId && !newRouteMode}
                            />
                            {!editingRouteId && !newRouteMode && (
                                <div className="patrol-editor-hint-text">Press "New Route" to start a fresh route.</div>
                            )}
                            {(editingRouteId || newRouteMode) && (
                                <div className="patrol-editor-hint-text">Give it a name your team will recognize.</div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Direction</label>
                            <div className="patrol-direction-toggle">
                                <button
                                    type="button"
                                    className={`patrol-direction-btn ${routeDirection === 'cw' ? 'active' : ''}`}
                                    onClick={() => setRouteDirection('cw')}
                                >
                                    Clockwise
                                </button>
                                <button
                                    type="button"
                                    className={`patrol-direction-btn ${routeDirection === 'ccw' ? 'active' : ''}`}
                                    onClick={() => setRouteDirection('ccw')}
                                >
                                    Counterclockwise
                                </button>
                            </div>
                        </div>

                        <div className="toggle-container patrol-activate-toggle">
                            <span>Activate on save</span>
                            <button
                                type="button"
                                className={`toggle ${activateOnSave ? 'active' : ''}`}
                                onClick={() => setActivateOnSave((prev) => !prev)}
                            >
                                <div className="toggle-handle" />
                            </button>
                        </div>

                        <div className="patrol-editor-stats">
                            <div>
                                <span className="label">Waypoints</span>
                                <span>{draftWaypoints.length}</span>
                            </div>
                            <div>
                                <span className="label">Status</span>
                                <span>{draftWaypoints.length >= 2 ? 'Ready' : 'Draft'}</span>
                            </div>
                        </div>

                        <div className="patrol-editor-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={startDraw}
                                disabled={drawMode || (!editingRouteId && !newRouteMode)}
                            >
                                Draw Route
                            </button>
                            <button className="btn btn-ghost" onClick={clearDraft}>
                                Clear Draft
                            </button>
                        </div>

                        <div className="patrol-editor-actions">
                            <button
                                className="btn btn-primary"
                                onClick={saveRoute}
                                disabled={saving || draftWaypoints.length < 2 || (!editingRouteId && !newRouteMode)}
                            >
                                {saving ? 'Saving...' : editingRouteId ? 'Update Route' : 'Save Route'}
                            </button>
                            <button className="btn btn-ghost" onClick={clearPatrol} disabled={saving}>
                                Clear Patrol
                            </button>
                        </div>

                        <div className="patrol-editor-zone">
                            <label className="form-label">Generate From Zone</label>
                            <div className="patrol-editor-zone-offset">
                                <span className="patrol-editor-offset-label">Offset</span>
                                <div className="patrol-editor-offset-row">
                                    <input
                                        className="patrol-editor-offset-input"
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={zoneOffsetMeters}
                                        onChange={(event) => setZoneOffsetMeters(parseFloat(event.target.value))}
                                    />
                                    <span className="patrol-editor-offset-value">{zoneOffsetMeters.toFixed(1)} m</span>
                                </div>
                            </div>
                            <div className="patrol-editor-zone-row">
                                <select
                                    className="form-input"
                                    value={selectedZoneId}
                                    onChange={(event) => setSelectedZoneId(event.target.value)}
                                >
                                    <option value="">Select zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.name}
                                        </option>
                                    ))}
                                </select>
                                <button className="btn btn-secondary" onClick={generateFromZone} disabled={!selectedZoneId || saving}>
                                    Generate
                                </button>
                            </div>
                        </div>

                        <div className="patrol-editor-routes">
                            <div className="patrol-editor-routes-header">
                                <span>Saved Routes</span>
                                <span className="patrol-editor-routes-count">
                                    {loadingRoutes ? 'Loading' : routes.length}
                                </span>
                            </div>

                            {loadingRoutes ? (
                                <div className="patrol-editor-routes-empty">Loading routes...</div>
                            ) : routes.length === 0 ? (
                                <div className="patrol-editor-routes-empty">No routes saved yet.</div>
                            ) : (
                                <div className="patrol-editor-route-list">
                                    {routes.map((route) => {
                                        const waypointCount = normalizeWaypoints(route.waypoints).length;
                                        const isActive = Boolean(route.is_active);
                                        const isSelected = Number(route.id) === Number(editingRouteId);
                                        return (
                                            <div
                                                key={route.id}
                                                className={`patrol-editor-route ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                                                onClick={() => loadRouteIntoDraft(route)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        loadRouteIntoDraft(route);
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <div className="patrol-editor-route-name">
                                                        {route.name}
                                                        {isActive && <span className="patrol-editor-route-badge">Active</span>}
                                                    </div>
                                                    <div className="patrol-editor-route-meta">
                                                        {waypointCount} pts | {route.direction === 'ccw' ? 'Counterclockwise' : 'Clockwise'}
                                                    </div>
                                                </div>
                                                <div className="patrol-editor-route-actions">
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            loadRouteIntoDraft(route);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    {!isActive && (
                                                        <button
                                                            className="btn btn-secondary btn-xs"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                activateRoute(route.id);
                                                            }}
                                                            disabled={saving}
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            deleteRoute(route.id);
                                                        }}
                                                        disabled={saving}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>

            <style>{`
                .patrol-editor-modal {
                    max-width: 1040px;
                    width: 100%;
                }

                .patrol-editor-subtitle {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                    margin-top: 4px;
                }

                .patrol-editor-body {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 320px;
                    gap: var(--spacing-lg);
                }

                .patrol-editor-map-panel {
                    position: relative;
                    height: 520px;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid var(--border-subtle);
                    box-shadow: var(--shadow-sm);
                }

                .patrol-editor-map {
                    width: 100%;
                    height: 100%;
                }

                .patrol-editor-map .ol-zoom,
                .patrol-editor-map .ol-attribution {
                    display: none;
                }

                .patrol-editor-hint {
                    position: absolute;
                    bottom: var(--spacing-md);
                    left: var(--spacing-md);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-full);
                    box-shadow: var(--shadow-sm);
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .patrol-editor-controls {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                    max-height: 520px;
                    overflow-y: auto;
                    padding-right: 6px;
                }

                .patrol-editor-error {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-md);
                    background: var(--error-bg);
                    color: var(--error);
                    border: 1px solid rgba(196, 69, 54, 0.2);
                    font-size: var(--font-size-sm);
                }

                .patrol-editor-hint-text {
                    margin-top: 6px;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .patrol-editor-guide {
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-subtle);
                    background: var(--secondary-bg);
                    padding: var(--spacing-md);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .patrol-guide-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-weight: var(--font-weight-semibold);
                    font-size: var(--font-size-sm);
                    color: var(--text-primary);
                }

                .patrol-guide-status {
                    padding: 2px 10px;
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-xs);
                    background: var(--base-surface);
                    color: var(--text-muted);
                }

                .patrol-guide-steps {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }

                .patrol-guide-step {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: 6px 8px;
                    border-radius: var(--radius-md);
                }

                .patrol-guide-step .step-index {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    border: 1px solid var(--border-subtle);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    background: var(--base-surface);
                }

                .patrol-guide-step .step-title {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-weight-medium);
                    color: var(--text-primary);
                }

                .patrol-guide-step .step-subtitle {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .patrol-guide-step.done {
                    background: rgba(35, 161, 105, 0.1);
                }

                .patrol-guide-step.done .step-index {
                    border-color: rgba(35, 161, 105, 0.4);
                    color: var(--success);
                }

                .patrol-guide-step.ready {
                    background: rgba(184, 138, 45, 0.15);
                }

                .patrol-guide-step.ready .step-index {
                    border-color: rgba(184, 138, 45, 0.5);
                    color: var(--primary-color);
                }

                .patrol-guide-tip {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }

                .patrol-editor-stats {
                    display: flex;
                    justify-content: space-between;
                    padding: var(--spacing-md);
                    border-radius: var(--radius-md);
                    background: var(--secondary-bg);
                    font-size: var(--font-size-sm);
                }

                .patrol-editor-stats .label {
                    display: block;
                    color: var(--text-muted);
                    font-size: var(--font-size-xs);
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .patrol-editor-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-wrap: wrap;
                }

                .patrol-direction-toggle {
                    display: flex;
                    gap: var(--spacing-xs);
                    padding: 4px;
                    border-radius: var(--radius-full);
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-subtle);
                }

                .patrol-direction-btn {
                    flex: 1;
                    border: 1px solid transparent;
                    background: transparent;
                    border-radius: var(--radius-full);
                    padding: 6px 12px;
                    font-size: var(--font-size-xs);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }

                .patrol-direction-btn.active {
                    background: var(--primary-color);
                    color: var(--text-inverse);
                    border-color: var(--primary-color);
                    box-shadow: var(--shadow-sm);
                }

                .patrol-activate-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) 0;
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                }

                .patrol-editor-zone-row {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .patrol-editor-zone-row .form-input {
                    flex: 1;
                }

                .patrol-editor-zone-offset {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                    margin-bottom: var(--spacing-sm);
                }

                .patrol-editor-offset-label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .patrol-editor-offset-row {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .patrol-editor-offset-input {
                    flex: 1;
                }

                .patrol-editor-offset-value {
                    font-size: var(--font-size-xs);
                    color: var(--text-secondary);
                    min-width: 64px;
                    text-align: right;
                }

                .patrol-editor-routes {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .patrol-editor-routes-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .patrol-editor-routes-count {
                    background: var(--secondary-bg);
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    color: var(--text-secondary);
                }

                .patrol-editor-routes-empty {
                    padding: var(--spacing-sm);
                    border-radius: var(--radius-md);
                    background: var(--secondary-bg);
                    color: var(--text-muted);
                    font-size: var(--font-size-sm);
                }

                .patrol-editor-route-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    max-height: 240px;
                    overflow-y: auto;
                    padding-right: 4px;
                }

                .patrol-editor-route {
                    display: flex;
                    justify-content: space-between;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border-radius: var(--radius-md);
                    background: var(--base-surface);
                    border: 1px solid var(--border-subtle);
                    box-shadow: var(--shadow-sm);
                }

                .patrol-editor-route.active {
                    border-color: var(--primary-color);
                    box-shadow: var(--shadow-sm), var(--shadow-glow);
                }

                .patrol-editor-route.selected {
                    border-color: var(--primary-color);
                }

                .patrol-editor-route-name {
                    font-weight: var(--font-weight-semibold);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                }

                .patrol-editor-route-badge {
                    font-size: var(--font-size-xs);
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    background: var(--primary-muted);
                    color: var(--primary-color);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .patrol-editor-route-meta {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: 2px;
                }

                .patrol-editor-route-actions {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    flex-wrap: wrap;
                }

                .btn-xs {
                    padding: 4px 10px;
                    font-size: var(--font-size-xs);
                    border-radius: var(--radius-full);
                }

                @media (max-width: 1024px) {
                    .patrol-editor-body {
                        grid-template-columns: 1fr;
                    }

                    .patrol-editor-map-panel {
                        height: 420px;
                    }

                    .patrol-editor-controls {
                        max-height: none;
                    }
                }
            `}</style>
        </div>
    );
}

function normalizeWaypoints(input) {
    if (!input) return [];
    let raw = input;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (error) {
            return [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw
        .map((point) => {
            if (Array.isArray(point)) {
                return { lat: Number(point[0]), lon: Number(point[1]) };
            }
            if (point && typeof point === 'object') {
                return { lat: Number(point.lat), lon: Number(point.lon) };
            }
            return null;
        })
        .filter((point) =>
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon)
        );
}
