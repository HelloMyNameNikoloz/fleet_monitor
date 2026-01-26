import { useRef } from 'react';

export function useMapRefs() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const tileLayerRef = useRef(null);
    const robotsLayerRef = useRef(null);
    const trailsLayerRef = useRef(null);
    const zonesLayerRef = useRef(null);
    const patrolLayerRef = useRef(null);
    const rejoinLayerRef = useRef(null);
    const robotPositionsRef = useRef({});
    const animationFramesRef = useRef({});
    const initialCenterRef = useRef(false);
    const hoverTimeoutRef = useRef(null);
    const robotsMapRef = useRef({});

    return {
        mapRef,
        mapInstance,
        tileLayerRef,
        robotsLayerRef,
        trailsLayerRef,
        zonesLayerRef,
        patrolLayerRef,
        rejoinLayerRef,
        robotPositionsRef,
        animationFramesRef,
        initialCenterRef,
        hoverTimeoutRef,
        robotsMapRef
    };
}
