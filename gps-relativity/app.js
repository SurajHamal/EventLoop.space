/**
 * @fileoverview Main Orchestration Engine - Earth-Moon System
 * @author Suraj Hamal, Computer Scientist
 */

import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';
import * as PHYSICS from './physics.js'; 
import { createSpace } from './space.js';
import { createSun } from './celestial/sun.js';
import { createEarthSystem } from './celestial/earth.js';
import { createMoon } from './celestial/moon.js';
import { createSatellites, updateSatellites } from './entities/satellite.js';
import { createUI, updateUI } from './ui.js';
import { initCameraControls, updateCameraLimits } from './camera.js';

// --- Global State ---
let simulatedTime = new Date(); 
let timeScale = 1000; 
let trackingMode = 'EARTH'; // MODES: 'SUN', 'EARTH', 'MOON', 'SATELLITE'
let activeSatIndex = 0; // Tracks which satellite to follow
const clock = new THREE.Clock();

// --- Helper Functions ---
function createOrbitPath(radius, color = 0xffffff) {
    const points = [];
    const segments = 256; 
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.3 });
    return new THREE.Line(geometry, material);
}

// --- Scene Initialization ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000000);
camera.position.set(0, 400, 1000); 

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    logarithmicDepthBuffer: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;

const controls = initCameraControls(camera, renderer.domElement);

const textureLoader = new THREE.TextureLoader();

// --- System Initialization ---
createSpace(scene);

// SUN & LIGHT SOURCE (Fixed)
const sun = createSun();
scene.add(sun); 
const sunLight = new THREE.PointLight(0xffffff, 5, 0, 0); 
scene.add(sunLight);

// 1. Earth Heliocentric Orbit
const earthOrbitPivot = new THREE.Group();
scene.add(earthOrbitPivot);
scene.add(createOrbitPath(15000, 0xffff00)); 

const { group: earthGroup, earth, clouds } = createEarthSystem(textureLoader);
earthGroup.position.set(15000, 0, 0); 
earthGroup.rotation.z = PHYSICS.AXIAL_TILT_RADIANS;
earthOrbitPivot.add(earthGroup);

// 2. Moon Geocentric Orbit
const moonMesh = createMoon(textureLoader);
const moonOrbitPivot = new THREE.Group();
moonOrbitPivot.rotation.z = PHYSICS.MOON_INCLINATION_RADIANS; 
moonOrbitPivot.add(createOrbitPath(PHYSICS.MOON_DISTANCE_UNITS, 0xffffff));

// Position the moon
moonMesh.position.set(PHYSICS.MOON_DISTANCE_UNITS, 0, 0);

/** * TIDAL LOCKING INITIALIZATION:
 * Rotate the mesh so the same face always points toward the center (Earth).
 * Depending on your texture, this is usually Math.PI / 2 or -Math.PI / 2.
 */
moonMesh.rotation.y = Math.PI / 2; 

moonOrbitPivot.add(moonMesh);
earthGroup.add(moonOrbitPivot);

// 3. GPS Satellites & Paths
for (let i = 0; i < 6; i++) {
    const gpsPivot = new THREE.Group();
    gpsPivot.rotation.z = 0.96; 
    gpsPivot.rotation.y = (i * Math.PI) / 3; 
    gpsPivot.add(createOrbitPath(415, 0x00ffff));
    earthGroup.add(gpsPivot);
}

const satellites = createSatellites(earthGroup, textureLoader);

const uiContainer = createUI({
    onModeChange: (mode) => {
        // If we click GPS while already in SATELLITE mode, go to the next one
        if (mode === 'SATELLITE' && trackingMode === 'SATELLITE') {
            activeSatIndex = (activeSatIndex + 1) % satellites.length;
        } else {
            activeSatIndex = 0; // Reset to first sat when switching from other bodies
        }

        trackingMode = mode;
        updateCameraLimits(controls, mode);

        // SNAP CAMERA TO THE ACTIVE SATELLITE
        if (mode === 'SATELLITE' && satellites && satellites[activeSatIndex]) {
            const targetSat = satellites[activeSatIndex];
            const satWorldPos = new THREE.Vector3();
            targetSat.getWorldPosition(satWorldPos);

            // Teleport camera target and position
            controls.target.copy(satWorldPos);
            camera.position.set(
                satWorldPos.x + 15, // Closer offset for better detail
                satWorldPos.y + 8,
                satWorldPos.z + 15
            );
            controls.update();
        }
    },
    onSpeedChange: (val) => { timeScale = val; },
    onReset: () => { simulatedTime = new Date(); }
});

// --- Main Simulation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    const realDt = clock.getDelta();
    const scaledDt = realDt * timeScale; 
    simulatedTime = new Date(simulatedTime.getTime() + (scaledDt * 1000));

    // Heliocentric Revolution
    earthOrbitPivot.rotation.y += (PHYSICS.EARTH_ORBIT_SPEED || 0.0000002) * scaledDt;

    // Earth Rotation
    if (earth) earth.rotation.y += PHYSICS.EARTH_ROTATION_SPEED * scaledDt;
    if (clouds) clouds.rotation.y += (PHYSICS.EARTH_ROTATION_SPEED * 1.05) * scaledDt;

    // Lunar Rotation
    if (moonOrbitPivot && moonMesh) {
        // 1. The Pivot handles the Moon's position in orbit (Revolution)
        const orbitalIncrement = PHYSICS.MOON_ORBIT_SPEED * scaledDt;
        moonOrbitPivot.rotation.y += orbitalIncrement;
    }

// --- In app.js animate() ---
const targetPos = new THREE.Vector3();

if (trackingMode === 'SATELLITE' && satellites.length > 0) {
    const currentSat = satellites[activeSatIndex];
    if (currentSat) {
        currentSat.getWorldPosition(targetPos);
    }
} else if (trackingMode === 'MOON' && moonMesh) {
    moonMesh.getWorldPosition(targetPos);
} else if (trackingMode === 'SUN') {
    targetPos.set(0, 0, 0);
} else {
    earth.getWorldPosition(targetPos);
}

// Keep a high lerp for satellites to avoid "lagging" behind them
const followSpeed = (trackingMode === 'SATELLITE') ? 0.4 : 0.1;
controls.target.lerp(targetPos, followSpeed);

    // Updates
    updateSatellites(satellites, scaledDt);
    updateUI(uiContainer, satellites, simulatedTime, timeScale);

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});