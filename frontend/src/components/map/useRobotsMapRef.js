import { useEffect } from 'react';

export function useRobotsMapRef(robotsMap, robotsMapRef) {
    useEffect(() => {
        robotsMapRef.current = robotsMap;
    }, [robotsMap, robotsMapRef]);
}
