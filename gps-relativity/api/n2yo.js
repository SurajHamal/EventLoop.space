// api/n2yo.js
export async function loadRealSatelliteData(satellites, trackingMode, activeSatIndex, uiUpdateCallback) {
    const apiKey = 'R3HBP5-528DX8-N22FB8-5MNP'; 
    const categoryId = 1; 
    const n2yoUrl = `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/90/${categoryId}/&apiKey=${apiKey}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(n2yoUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (!data.above || !Array.isArray(data.above)) return [];

        const slicedData = data.above.slice(0, 50);

        slicedData.forEach((satData, i) => {
            if (satellites && satellites[i]) {
                const satMesh = satellites[i];
                satMesh.userData.name = satData.satname;
                satMesh.userData.id = satData.satname;
                const labelObj = satMesh.children.find(child => child.isCSS2DObject);
                if (labelObj && labelObj.element) {
                    labelObj.element.textContent = satData.satname;
                }
            }
        });

        // Use the passed callback instead of an internal function
        if (trackingMode === 'SATELLITE' && activeSatIndex !== null && uiUpdateCallback) {
            const focusedSatData = slicedData[activeSatIndex];
            if (focusedSatData) {
                uiUpdateCallback({
                    name: focusedSatData.satname,
                    alt: focusedSatData.satalt.toFixed(2),
                    speed: "CALCULATING...",
                    dilation: 0,
                    drift: 0
                }, "LOCKING SIGNAL...");
            }
        }

        return slicedData.map(sat => ({
            name: sat.satname,
            directCoords: { lat: sat.satlat, lng: sat.satlng, alt: sat.satalt }
        }));
    } catch (e) {
        console.error("N2YO Proxy Error:", e);
        return []; 
    }
}