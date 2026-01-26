import { useEffect, useState } from 'react';

export function usePulsePhase(selectedRobotId) {
    const [pulsePhase, setPulsePhase] = useState(0);

    useEffect(() => {
        if (!selectedRobotId) return;

        const interval = setInterval(() => {
            setPulsePhase(prev => (prev + 1) % 60);
        }, 50);

        return () => clearInterval(interval);
    }, [selectedRobotId]);

    return pulsePhase;
}
