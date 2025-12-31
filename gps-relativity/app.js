/**
 * @fileoverview Main Orchestration Engine - EventLoop Systems
 * Refactored for fancy loading and stable telemetry.
 */

import * as THREE from 'three';
import * as PHYSICS from './physics.js'; 
import { createSpace } from './space.js';
import { createSun } from './celestial/sun.js';
import { createEarthSystem } from './celestial/earth.js';
import { createMoon } from './celestial/moon.js';
import { createSatellites, updateSatellites } from './entities/satellite.js';
import { createUI, updateUI, updateMissionControlUI } from './ui.js';
import { initCameraControls, updateCameraLimits } from './camera.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { calculateTelemetry, updateCountry } from './entities/telemetry.js';
import { createOrbitPath } from './entities/paths.js';
import { loadRealSatelliteData } from './api/n2yo.js';

// --- Global State ---
let simulatedTime = new Date(); 
window.timeScale = 1; 
let trackingMode = 'EARTH'; 
let focusTarget = { type: 'SYSTEM', index: null }; 
let activeSatIndex = 0; 
const clock = new THREE.Clock(); 
let lastTelemetryUpdate = 0;

// --- Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000000);
camera.position.set(15400, 100, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const controls = initCameraControls(camera, renderer.domElement);
controls.target.set(15000, 0, 0);
// --- Asset Loading Manager ---
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

loadingManager.onProgress = (url, loaded, total) => {
    const progress = (loaded / total) * 100;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = progress + '%';
};

// --- Initialization ---
createSpace(scene);
const sun = createSun();
scene.add(sun);
const sunLight = new THREE.PointLight(0xffffff, 5, 0, 0);
scene.add(sunLight);

const earthOrbitPivot = new THREE.Group();
scene.add(earthOrbitPivot);

const { group: earthGroup, earth, clouds } = createEarthSystem(textureLoader);
earthGroup.position.set(15000, 0, 0);
earthOrbitPivot.add(earthGroup);

const satelliteAnchor = new THREE.Group();
satelliteAnchor.position.copy(earthGroup.position);
earthOrbitPivot.add(satelliteAnchor);

const moonMesh = createMoon(textureLoader);
const moonOrbitPivot = new THREE.Group();
moonMesh.position.set(PHYSICS.MOON_DISTANCE_UNITS, 0, 0);
moonOrbitPivot.add(moonMesh);
earthGroup.add(moonOrbitPivot);

const satellites = createSatellites(satelliteAnchor, textureLoader);

// --- UI Callbacks ---
const uiCallbacks = {
    onSelectGPS: (index) => {
        focusTarget = { type: 'SATELLITE', index: index };
        trackingMode = 'SATELLITE';
        activeSatIndex = index;
        
        updateCameraLimits(controls, 'SATELLITE');

        const targetSat = satellites[index];
        const satPos = new THREE.Vector3();
        targetSat.getWorldPosition(satPos);

        // 1. POSITION: Move closer (8 units instead of 20)
        const toSun = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), satPos).normalize();
        camera.position.set(
            satPos.x + (toSun.x * 18), 
            satPos.y + 5, 
            satPos.z + (toSun.z * 18)
        );

        // 2. LENS: Tighten the FOV (25 degrees)
        // This makes the Earth look massive in the background
        camera.fov = 32; 
        camera.updateProjectionMatrix();

        controls.target.copy(satPos); 
    },
    onModeChange: (mode) => {
        focusTarget = { type: mode, index: null };
        trackingMode = mode;
        updateCameraLimits(controls, mode);

        // 3. RESET LENS: Go back to wide-angle (45 degrees)
        camera.fov = 45; 
        camera.updateProjectionMatrix();
        
        const targetPos = new THREE.Vector3();
        if (mode === 'SUN') {
            targetPos.set(0, 0, 0);
        } else if (mode === 'MOON') {
            moonMesh.getWorldPosition(targetPos);
            camera.position.set(targetPos.x + 90, targetPos.y + 90, targetPos.z + 90);
        } else {
            earth.getWorldPosition(targetPos);
        }
        
        controls.target.copy(targetPos);
    },
    onSpeedChange: (val) => { window.timeScale = val; },
    onReset: () => { simulatedTime = new Date(); }
};

const uiContainer = createUI(uiCallbacks);

// --- Core Logic Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    const realDt = clock.getDelta();
    const physicsDt = Math.min(realDt, 0.1);
    const scaledDt = physicsDt * window.timeScale;
    simulatedTime = new Date(simulatedTime.getTime() + (scaledDt * 1000));

    // Rotation Physics
    earthOrbitPivot.rotation.y += (PHYSICS.EARTH_ORBIT_SPEED || 0.0000002) * scaledDt;
    if (earth) earth.rotation.y += PHYSICS.EARTH_ROTATION_SPEED * scaledDt;
    if (clouds) clouds.rotation.y += (PHYSICS.EARTH_ROTATION_SPEED * 1.05) * scaledDt;
    if (moonOrbitPivot) moonOrbitPivot.rotation.y += PHYSICS.MOON_ORBIT_SPEED * scaledDt;
    
    satelliteAnchor.position.copy(earthGroup.position);

    const hasRealData = (window.realSatelliteData && window.realSatelliteData.length > 0);

    satellites.forEach((satMesh, i) => {
        const data = hasRealData ? window.realSatelliteData[i] : null;
        let pos, vel;

        if (data && data.directCoords) {
            // Real Telemetry Position
            const { lat, lng, alt } = data.directCoords;
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            const r = (6371 + alt) * (100 / 6371); 

            satMesh.position.set(
                -r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                -r * Math.sin(phi) * Math.sin(theta)
            );
            
            // Sync Label
            const labelObj = satMesh.children.find(c => c.isCSS2DObject);
            if (labelObj) labelObj.element.textContent = data.name;

            pos = { x: satMesh.position.x / (100/6371), y: satMesh.position.y / (100/6371), z: satMesh.position.z / (100/6371) };
            vel = { x: 7.5, y: 0, z: 0 }; 
        } else {
            // Fallback Physics
            updateSatellites([satMesh], scaledDt);
            pos = { x: (satMesh.position.x) / (100/6371), y: (satMesh.position.y) / (100/6371), z: (satMesh.position.z) / (100/6371) };
            vel = { x: 7.5, y: 0, z: 0 };
        }

        // Telemetry Update
        if (trackingMode === 'SATELLITE' && activeSatIndex === i && (Date.now() - lastTelemetryUpdate > 500)) {
            lastTelemetryUpdate = Date.now();
            const name = data ? data.name : `SIM-SAT-${i}`;
            const stats = calculateTelemetry({ name }, pos, vel, simulatedTime, scaledDt);

            updateCountry(stats.lat, stats.lon, realDt)
                .then(cName => updateMissionControlUI(stats, cName))
                .catch(() => updateMissionControlUI(stats, "International Waters"));
        }
    });

    // Camera Tracking
    const targetPos = new THREE.Vector3();
    if (trackingMode === 'SATELLITE' && satellites[activeSatIndex]) {
        satellites[activeSatIndex].getWorldPosition(targetPos);
    } else if (trackingMode === 'MOON') {
        moonMesh.getWorldPosition(targetPos);
    } else if (trackingMode === 'SUN') {
        targetPos.set(0, 0, 0);
    } else {
        earth.getWorldPosition(targetPos);
    }

    controls.target.lerp(targetPos, (trackingMode === 'SATELLITE' ? 0.2 : 0.05));
    
    updateUI(uiContainer, satellites, simulatedTime, window.timeScale, focusTarget);
    
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// --- Place this at the absolute bottom of app.js ---

async function startApp() {
    // 1. Grab terminal lines for the fancy animation
    const lines = document.querySelectorAll('.line');
    const updateLine = (idx) => {
        lines.forEach(l => l.classList.remove('active'));
        if(lines[idx]) lines[idx].classList.add('active');
    };

    try {
        // Step 1: Initialization
        updateLine(0); 
        const dataPromise = loadRealSatelliteData(); // Start API fetch in background
        
        // Step 2: Wait for Textures (Earth, Moon, Stars)
        // We wait for the Three.js LoadingManager to finish
        await new Promise(resolve => {
            if (loadingManager.isLoading) loadingManager.onLoad = resolve;
            else resolve();
        });
        
        updateLine(1);
        const data = await dataPromise;
        window.realSatelliteData = data;

        // Step 3: Calculation pause
        updateLine(2);
        await new Promise(r => setTimeout(r, 500)); 

        // Step 4: Finalizing
        updateLine(3);
        await new Promise(r => setTimeout(r, 400));
        
        // --- THE TRANSITION ---
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.transition = 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1)';
            loader.style.opacity = '0';
            
            setTimeout(() => {
                loader.style.display = 'none';
                // START THE ANIMATION LOOP ONLY NOW
                animate(); 
            }, 1000);
        }

    } catch (e) {
        console.error("Critical System Boot Failure:", e);
        // Emergency Fallback: If API fails, start the app anyway so it's not stuck
        animate(); 
        const loader = document.getElementById('loading-screen');
        if (loader) loader.style.display = 'none';
    }
}

// THE TRIGGER: This actually kicks everything off
startApp();

// Events
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});