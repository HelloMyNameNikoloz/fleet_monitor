import { useState } from 'react';

export function useMapToggles() {
    const [followRobot, setFollowRobot] = useState(false);
    const [showZones, setShowZones] = useState(true);
    const [showTrails, setShowTrails] = useState(true);
    const [showPatrols, setShowPatrols] = useState(true);

    return {
        followRobot,
        setFollowRobot,
        showZones,
        setShowZones,
        showTrails,
        setShowTrails,
        showPatrols,
        setShowPatrols
    };
}
