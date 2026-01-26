import { useCallback } from 'react';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import {
    ACCENT_COLOR,
    ACCENT_GLOW,
    ACCENT_GLOW_STRONG,
    PATROL_COLOR,
    PATROL_COLOR_MUTED
} from './constants';

export function useMapStyles({ selectedRobotId, pulsePhase }) {
    const getRobotStyle = useCallback((feature) => {
        const status = feature.get('status');
        const isSelected = feature.get('id') === selectedRobotId;

        let color = '#F59E0B';
        if (status === 'moving') color = '#10B981';
        if (status === 'offline') color = '#EF4444';

        let radius = isSelected ? 14 : 8;
        let strokeWidth = isSelected ? 4 : 2;
        let glowRadius = 0;

        if (isSelected) {
            const pulseScale = 1 + 0.15 * Math.sin((pulsePhase / 60) * Math.PI * 2);
            radius = 14 * pulseScale;
            strokeWidth = 4 * pulseScale;
            glowRadius = 24 * pulseScale;
        }

        const styles = [];

        if (isSelected && glowRadius > 0) {
            styles.push(new Style({
                image: new CircleStyle({
                    radius: glowRadius,
                    fill: new Fill({ color: ACCENT_GLOW }),
                    stroke: new Stroke({
                        color: ACCENT_GLOW_STRONG,
                        width: 2
                    })
                }),
                zIndex: 998
            }));
        }

        styles.push(new Style({
            image: new CircleStyle({
                radius: radius,
                fill: new Fill({ color }),
                stroke: new Stroke({
                    color: isSelected ? ACCENT_COLOR : 'rgba(255,255,255,0.9)',
                    width: strokeWidth
                })
            }),
            text: new Text({
                text: feature.get('name'),
                offsetY: isSelected ? -30 : -20,
                font: `${isSelected ? 'bold 14px' : '12px'} "Bricolage Grotesque", sans-serif`,
                fill: new Fill({ color: '#FFFFFF' }),
                stroke: new Stroke({ color: '#000000', width: 3 }),
                padding: [2, 4, 2, 4]
            }),
            zIndex: isSelected ? 1000 : 100
        }));

        return styles;
    }, [selectedRobotId, pulsePhase]);

    const getZoneStyle = useCallback((feature) => {
        const zoneType = feature.get('zoneType');
        const zoneName = feature.get('name');

        let fillColor;
        let strokeColor;
        switch (zoneType) {
            case 'restricted':
                fillColor = 'rgba(239, 68, 68, 0.15)';
                strokeColor = 'rgba(239, 68, 68, 0.7)';
                break;
            case 'warning':
                fillColor = 'rgba(245, 158, 11, 0.15)';
                strokeColor = 'rgba(245, 158, 11, 0.7)';
                break;
            case 'allowed':
            default:
                fillColor = 'rgba(16, 185, 129, 0.15)';
                strokeColor = 'rgba(16, 185, 129, 0.7)';
                break;
        }

        return new Style({
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: strokeColor, width: 2, lineDash: [6, 4] }),
            text: new Text({
                text: zoneName,
                font: '12px "Bricolage Grotesque", sans-serif',
                fill: new Fill({ color: strokeColor }),
                stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 3 })
            }),
            zIndex: 50
        });
    }, []);

    const getPatrolStyle = useCallback((feature) => {
        const robotId = feature.get('robotId');
        const isSelected = robotId === selectedRobotId;
        const color = isSelected ? PATROL_COLOR : PATROL_COLOR_MUTED;
        return new Style({
            stroke: new Stroke({
                color,
                width: isSelected ? 3 : 2,
                lineDash: isSelected ? [10, 6] : [6, 6]
            }),
            text: new Text({
                text: feature.get('name') || '',
                font: '11px "Bricolage Grotesque", sans-serif',
                fill: new Fill({ color }),
                stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 3 }),
                offsetY: -8
            }),
            zIndex: 40
        });
    }, [selectedRobotId]);

    return {
        getRobotStyle,
        getZoneStyle,
        getPatrolStyle
    };
}
