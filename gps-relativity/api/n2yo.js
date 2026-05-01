export async function loadRealSatelliteData() {
    // Point to your Vercel deployment (or relative path if same domain)
    const BASE = 'https://your-project.vercel.app';  // ← replace with your Vercel URL

    try {
        const listData = await fetch(`${BASE}/api/satellite?type=above`).then(r => r.json());

        if (!listData.above) return [];

        // ... your existing filtering logic stays exactly the same ...

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