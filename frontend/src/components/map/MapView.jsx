import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots } from '../../context/RobotsContext';
import { useMapRefs } from './useMapRefs';
import { useThemeWatcher } from './useThemeWatcher';
import { usePulsePhase } from './usePulsePhase';
import { useMapStyles } from './useMapStyles';
import { useMapInteractions } from './useMapInteractions';
import { useMapCore } from './useMapCore';
import { useMapToggles } from './useMapToggles';
import { useRobotsMapRef } from './useRobotsMapRef';
import { useRobotLayer } from './useRobotLayer';
import { useZonesLayer } from './useZonesLayer';
import { usePatrolLayers } from './usePatrolLayers';
import { useTrailsLayer } from './useTrailsLayer';
import { useMapActions } from './useMapActions';
import MapFocusBar from './MapFocusBar';
import MapControls from './MapControls';
import MapAddRobotPanel from './MapAddRobotPanel';
import MapHoverCard from './MapHoverCard';
import MapStyles from './MapStyles';
import 'ol/ol.css';

export default function MapView({ zones = [] }) {
    const navigate = useNavigate();
    const {
        robotsMap,
        trails,
        selectedRobotId,
        setSelectedRobotId,
        moveRobot,
        createRobot
    } = useRobots();

    const refs = useMapRefs();
    const theme = useThemeWatcher();
    const pulsePhase = usePulsePhase(selectedRobotId);
    const toggles = useMapToggles();

    const { getRobotStyle, getZoneStyle, getPatrolStyle } = useMapStyles({
        selectedRobotId,
        pulsePhase
    });

    const interactions = useMapInteractions({
        robotsMapRef: refs.robotsMapRef,
        hoverTimeoutRef: refs.hoverTimeoutRef,
        setSelectedRobotId,
        createRobot
    });

    const selectedRobot = selectedRobotId ? robotsMap[selectedRobotId] : null;
    const patrolActive = useMemo(() => {
        if (!selectedRobot) return false;
        const path = selectedRobot.patrol_path;
        if (!path) return false;
        if (Array.isArray(path)) {
            return path.length >= 2;
        }
        if (typeof path === 'string') {
            try {
                const parsed = JSON.parse(path);
                return Array.isArray(parsed) && parsed.length >= 2;
            } catch (error) {
                return false;
            }
        }
        return false;
    }, [selectedRobot]);

    useRobotsMapRef(robotsMap, refs.robotsMapRef);

    useMapCore({
        refs,
        getZoneStyle,
        getPatrolStyle,
        getRobotStyle,
        theme,
        onMapClick: interactions.handleMapClick,
        onPointerMove: interactions.handlePointerMove
    });

    useRobotLayer({
        refs,
        robotsMap,
        selectedRobotId,
        getRobotStyle,
        followRobot: toggles.followRobot
    });

    useZonesLayer({
        refs,
        zones,
        showZones: toggles.showZones
    });

    usePatrolLayers({
        refs,
        robotsMap,
        selectedRobotId,
        showPatrols: toggles.showPatrols,
        getPatrolStyle
    });

    useTrailsLayer({
        refs,
        trails,
        robotsMap,
        selectedRobotId,
        showTrails: toggles.showTrails
    });

    const actions = useMapActions({
        mapInstanceRef: refs.mapInstance,
        robotsMap,
        selectedRobotId,
        selectedRobot,
        navigate,
        moveRobot
    });

    return (
        <>
            <div ref={refs.mapRef} className="ol-map" />

            <MapFocusBar
                selectedRobot={selectedRobot}
                onReplay={actions.handleReplay}
                onMoveRandom={actions.handleMoveRandom}
                onCenterSelected={actions.handleCenterSelected}
            />

            <MapControls
                followRobot={toggles.followRobot}
                showTrails={toggles.showTrails}
                showZones={toggles.showZones}
                showPatrols={toggles.showPatrols}
                addRobotOpen={interactions.addRobotOpen}
                patrolActive={patrolActive}
                patrolDirection={selectedRobot?.patrol_direction}
                selectedRobotId={selectedRobotId}
                onToggleFollow={() => toggles.setFollowRobot(!toggles.followRobot)}
                onToggleTrails={() => toggles.setShowTrails(!toggles.showTrails)}
                onToggleZones={() => toggles.setShowZones(!toggles.showZones)}
                onTogglePatrols={() => toggles.setShowPatrols(!toggles.showPatrols)}
                onToggleAddRobot={interactions.handleToggleAddRobot}
                onCenterAll={actions.handleCenterAll}
                onZoomIn={actions.handleZoomIn}
                onZoomOut={actions.handleZoomOut}
            />

            <MapAddRobotPanel
                open={interactions.addRobotOpen}
                name={interactions.addRobotName}
                error={interactions.addRobotError}
                busy={interactions.addRobotBusy}
                placing={interactions.addRobotPlacing}
                onNameChange={interactions.setAddRobotName}
                onStart={interactions.handleStartAddRobot}
                onCancel={interactions.handleCancelAddRobot}
            />

            <MapHoverCard hoveredRobot={interactions.hoveredRobot} />

            <MapStyles />
        </>
    );
}
