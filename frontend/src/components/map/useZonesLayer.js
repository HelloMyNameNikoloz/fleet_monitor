import { useEffect } from 'react';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { fromLonLat } from 'ol/proj';

export function useZonesLayer({ refs, zones, showZones }) {
    const { zonesLayerRef } = refs;

    useEffect(() => {
        if (!zonesLayerRef.current || !showZones) {
            if (zonesLayerRef.current) {
                zonesLayerRef.current.getSource().clear();
            }
            return;
        }

        const source = zonesLayerRef.current.getSource();
        source.clear();

        zones.forEach(zone => {
            let feature = null;
            let geometry = zone.geometry;

            if (typeof geometry === 'string') {
                try {
                    geometry = JSON.parse(geometry);
                } catch (error) {
                    geometry = null;
                }
            }

            if (geometry?.type === 'circle' && geometry.center && geometry.radius) {
                const [lat, lon] = geometry.center;
                feature = new Feature({
                    geometry: new Circle(
                        fromLonLat([lon, lat]),
                        geometry.radius
                    )
                });
            } else if (geometry?.type === 'polygon' && geometry.coordinates) {
                const coords = geometry.coordinates.map(([lat, lon]) => fromLonLat([lon, lat]));
                if (coords.length > 2) {
                    const first = coords[0];
                    const last = coords[coords.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        coords.push(first);
                    }
                }
                feature = new Feature({
                    geometry: new Polygon([coords])
                });
            }

            if (feature) {
                feature.set('name', zone.name);
                feature.set('zoneType', zone.type);
                feature.setId(zone.id);
                source.addFeature(feature);
            }
        });
    }, [zones, showZones, zonesLayerRef]);
}
