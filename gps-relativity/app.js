/**
 * @fileoverview Main Orchestration Engine - EventLoop Systems
 * Developed by: Suraj Hamal
 * * CORE ARCHITECTURE: 
 * - Temporal Scaling & SGP4 Orbital Propagation
 * - Relativistic Time Dilation Analysis (SR & GR)
 * - Multi-target Camera Kinematics (Lerp-based)
 */

import * as THREE from 'three';
import * as PHYSICS from './physics.js'; 
import { createSpace } from './space.js';
import { createSun } from './celestial/sun.js';
import { createEarthSystem } from './celestial/earth.js';
import { createMoon } from './celestial/moon.js';
import { createSatellites } from './entities/satellite.js';
import { createUI, updateUI, updateMissionControlUI } from './ui.js';
import { initCameraControls, updateCameraLimits } from './camera.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { calculateTelemetry, updateCountry } from './entities/telemetry.js';
import { createOrbitPath } from './entities/paths.js';
import { loadRealSatelliteData } from './api/n2yo.js';

// --- Global Simulation State ---
let simulatedTime = new Date(); // Internal Epoch for propagation
window.timeScale = 1;           // Temporal acceleration multiplier
let trackingMode = 'EARTH';     // Current focus state: EARTH | SATELLITE | SUN | MOON
let focusTarget = { type: 'SYSTEM', index: null }; 
let activeSatIndex = 0;         // Array index for targeted satellite mesh
const clock = new THREE.Clock(); // Precision timer for frame deltas
let lastTelemetryUpdate = 0;    // Throttling timer for heavy UI calculations
let satellites = [];

// --- Render Engine Configuration ---
const scene = new THREE.Scene();

// High-range Perspective Camera to prevent clipping in astronomical scales
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000000);
camera.position.set(15400, 100, 500);

// WebGL Renderer with Logarithmic Depth Buffer for handling Z-fighting in space
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

// CSS2D Overlay for HTML labels (Satellite names/Telemetry)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// Initialize Camera Controls (OrbitControls/Custom)
const controls = initCameraControls(camera, renderer.domElement);
controls.target.set(15000, 0, 0); // Default focus: Earth System

// --- Resource Pipeline ---
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

// Progress tracking for the UI splash screen
loadingManager.onProgress = (url, loaded, total) => {
    const progress = (loaded / total) * 100;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = progress + '%';
};

// --- Celestial Entity Initialization ---
createSpace(scene); // Background stars and galactic field
const sun = createSun();
scene.add(sun); // Primary light/visual center (0,0,0)

const sunLight = new THREE.PointLight(0xffffff, 5, 0, 0);
scene.add(sunLight);

// Earth-Centric Pivot: Handles Earth's orbit around the Sun
const earthOrbitPivot = new THREE.Group();
scene.add(earthOrbitPivot);

// Earth Mesh & Cloud Layer
const { group: earthGroup, earth, clouds } = createEarthSystem(textureLoader);
earthGroup.position.set(15000, 0, 0);
earthOrbitPivot.add(earthGroup);

// Satellite Anchor: Local coordinate system synchronized with Earth
const satelliteAnchor = new THREE.Group();
satelliteAnchor.position.copy(earthGroup.position);
earthOrbitPivot.add(satelliteAnchor);

// Lunar Sub-system
const moonMesh = createMoon(textureLoader);
const moonOrbitPivot = new THREE.Group();
moonMesh.position.set(PHYSICS.MOON_DISTANCE_UNITS, 0, 0);
moonOrbitPivot.add(moonMesh);
earthGroup.add(moonOrbitPivot);

// --- Interface Interaction Logic ---
const uiCallbacks = {
    /** * Target specific satellite and shift camera to an 'Inertial Chase' view
     */
    onSelectGPS: (index) => {
        focusTarget = { type: 'SATELLITE', index: index };
        trackingMode = 'SATELLITE';
        activeSatIndex = index;
        
        updateCameraLimits(controls, 'SATELLITE');

        const targetSat = satellites[index];
        const satPos = new THREE.Vector3();
        targetSat.getWorldPosition(satPos);

        // Vector math to position camera between satellite and Sun for optimal lighting
        const toSun = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), satPos).normalize();
        camera.position.set(
            satPos.x + (toSun.x * 18), 
            satPos.y + 5, 
            satPos.z + (toSun.z * 18)
        );

        // Reduce FOV to compress perspective (Telephoto effect)
        camera.fov = 32; 
        camera.updateProjectionMatrix();

        controls.target.copy(satPos); 
    },

    /** * Global Mode Switching (SUN, MOON, EARTH)
     */
    onModeChange: (mode) => {
        focusTarget = { type: mode, index: null };
        trackingMode = mode;
        updateCameraLimits(controls, mode);

        camera.fov = 45; 
        camera.updateProjectionMatrix();
        
        const targetPos = new THREE.Vector3();

        if (mode === 'SUN') {
            targetPos.set(0, 0, 0);
        } 
        else if (mode === 'MOON') {
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

// --- Simulation Frame Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate Temporal Delta for consistent physics across different refresh rates
    const realDt = clock.getDelta();
    const physicsDt = Math.min(realDt, 0.1); // Clamp to prevent 'jump' on tab focus loss
    const scaledDt = physicsDt * window.timeScale;
    simulatedTime = new Date(simulatedTime.getTime() + (scaledDt * 1000));

    // Dynamic Orbital and Axial Rotations
    earthOrbitPivot.rotation.y += (PHYSICS.EARTH_ORBIT_SPEED || 0.0000002) * scaledDt;
    if (earth) earth.rotation.y += PHYSICS.EARTH_ROTATION_SPEED * scaledDt;
    if (clouds) clouds.rotation.y += (PHYSICS.EARTH_ROTATION_SPEED * 1.05) * scaledDt;
    if (moonOrbitPivot) moonOrbitPivot.rotation.y += PHYSICS.MOON_ORBIT_SPEED * scaledDt;
    
    // Lock satellite coordinate origin to Earth's current spatial position
    satelliteAnchor.position.copy(earthGroup.position);

    const hasRealData = (window.realSatelliteData && window.realSatelliteData.length > 0);

    // Propagate individual satellite trajectories
    satellites.forEach((satMesh, i) => {
        if (!satMesh || !hasRealData || !window.realSatelliteData[i]) return;
        const data = window.realSatelliteData[i];

        if (data && data.tle && data.tle.length >= 2) {
            try {
                // SGP4 Core: Propagate TLE to current simulated time
                const satrec = satellite.twoline2satrec(data.tle[0], data.tle[1]);
                const positionAndVelocity = satellite.propagate(satrec, simulatedTime);
                const positionEci = positionAndVelocity.position;
                const velocityEci = positionAndVelocity.velocity;

                if (positionEci) {
                    // Convert Inertial (ECI) to Geodetic (Lat/Lon/Alt)
                    const gmst = satellite.gstime(simulatedTime);
                    const positionGd = satellite.eciToGeodetic(positionEci, gmst);
                    
                    const lat = satellite.degreesLat(positionGd.latitude);
                    const lng = satellite.degreesLong(positionGd.longitude);
                    const alt = positionGd.height;

                    // Map 3D Space coordinates (r = planet radius + altitude)
                    const phi = (90 - lat) * (Math.PI / 180);
                    const theta = (lng + 180) * (Math.PI / 180);
                    const r = (6371 + alt) * (100 / 6371); 

                    satMesh.position.set(
                        -r * Math.sin(phi) * Math.cos(theta),
                        r * Math.cos(phi),
                        -r * Math.sin(phi) * Math.sin(theta)
                    );

                    // Update CSS Labels
                    const labelObj = satMesh.children.find(c => c.isCSS2DObject);
                    if (labelObj) labelObj.element.textContent = data.name;

                    // --- Advanced Telemetry Calculation (Physics Bridge) ---
                    if (trackingMode === 'SATELLITE' && activeSatIndex === i) {
                        if (Date.now() - lastTelemetryUpdate > 500) {
                            lastTelemetryUpdate = Date.now();

                            // Instantaneous Orbital Velocity Magnitude
                            const v_ms = velocityEci ? Math.sqrt(
                                Math.pow(velocityEci.x, 2) + 
                                Math.pow(velocityEci.y, 2) + 
                                Math.pow(velocityEci.z, 2)
                            ) * 1000 : 7500;

                            const radiusMeters = PHYSICS.R_EARTH + (alt * 1000);

                            // Relativity Factors (SR & GR)
                            const gamma = PHYSICS.getSpecialRelativityFactor(v_ms);
                            const gravFactor = PHYSICS.getGeneralRelativityFactor(radiusMeters);

                            // Net Daily Temporal Drift
                            const netFactor = (gamma * gravFactor) - 1;
                            const dailyDriftNS = netFactor * 86400 * 1e9;

                            const stats = {
                                name: data.name,
                                lat: lat.toFixed(4),
                                lon: lng.toFixed(4),
                                alt: alt.toFixed(2),
                                speed: (v_ms / 1000).toFixed(2),
                                source: data.source || "PREDICTED (SGP4)",
                                dilation: dailyDriftNS.toFixed(2),
                                drift: dailyDriftNS.toFixed(0)
                            };

                            // Geocoding and UI Flush
                            updateCountry(lat, lng, 0)
                                .then(cName => updateMissionControlUI(stats, cName))
                                .catch(() => updateMissionControlUI(stats, "International Waters"));
                        }
                    }
                }
            } catch (err) {
                console.error("Propagation error for " + data.name, err);
            }
        } else if (data && data.directCoords) {
            // --- FALLBACK: Dead Reckoning with Linear Interpolation ---
            const { lat, lng, alt } = data.directCoords;
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            const r = (6371 + alt) * (100 / 6371); 

            const apiPos = new THREE.Vector3(
                -r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                -r * Math.sin(phi) * Math.sin(theta)
            );

            // Simulation drift for visual continuity
            const driftSpeed = 0.00005 * window.timeScale; 
            satMesh.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), driftSpeed);
            satMesh.position.lerp(apiPos, 0.05);

            const labelObj = satMesh.children.find(c => c.isCSS2DObject);
            if (labelObj) labelObj.element.textContent = "📡 " + data.name;

            // Telemetry calculations for live coordinate feed
            if (trackingMode === 'SATELLITE' && activeSatIndex === i) {
                if (Date.now() - lastTelemetryUpdate > 500) {
                    lastTelemetryUpdate = Date.now();
                    const v_ms = 7500;
                    const radiusMeters = PHYSICS.R_EARTH + (alt * 1000);
                    const gamma = PHYSICS.getSpecialRelativityFactor(v_ms);
                    const gravFactor = PHYSICS.getGeneralRelativityFactor(radiusMeters);
                    const netFactor = (gamma * gravFactor) - 1;
                    const dailyDriftNS = netFactor * 86400 * 1e9;

                    updateMissionControlUI({
                        name: data.name, lat: lat.toFixed(4), lon: lng.toFixed(4),
                        alt: alt.toFixed(2), speed: (v_ms / 1000).toFixed(2),
                        source: "LIVE (TELEMETRY)", dilation: dailyDriftNS.toFixed(2),
                        drift: dailyDriftNS.toFixed(0)
                    }, "Direct Feed");
                }
            }
        }
    });

    // --- Camera Kinematics ---
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

    // Dynamic Lerping: Smoother camera transitions
    controls.target.lerp(targetPos, (trackingMode === 'SATELLITE' ? 0.2 : 0.05));
    
    // Core Logic Update Calls
    updateUI(uiContainer, satellites, simulatedTime, window.timeScale, focusTarget);
    
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// --- Asynchronous System Boot Sequence ---
async function startApp() {
    const lines = document.querySelectorAll('.line');
    const updateLine = (idx) => {
        lines.forEach(l => l.classList.remove('active'));
        if(lines[idx]) lines[idx].classList.add('active');
    };

    try {
        updateLine(0); // Initiating Satellite API Stream
        const dataPromise = loadRealSatelliteData();
        
        // Block until Three.js textures are GPU-resident
        await new Promise(resolve => {
            if (loadingManager.isLoading) loadingManager.onLoad = resolve;
            else resolve();
        });
        
        updateLine(1); // Integrating Telemetry Data
        const data = await dataPromise;
        window.realSatelliteData = data;

        satellites = await createSatellites(satelliteAnchor, textureLoader);

        updateLine(2); // Performing Relativity Calculations
        await new Promise(r => setTimeout(r, 500)); 

        updateLine(3); // Finalizing Simulation Frame
        await new Promise(r => setTimeout(r, 400));
        
        // Cinematic Transition to the 3D Scene
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.transition = 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1)';
            loader.style.opacity = '0';
            
            setTimeout(() => {
                loader.style.display = 'none';
                animate(); // Kick off the event loop
            }, 1000);
        }

    } catch (e) {
        console.error("Critical System Boot Failure:", e);
        animate(); 
        const loader = document.getElementById('loading-screen');
        if (loader) loader.style.display = 'none';
    }
}

// Ignition
startApp();

// Viewport Resilience
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});