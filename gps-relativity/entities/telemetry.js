/**
 * @fileoverview Telemetry Module - Handles Relativistic math and Geocoding
 */

let totalDrift = 0;
let lastSatName = null;
let countryTimer = 0;
let currentCountry = "SCANNING...";

export function calculateTelemetry(data, pos, vel, simulatedTime, scaledDt) {
    if (!pos || !vel) return null;

    // Reset drift if satellite changed
    if (lastSatName !== data.name) {
        totalDrift = 0;
        lastSatName = data.name;
    }

    const distKm = Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2);
    const speedKms = Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2);
    
    // Relativity Constants
    const C = 299792.458; 
    const GM = 398600.4418;
    
    // Dilation Math
    const srDilation = -0.5 * Math.pow(speedKms / C, 2) * 86400 * 1e9;
    const grDilation = (GM / (C**2) * (1/6371 - 1/distKm)) * 86400 * 1e9;
    const netDilation = srDilation + grDilation;

    // Accumulate Drift
    totalDrift += netDilation * (scaledDt / 86400);

    // Inside telemetry.js, make sure it handles the global satellite object
    const satLib = window.satellite || satellite;

    // Geodetic Conversion (Lat/Lon)
    const gmst = satLib.gstime(simulatedTime);
    const positionGd = satLib.eciToGeodetic(pos, gmst);
    
    return {
        name: data.name,
        alt: (distKm - 6371).toFixed(2),
        speed: (speedKms * 3600).toLocaleString(),
        dilation: netDilation.toFixed(2),
        drift: totalDrift.toFixed(4),
        lat: satellite.degreesLat(positionGd.latitude),
        lon: satellite.degreesLong(positionGd.longitude)
    };
}

export async function updateCountry(lat, lon, delta) {
    countryTimer += delta;
    if (countryTimer > 3) {
        countryTimer = 0;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await res.json();
            currentCountry = data.address.country || data.address.ocean || "OVER OPEN WATER";
        } catch (e) {
            currentCountry = "OFFLINE/OVER OCEAN";
        }
    }
    return currentCountry;
}