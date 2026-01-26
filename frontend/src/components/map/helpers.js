export function calculateDistance(lat1, lon1, lat2, lon2) {
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    return Math.sqrt(dLat * dLat + dLon * dLon);
}

export function projectPointToSegment(point, start, end) {
    const ax = start.lon;
    const ay = start.lat;
    const bx = end.lon;
    const by = end.lat;
    const px = point.lon;
    const py = point.lat;

    const abx = bx - ax;
    const aby = by - ay;
    const abLengthSq = abx * abx + aby * aby;
    if (abLengthSq === 0) {
        return { point: { lat: ay, lon: ax } };
    }

    const apx = px - ax;
    const apy = py - ay;
    const tRaw = (apx * abx + apy * aby) / abLengthSq;
    const t = Math.max(0, Math.min(1, tRaw));

    return {
        point: {
            lat: ay + aby * t,
            lon: ax + abx * t
        }
    };
}

export function findNearestPointOnPath(robot, waypoints) {
    if (!robot || waypoints.length < 2) return null;
    const point = { lat: robot.lat, lon: robot.lon };
    let nearestPoint = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < waypoints.length; i++) {
        const start = waypoints[i];
        const end = waypoints[(i + 1) % waypoints.length];
        const projection = projectPointToSegment(point, start, end);
        const distance = calculateDistance(point.lat, point.lon, projection.point.lat, projection.point.lon);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPoint = projection.point;
        }
    }

    return { point: nearestPoint, distance: nearestDistance };
}

export function normalizeWaypoints(input) {
    if (!input) return [];
    let raw = input;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (error) {
            return [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw
        .map((point) => {
            if (Array.isArray(point)) {
                return { lat: Number(point[0]), lon: Number(point[1]) };
            }
            if (point && typeof point === 'object') {
                return { lat: Number(point.lat), lon: Number(point.lon) };
            }
            return null;
        })
        .filter((point) =>
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon)
        );
}
