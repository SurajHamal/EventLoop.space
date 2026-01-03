// api/n2yo.js

/**
 * ASYNCHRONOUS TELEMETRY ENGINE
 * Fetches real-time orbital data and TLE propagation sets from the N2YO REST API.
 */
export async function loadRealSatelliteData() {
    const apiKey = 'R3HBP5-528DX8-N22FB8-5MNP';
    
    // Step 1: Query the 'above' endpoint for all satellites within a 90° horizon radius
    const listUrl = `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/90/0&apiKey=${apiKey}`;
    
    // Bypass CORS restrictions using a public proxy and URI encoding the target endpoint
    const proxyListUrl = `https://corsproxy.io/?${encodeURIComponent(listUrl)}`;

    try {
        const response = await fetch(proxyListUrl);
        const listData = await response.json();
        
        // Safety check: Ensure the 'above' property exists in the API response before processing
        if (!listData.above) return [];

        // --- HETEROGENEOUS DATA FILTERING ---
        // Sets are used to enforce unique membership for both NORAD IDs and Mission Names
        const seenIds = new Set();
        const seenNames = new Set();
        const uniqueSats = [];

        for (const sat of listData.above) {
            // Tokenize the name string to isolate the mission prefix (e.g., "STARLINK", "ISS")
            const baseName = sat.satname.split(/[- ]/)[0];

            // Logical XOR-like filter: Only push if both the ID and the Mission Prefix are unique
            if (!seenIds.has(sat.satid) && !seenNames.has(baseName)) {
                seenIds.add(sat.satid);
                seenNames.add(baseName);
                uniqueSats.push(sat);
            }
            
            // Hard limit to 5 unique entities to maintain scene performance and visual variety
            if (uniqueSats.length >= 5) break;
        }
        
        const topSats = uniqueSats; 

        // Step 2: Parallel TLE Acquisition
        // Map unique satellite IDs to their corresponding Two-Line Element sets for SGP4 propagation
        const satellitePromises = topSats.map(async (sat) => {
            try {
                const tleUrl = `https://api.n2yo.com/rest/v1/satellite/tle/${sat.satid}&apiKey=${apiKey}`;
                const proxyTleUrl = `https://corsproxy.io/?${encodeURIComponent(tleUrl)}`;
                
                const tleRes = await fetch(proxyTleUrl);
                const tleData = await tleRes.json();
                
                // Sanitize TLE data by splitting into an array and stripping empty newline characters
                const tleLines = tleData.tle.split('\r\n').filter(line => line.trim().length > 0);

                return {
                    name: sat.satname,
                    id: sat.satid,
                    tle: tleLines, // Data payload required for the SGP4 main loop
                    source: tleLines ? "PREDICTED (SGP4)" : "LIVE (TELEMETRY)",
                    // Store raw geodetic coordinates as an emergency positional fallback
                    directCoords: { lat: sat.satlat, lng: sat.satlng, alt: sat.satalt }
                };
            } catch (err) {
                // Error handling for individual TLE fetch failures; defaults to live telemetry
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

        // Resolve all concurrent promises and perform a final cleanup of the satellite array
        const finalResults = await Promise.all(satellitePromises);
        return finalResults.filter(s => s !== null).slice(0,5);
        
    } catch (e) {
        // Global exception handling for API connectivity or Proxy downtime
        console.error("N2YO Fetch Error:", e);
        return []; 
    }
}