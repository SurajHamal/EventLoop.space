export async function loadRealSatelliteData() {
    const BASE = 'https://event-loop-space.vercel.app';

    try {
        const listData = await fetch(`${BASE}/api/satellite?type=above`).then(r => r.json());

        if (!listData.above) return [];

        // --- HETEROGENEOUS DATA FILTERING ---
        const seenIds = new Set();
        const seenNames = new Set();
        const uniqueSats = [];

        for (const sat of listData.above) {
            const baseName = sat.satname.split(/[- ]/)[0];

            if (!seenIds.has(sat.satid) && !seenNames.has(baseName)) {
                seenIds.add(sat.satid);
                seenNames.add(baseName);
                uniqueSats.push(sat);
            }

            if (uniqueSats.length >= 5) break;
        }

        const topSats = uniqueSats;

        const satellitePromises = topSats.map(async (sat) => {
            try {
                const tleData = await fetch(`${BASE}/api/satellite?type=tle&id=${sat.satid}`).then(r => r.json());
                const tleLines = tleData.tle.split('\r\n').filter(line => line.trim().length > 0);

                return {
                    name: sat.satname,
                    id: sat.satid,
                    tle: tleLines,
                    source: tleLines ? "PREDICTED (SGP4)" : "LIVE (TELEMETRY)",
                    directCoords: { lat: sat.satlat, lng: sat.satlng, alt: sat.satalt }
                };
            } catch (err) {
                console.warn(`Could not fetch TLE for ${sat.satname}`);
                return {
                    name: sat.satname,
                    id: sat.satid,
                    tle: null,
                    source: "LIVE (TELEMETRY)",
                    directCoords: { lat: sat.satlat, lng: sat.satlng, alt: sat.satalt }
                };
            }
        });

        const finalResults = await Promise.all(satellitePromises);
        return finalResults.filter(s => s !== null).slice(0, 5);

    } catch (e) {
        console.error("Satellite Fetch Error:", e);
        return [];
    }
}