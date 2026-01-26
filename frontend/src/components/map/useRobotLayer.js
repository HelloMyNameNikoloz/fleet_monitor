import { useCallback, useEffect, useRef } from 'react';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { easeOut } from 'ol/easing';
import { ANIMATION_DURATION } from './constants';

export function useRobotLayer({
    refs,
    robotsMap,
    selectedRobotId,
    getRobotStyle,
    followRobot
}) {
    const {
        robotsLayerRef,
        robotPositionsRef,
        animationFramesRef,
        initialCenterRef,
        mapInstance
    } = refs;

    const animateRobotTo = useCallback((robotId, targetLon, targetLat) => {
        const source = robotsLayerRef.current?.getSource();
        if (!source) return;

        const feature = source.getFeatureById(robotId);
        if (!feature) return;

        if (animationFramesRef.current[robotId]) {
            cancelAnimationFrame(animationFramesRef.current[robotId]);
        }

        const geometry = feature.getGeometry();
        const startCoord = geometry.getCoordinates();
        const endCoord = fromLonLat([targetLon, targetLat]);

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
            const eased = easeOut(progress);

            const currentX = startCoord[0] + (endCoord[0] - startCoord[0]) * eased;
            const currentY = startCoord[1] + (endCoord[1] - startCoord[1]) * eased;

            geometry.setCoordinates([currentX, currentY]);
            robotPositionsRef.current[robotId] = { x: currentX, y: currentY };

            if (progress < 1) {
                animationFramesRef.current[robotId] = requestAnimationFrame(animate);
            } else {
                delete animationFramesRef.current[robotId];
            }
        };

        animationFramesRef.current[robotId] = requestAnimationFrame(animate);
    }, [robotsLayerRef, robotPositionsRef, animationFramesRef]);

    useEffect(() => {
        if (robotsLayerRef.current) {
            robotsLayerRef.current.setStyle(getRobotStyle);
        }
    }, [getRobotStyle, robotsLayerRef]);

    useEffect(() => {
        if (!robotsLayerRef.current) return;

        const source = robotsLayerRef.current.getSource();
        const newIds = new Set(Object.keys(robotsMap));

        source.getFeatures().forEach(feature => {
            if (!newIds.has(feature.getId())) {
                source.removeFeature(feature);
                delete robotPositionsRef.current[feature.getId()];
            }
        });

        Object.values(robotsMap).forEach(robot => {
            const existingFeature = source.getFeatureById(robot.id);

            if (existingFeature) {
                existingFeature.set('status', robot.status);
                existingFeature.set('name', robot.name);

                animateRobotTo(robot.id, robot.lon, robot.lat);
            } else {
                const feature = new Feature({
                    geometry: new Point(fromLonLat([robot.lon, robot.lat])),
                    type: 'robot',
                    id: robot.id,
                    name: robot.name,
                    status: robot.status
                });
                feature.setId(robot.id);
                source.addFeature(feature);
                robotPositionsRef.current[robot.id] = fromLonLat([robot.lon, robot.lat]);
            }
        });
    }, [robotsMap, animateRobotTo, robotsLayerRef, robotPositionsRef]);

    // Track previous selection to trigger center only on change
    const prevSelectedIdRef = useRef(null);

    useEffect(() => {
        if (!mapInstance.current || !selectedRobotId) {
            prevSelectedIdRef.current = selectedRobotId;
            return;
        }

        // Only animate if selection CHANGED or it's the first selection (initial load)
        if (selectedRobotId !== prevSelectedIdRef.current || !initialCenterRef.current) {
            const robot = robotsMap[selectedRobotId];
            if (robot && Number.isFinite(robot.lat) && Number.isFinite(robot.lon)) {
                mapInstance.current.getView().animate({
                    center: fromLonLat([robot.lon, robot.lat]),
                    zoom: 15,
                    duration: 500
                });
                initialCenterRef.current = true;
            }
        }

        prevSelectedIdRef.current = selectedRobotId;
    }, [selectedRobotId, mapInstance, robotsMap, initialCenterRef]);

    useEffect(() => {
        if (!followRobot || !selectedRobotId || !mapInstance.current) return;

        const robot = robotsMap[selectedRobotId];
        if (robot) {
            mapInstance.current.getView().animate({
                center: fromLonLat([robot.lon, robot.lat]),
                duration: 300
            });
        }
    }, [followRobot, selectedRobotId, robotsMap, mapInstance]);
}
