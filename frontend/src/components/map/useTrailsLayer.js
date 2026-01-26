import { useEffect } from 'react';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';

export function useTrailsLayer({ refs, trails, robotsMap, selectedRobotId, showTrails }) {
    const { trailsLayerRef } = refs;

    useEffect(() => {
        if (!trailsLayerRef.current) return;

        const source = trailsLayerRef.current.getSource();
        source.clear();

        if (!showTrails || !selectedRobotId) return;

        const positions = trails[selectedRobotId];
        const robot = robotsMap[selectedRobotId];

        if (!Array.isArray(positions)) return;

        let trailPositions = [...positions];

        if (robot && trailPositions.length > 0) {
            const lastPos = trailPositions[trailPositions.length - 1];
            if (lastPos.lat !== robot.lat || lastPos.lon !== robot.lon) {
                trailPositions.push({ lat: robot.lat, lon: robot.lon });
            }
        } else if (robot && trailPositions.length === 0) {
            trailPositions.push({ lat: robot.lat, lon: robot.lon });
        }

        if (trailPositions.length < 2) return;

        const coords = trailPositions.map(p => fromLonLat([p.lon, p.lat]));
        const feature = new Feature({
            geometry: new LineString(coords),
            robotId: selectedRobotId
        });
        source.addFeature(feature);
    }, [trails, showTrails, selectedRobotId, robotsMap, trailsLayerRef]);
}
