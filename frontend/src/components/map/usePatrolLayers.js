import { useEffect } from 'react';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { findNearestPointOnPath, normalizeWaypoints } from './helpers';

export function usePatrolLayers({ refs, robotsMap, selectedRobotId, showPatrols, getPatrolStyle }) {
    const { patrolLayerRef, rejoinLayerRef } = refs;

    useEffect(() => {
        if (patrolLayerRef.current) {
            patrolLayerRef.current.setStyle(getPatrolStyle);
        }
    }, [getPatrolStyle, patrolLayerRef]);

    useEffect(() => {
        if (!patrolLayerRef.current) return;
        const source = patrolLayerRef.current.getSource();
        source.clear();

        if (!showPatrols) {
            return;
        }

        const robotsToRender = selectedRobotId
            ? [robotsMap[selectedRobotId]].filter(Boolean)
            : Object.values(robotsMap);

        robotsToRender.forEach((robot) => {
            const waypoints = normalizeWaypoints(robot?.patrol_path);
            if (waypoints.length < 2) return;
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
            feature.set('robotId', robot.id);
            feature.set('name', robot.name);
            feature.setId(`patrol-${robot.id}`);
            source.addFeature(feature);
        });
    }, [robotsMap, selectedRobotId, showPatrols, patrolLayerRef]);

    useEffect(() => {
        if (!rejoinLayerRef.current) return;
        const source = rejoinLayerRef.current.getSource();
        source.clear();

        if (!showPatrols) {
            return;
        }

        Object.values(robotsMap).forEach((robot) => {
            const waypoints = normalizeWaypoints(robot?.patrol_path);
            if (waypoints.length < 2) return;
            const nearest = findNearestPointOnPath(robot, waypoints);
            if (!nearest?.point) return;

            const threshold = 0.00024;
            if (nearest.distance <= threshold) return;

            const coords = [
                fromLonLat([robot.lon, robot.lat]),
                fromLonLat([nearest.point.lon, nearest.point.lat])
            ];
            const feature = new Feature({
                geometry: new LineString(coords)
            });
            feature.setId(`rejoin-${robot.id}`);
            source.addFeature(feature);
        });
    }, [robotsMap, showPatrols, rejoinLayerRef]);
}
