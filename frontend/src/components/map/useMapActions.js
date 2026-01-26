import { useCallback } from 'react';
import { fromLonLat } from 'ol/proj';

export function useMapActions({
    mapInstanceRef,
    robotsMap,
    selectedRobotId,
    selectedRobot,
    navigate,
    moveRobot
}) {
    const handleCenterAll = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const robots = Object.values(robotsMap);
        if (robots.length === 0) return;

        const avgLat = robots.reduce((sum, r) => sum + r.lat, 0) / robots.length;
        const avgLon = robots.reduce((sum, r) => sum + r.lon, 0) / robots.length;

        mapInstanceRef.current.getView().animate({
            center: fromLonLat([avgLon, avgLat]),
            zoom: 14,
            duration: 500
        });
    }, [mapInstanceRef, robotsMap]);

    const handleZoomIn = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const view = mapInstanceRef.current.getView();
        view.animate({ zoom: view.getZoom() + 1, duration: 250 });
    }, [mapInstanceRef]);

    const handleZoomOut = useCallback(() => {
        if (!mapInstanceRef.current) return;
        const view = mapInstanceRef.current.getView();
        view.animate({ zoom: view.getZoom() - 1, duration: 250 });
    }, [mapInstanceRef]);

    const handleCenterSelected = useCallback(() => {
        if (!mapInstanceRef.current || !selectedRobot) return;
        mapInstanceRef.current.getView().animate({
            center: fromLonLat([selectedRobot.lon, selectedRobot.lat]),
            zoom: 16,
            duration: 300
        });
    }, [mapInstanceRef, selectedRobot]);

    const handleReplay = useCallback(() => {
        if (!selectedRobotId) return;
        navigate('/replay', { state: { robotId: selectedRobotId } });
    }, [navigate, selectedRobotId]);

    const handleMoveRandom = useCallback(() => {
        if (!selectedRobotId) return;
        moveRobot(selectedRobotId);
    }, [moveRobot, selectedRobotId]);

    return {
        handleCenterAll,
        handleZoomIn,
        handleZoomOut,
        handleCenterSelected,
        handleReplay,
        handleMoveRandom
    };
}
