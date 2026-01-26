import { useCallback, useEffect, useRef, useState } from 'react';
import { toLonLat } from 'ol/proj';

export function useMapInteractions({
    robotsMapRef,
    hoverTimeoutRef,
    setSelectedRobotId,
    createRobot
}) {
    const [hoveredRobot, setHoveredRobot] = useState(null);
    const [addRobotOpen, setAddRobotOpen] = useState(false);
    const [addRobotPlacing, setAddRobotPlacing] = useState(false);
    const [addRobotName, setAddRobotName] = useState('');
    const [addRobotError, setAddRobotError] = useState('');
    const [addRobotBusy, setAddRobotBusy] = useState(false);

    const addRobotPlacingRef = useRef(false);
    const addRobotNameRef = useRef('');
    const addRobotBusyRef = useRef(false);
    const createRobotRef = useRef(createRobot);
    const setSelectedRobotIdRef = useRef(setSelectedRobotId);

    useEffect(() => {
        addRobotPlacingRef.current = addRobotPlacing;
    }, [addRobotPlacing]);

    useEffect(() => {
        addRobotNameRef.current = addRobotName;
    }, [addRobotName]);

    useEffect(() => {
        addRobotBusyRef.current = addRobotBusy;
    }, [addRobotBusy]);

    useEffect(() => {
        createRobotRef.current = createRobot;
    }, [createRobot]);

    useEffect(() => {
        setSelectedRobotIdRef.current = setSelectedRobotId;
    }, [setSelectedRobotId]);

    const handleMapClick = useCallback(async (map, e) => {
        if (addRobotPlacingRef.current) {
            const name = addRobotNameRef.current.trim();
            if (!name) {
                setAddRobotError('Robot name is required.');
                return;
            }
            if (addRobotBusyRef.current) return;
            addRobotBusyRef.current = true;
            setAddRobotBusy(true);
            try {
                const [lon, lat] = toLonLat(e.coordinate);
                const robot = await createRobotRef.current(name, lat, lon);
                setSelectedRobotIdRef.current(robot.id);
                setAddRobotPlacing(false);
                setAddRobotOpen(false);
                setAddRobotName('');
                setAddRobotError('');
            } catch (error) {
                setAddRobotError('Failed to create robot. Try again.');
            } finally {
                addRobotBusyRef.current = false;
                setAddRobotBusy(false);
            }
            return;
        }

        const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
        if (feature && feature.get('type') === 'robot') {
            setSelectedRobotIdRef.current(feature.get('id'));
        }
    }, []);

    const handlePointerMove = useCallback((map, e) => {
        if (addRobotPlacingRef.current) {
            map.getTargetElement().style.cursor = 'crosshair';
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
            }
            setHoveredRobot(null);
            return;
        }

        const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
        const isRobot = feature && feature.get('type') === 'robot';
        map.getTargetElement().style.cursor = isRobot ? 'pointer' : '';

        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        if (isRobot) {
            const robotId = feature.get('id');
            const robot = robotsMapRef.current[robotId];
            if (robot) {
                setHoveredRobot({
                    robot,
                    x: e.pixel[0] + 16,
                    y: e.pixel[1] + 16
                });
            }
        } else {
            hoverTimeoutRef.current = setTimeout(() => {
                setHoveredRobot(null);
            }, 80);
        }
    }, [hoverTimeoutRef, robotsMapRef]);

    const handleStartAddRobot = useCallback(() => {
        setAddRobotError('');
        if (!addRobotName.trim()) {
            setAddRobotError('Enter a robot name first.');
            return;
        }
        setAddRobotPlacing(true);
    }, [addRobotName]);

    const handleCancelAddRobot = useCallback(() => {
        setAddRobotOpen(false);
        setAddRobotPlacing(false);
        setAddRobotName('');
        setAddRobotError('');
    }, []);

    const handleToggleAddRobot = useCallback(() => {
        setAddRobotOpen((prev) => !prev);
        setAddRobotPlacing(false);
        setAddRobotError('');
    }, []);

    return {
        hoveredRobot,
        addRobotOpen,
        addRobotPlacing,
        addRobotName,
        addRobotError,
        addRobotBusy,
        setAddRobotName,
        handleMapClick,
        handlePointerMove,
        handleStartAddRobot,
        handleCancelAddRobot,
        handleToggleAddRobot
    };
}
