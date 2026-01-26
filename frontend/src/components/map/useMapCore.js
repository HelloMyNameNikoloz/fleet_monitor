import { useCallback, useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke } from 'ol/style';
import { DEFAULT_CENTER, TRAIL_COLOR } from './constants';

export function useMapCore({
    refs,
    getZoneStyle,
    getPatrolStyle,
    getRobotStyle,
    theme,
    onMapClick,
    onPointerMove
}) {
    const {
        mapRef,
        mapInstance,
        tileLayerRef,
        robotsLayerRef,
        trailsLayerRef,
        zonesLayerRef,
        patrolLayerRef,
        rejoinLayerRef,
        animationFramesRef
    } = refs;

    const createTileSource = useCallback((mode) => {
        if (mode === 'dark') {
            return new OSM({
                url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            });
        }
        return new OSM({
            url: 'https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
        });
    }, []);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const zonesSource = new VectorSource();
        const zonesLayer = new VectorLayer({
            source: zonesSource,
            style: getZoneStyle
        });
        zonesLayerRef.current = zonesLayer;

        const patrolSource = new VectorSource();
        const patrolLayer = new VectorLayer({
            source: patrolSource,
            style: getPatrolStyle
        });
        patrolLayerRef.current = patrolLayer;

        const rejoinSource = new VectorSource();
        const rejoinLayer = new VectorLayer({
            source: rejoinSource,
            style: new Style({
                stroke: new Stroke({
                    color: 'rgba(27, 166, 109, 0.85)',
                    width: 2,
                    lineDash: [6, 6]
                })
            })
        });
        rejoinLayerRef.current = rejoinLayer;

        const trailsSource = new VectorSource();
        const trailsLayer = new VectorLayer({
            source: trailsSource,
            style: new Style({
                stroke: new Stroke({
                    color: TRAIL_COLOR,
                    width: 2,
                    lineDash: [4, 4]
                })
            })
        });
        trailsLayerRef.current = trailsLayer;

        const robotsSource = new VectorSource();
        const robotsLayer = new VectorLayer({
            source: robotsSource,
            style: getRobotStyle
        });
        robotsLayerRef.current = robotsLayer;

        const tileLayer = new TileLayer({
            source: createTileSource(theme)
        });
        tileLayerRef.current = tileLayer;

        const map = new Map({
            target: mapRef.current,
            layers: [
                tileLayer,
                zonesLayer,
                patrolLayer,
                rejoinLayer,
                trailsLayer,
                robotsLayer
            ],
            view: new View({
                center: fromLonLat(DEFAULT_CENTER),
                zoom: 15
            })
        });

        map.on('click', (e) => {
            onMapClick(map, e);
        });

        map.on('pointermove', (e) => {
            onPointerMove(map, e);
        });

        mapInstance.current = map;

        return () => {
            Object.values(animationFramesRef.current).forEach(cancelAnimationFrame);
            animationFramesRef.current = {};
            map.setTarget(undefined);
            mapInstance.current = null;
        };
    }, [
        createTileSource,
        mapRef,
        mapInstance,
        zonesLayerRef,
        patrolLayerRef,
        rejoinLayerRef,
        trailsLayerRef,
        robotsLayerRef,
        tileLayerRef,
        animationFramesRef,
        onMapClick,
        onPointerMove
    ]);

    useEffect(() => {
        if (!tileLayerRef.current) return;
        tileLayerRef.current.setSource(createTileSource(theme));
    }, [theme, createTileSource, tileLayerRef]);
}
