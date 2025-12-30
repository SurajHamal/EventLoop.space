/**
 * @fileoverview Satellite System Module
 * Handles creation, visualization, and orbital updates of artificial satellites
 * Author: Suraj Hamal, Computer Scientist
 *
 * Scientific Principles Applied:
 * 1. Newtonian Orbital Mechanics:
 *    - Circular orbit speed: v = √(G * M_earth / r)
 *      where:
 *        G = gravitational constant
 *        M_earth = mass of Earth
 *        r = distance from Earth's center
 *    - Angular velocity: ω = v / r
 *      This determines how fast the satellite moves along its orbit.
 * 2. Orbital Inclination:
 *    - Tilt of orbit relative to Earth's equatorial plane (degrees → radians)
 *    - Implemented as rotation about X/Z axes in Three.js
 * 3. Plane Rotation:
 *    - Distributes satellites around multiple planes for visual separation
 *    - rotation.y applied on a pivot group
 * 4. Visualization Scaling:
 *    - Real distances in meters are scaled down for Three.js scene
 *      VISUAL_SCALE converts R_EARTH (~6.37e6 m) to ~100 units.
 * 5. Optional Relativity:
 *    - Special & General Relativity time dilation approximations
 *    - Stored in userData for potential UI display
 */

import * as THREE from 'three';
import * as PHYSICS from '../physics.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Scaling factor for visualization; converts meters to Three.js units
const VISUAL_SCALE = 100 / PHYSICS.R_EARTH;
const SATELLITE_VISUAL_SCALE = 0.8; // Adjust for realistic size relative to Earth

// Satellite registry containing metadata for each satellite
const SATELLITE_REGISTRY = [
    { id: "ISS-ALPHA", type: "STATION", altitude: 408000, inclination: 51.6, color: 0xffcc00, launchDate: "1998-11-20" },
    { id: "CHRONOS-01", type: "GPS", altitude: 20200000, inclination: 55, color: 0x00f2ff, launchDate: "2014-05-18" },
    { id: "AURA-NET", type: "LEO", altitude: 1200000, inclination: 98, color: 0x00ffaa, launchDate: "2021-02-14" },
    { id: "STAR-LINK", type: "COMM", altitude: 550000, inclination: 53, color: 0xffffff, launchDate: "2019-11-11" },
    { id: "SPECTER-9", type: "RELAY", altitude: 15000000, inclination: 15, color: 0xff4400, launchDate: "2023-08-30" }
];

/**
 * Creates all satellites and attaches them to the parent group.
 * Each satellite has:
 *  - A mesh with body and solar panels
 *  - A pivot for orbital inclination and plane rotation
 *  - An optional label using CSS2DRenderer
 *  - Physics data stored in userData for updates
 * @param {THREE.Group} parent - The parent group that follows Earth
 * @param {THREE.TextureLoader} textureLoader - Loader for satellite textures
 * @returns {Array<THREE.Group>} Array of satellite mesh groups
 */
export function createSatellites(parent, textureLoader) {
    const satellites = [];

    // Load textures for satellite body and solar panels
    const foil = textureLoader.load('./assets/images/satellite/gold_foil.jpg');
    const solar = textureLoader.load('./assets/images/satellite/solar_panel.jpg');

    SATELLITE_REGISTRY.forEach((config, i) => {
        // --- Satellite Mesh Construction ---
        const satGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ map: foil, metalness: 0.8, roughness: 0.3 });
        const panelMat = new THREE.MeshStandardMaterial({ map: solar, side: THREE.DoubleSide });

        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), bodyMat);
        const p1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.5), panelMat);
        p1.position.x = 4.5;
        const p2 = p1.clone();
        p2.position.x = -4.5;

        satGroup.add(body, p1, p2);
        satGroup.scale.setScalar(SATELLITE_VISUAL_SCALE);

        // --- Add Label using CSS2DRenderer ---
        const satDiv = document.createElement('div');
        satDiv.className = 'sat-label';
        satDiv.textContent = config.id;
        satDiv.style.borderLeftColor = `#${config.color.toString(16)}`;

        const satLabel = new CSS2DObject(satDiv);
        satLabel.position.set(0, 5, 0); // Offset above satellite
        satGroup.add(satLabel);

        // --- Orbital Physics ---
        const realRadius = PHYSICS.R_EARTH + config.altitude;        // Actual orbital radius
        const visualRadius = realRadius * VISUAL_SCALE;              // Scaled for visualization
        const inclinationRad = config.inclination * (Math.PI / 180); // Convert inclination to radians
        const planeRotationRad = (i * (360 / SATELLITE_REGISTRY.length)) * (Math.PI / 180);
        const velocity = Math.sqrt(PHYSICS.G * PHYSICS.earthMass / realRadius); // Circular orbital speed

        satGroup.userData = {
            ...config,
            visualRadius,
            realRadius,
            velocity,
            angularVelocity: velocity / realRadius, // Angular speed in radians/sec
            angle: Math.random() * Math.PI * 2      // Random initial position along orbit
        };

        // --- Pivot for orbital inclination and plane rotation ---
        const pivot = new THREE.Group();
        pivot.rotation.y = planeRotationRad; // Rotate orbit plane around Earth
        pivot.rotation.z = inclinationRad;   // Tilt orbit plane for inclination
        pivot.add(satGroup);

        // Place satellite at correct radius along X-axis initially
        satGroup.position.set(visualRadius, 0, 0);

        // Add orbit line for visualization
        const orbitLine = createOrbitLine(visualRadius, config.color);
        pivot.add(orbitLine);

        // Attach pivot to parent (Earth-following anchor)
        parent.add(pivot);

        satellites.push(satGroup);
    });

    return satellites;
}

/**
 * Generates a simple circular orbit line for visualization
 * @param {number} radius - Orbit radius (scaled)
 * @param {number} color - Line color
 * @returns {THREE.Line} Orbit line mesh
 */
function createOrbitLine(radius, color) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius);
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.3 });
    const line = new THREE.LineLoop(geometry, material);
    line.rotation.x = Math.PI / 2; // Convert XY plane to XZ plane for Three.js
    return line;
}

/**
 * Updates satellite positions along their orbit based on elapsed time
 * @param {Array<THREE.Group>} satellites - Array of satellite groups
 * @param {number} dt - Delta time in seconds (scaled)
 */
export function updateSatellites(satellites, dt) {
    if (!satellites) return;

    satellites.forEach(sat => {
        const d = sat.userData;
        d.angle += d.angularVelocity * dt;

        // Compute new XZ position along circular orbit
        const x = d.visualRadius * Math.cos(d.angle);
        const z = d.visualRadius * Math.sin(d.angle);

        sat.position.set(x, 0, z);
        sat.lookAt(0, 0, 0); // Always face Earth

        // Optional: relativistic time updates (currently unused)
        d.earthTime += dt;
        d.satTime += dt * PHYSICS.getSpecialRelativityFactor(d.velocity) * PHYSICS.getGeneralRelativityFactor(d.realRadius);
    });
}
