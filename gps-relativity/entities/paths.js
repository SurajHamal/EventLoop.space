/**
 * @fileoverview Orbital Trajectory Visualization Engine
 * @author Suraj Hamal, Computer Scientist
 * * * MATHEMATICAL ARCHITECTURE:
 * 1. TLE DESERIALIZATION: 
 * Parses Two-Line Element (TLE) sets into SGP4 satellite record objects.
 * 2. TEMPORAL SAMPLING: 
 * Calculates the 'Mean Motion' (revs per day) to derive the precise orbital 
 * period. The path is then sampled into 120 discrete temporal segments.
 * 3. GEOSPATIAL-TO-CARTESIAN MAPPING:
 * Propagates ECI (Earth-Centered Inertial) vectors across one full revolution,
 * transforms them to Geodetic coordinates, and projects them into the 
 * normalized Three.js coordinate system.
 */

import * as THREE from 'three';

/**
 * Generates a scientifically accurate orbital path based on TLE propagation.
 * @param {string} line1 - TLE Line 1 (Header/Satellite Data)
 * @param {string} line2 - TLE Line 2 (Orbital Elements)
 * @param {number} color - Hexadecimal color for the trajectory line
 * @returns {THREE.Line | null} A Three.js Line object or null on failure.
 */
export function createOrbitPath(line1, line2, color = 0x00ffff) {
    const points = [];
    const segments = 120; // Resolution of the orbital ring
    
    // --- INTEGRITY CHECK ---
    // Ensure the external 'satellite.js' library is accessible in the global scope
    if (!window.satellite) {
        console.error("Critical: Satellite.js library is missing. Reverting to fallback geometry.");
        return createFallbackCircle(400, color);
    }

    try {
        // Initialize SGP4 satellite record
        const satrec = satellite.twoline2satrec(line1, line2);

        // --- ORBITAL PERIOD DERIVATION ---
        // satrec.no = Mean Motion in radians per minute.
        // We calculate the duration of one full revolution (Period) in minutes.
        // Formula: 1440 / (Mean Motion scaled to revolutions per day)
        const periodMin = 1440 / (satrec.no * (1440 / (2 * Math.PI)));
        const step = periodMin / segments; // Time interval per vertex
        const now = new Date();

        // --- TEMPORAL PROPAGATION LOOP ---
        for (let i = 0; i <= segments; i++) {
            // Predict position at 't' minutes into the future
            const time = new Date(now.getTime() + i * step * 60000);
            const posVel = satellite.propagate(satrec, time);
            const posEci = posVel.position;

            if (posEci) {
                // Convert Earth-Centered Inertial (ECI) to Geodetic (Lat/Lon/Alt)
                const gmst = satellite.gstime(time);
                const posGd = satellite.eciToGeodetic(posEci, gmst);
                
                const lat = satellite.degreesLat(posGd.latitude);
                const lng = satellite.degreesLong(posGd.longitude);
                const alt = posGd.height;

                // --- SPHERICAL TO CARTESIAN TRANSFORMATION ---
                // phi: Polar angle (Latitude) | theta: Azimuthal angle (Longitude)
                // r: Magnitude (Earth radius 6371km + Altitude) scaled to scene units
                const phi = (90 - lat) * (Math.PI / 180);
                const theta = (lng + 180) * (Math.PI / 180);
                const r = (6371 + alt) * (100 / 6371); 

                points.push(new THREE.Vector3(
                    -r * Math.sin(phi) * Math.cos(theta),
                    r * Math.cos(phi),
                    -r * Math.sin(phi) * Math.sin(theta)
                ));
            }
        }

        // --- GEOMETRY ASSEMBLY ---
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // High-visibility material configuration
        const material = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.8,      // Increased for visual clarity in space
            depthWrite: false  // Ensures line remains visible through atmospheric shaders
        });

        // Return the constructed trajectory as a continuous Line
        return new THREE.Line(geometry, material);

    } catch (e) {
        console.error("Suraj, path generation logic failed for TLE set:", e);
        return null;
    }
}

/**
 * EMERGENCY FALLBACK GEOMETRY
 * Used when SGP4 propagation fails or TLE data is malformed.
 * @param {number} alt - Approximation of altitude in km.
 * @param {number} color - Line color.
 */
function createFallbackCircle(alt, color) {
    // Normalizing a simple circular radius for a 0-inclination LEO orbit
    const radius = (6371 + alt) * (100 / 6371);
    const curve = new THREE.EllipseCurve(0, 0, radius, radius);
    const points = curve.getPoints(64);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, opacity: 0.5, transparent: true });
    
    const line = new THREE.LineLoop(geometry, material);
    
    // Rotate 90 degrees on X to align with the Earth's equatorial plane
    line.rotation.x = Math.PI / 2;
    return line;
}