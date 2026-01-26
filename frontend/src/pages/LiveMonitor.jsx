import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import MapView from '../components/map/MapView';
import UnifiedActorView from '../components/panels/UnifiedActorView';

export default function LiveMonitor() {
    const [zones, setZones] = useState([]);

    // Fetch zones for map overlays
    useEffect(() => {
        const fetchZones = async () => {
            try {
                const zonesData = await api.getZones();
                setZones(zonesData);
            } catch (error) {
                console.error('Failed to fetch zones:', error);
            }
        };
        fetchZones();
    }, []);

    return (
        <div className="page-container">
            <div className="map-container">
                <MapView zones={zones} />
            </div>

            <div className="control-panel">
                <div className="control-panel-content">
                    <UnifiedActorView
                        zones={zones}
                    />
                </div>
            </div>
        </div>
    );
}
