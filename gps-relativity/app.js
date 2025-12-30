/**
 * @fileoverview Main Orchestration Engine for Solar System Simulation
 * EventLoop Lab - Simulates Earth, Moon, Sun, and satellites with realistic physics and UI.
 * * Author: Suraj Hamal, Computer Scientist
 * Date: 2025
 */

import * as THREE from 'three';
import * as PHYSICS from './physics.js'; 
import { createSpace } from './space.js';
import { createSun } from './celestial/sun.js';
import { createEarthSystem } from './celestial/earth.js';
import { createMoon } from './celestial/moon.js';
import { createSatellites, updateSatellites } from './entities/satellite.js';
import { createUI, updateUI } from './ui.js';
import { initCameraControls, updateCameraLimits } from './camera.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { calculateTelemetry, updateCountry } from './entities/telemetry.js';

// --- Global State Variables ---
let simulatedTime = new Date(); 
let timeScale = 1;   
window.timeScale = 1;         
let trackingMode = 'EARTH';      
let focusTarget = { type: 'SYSTEM', index: null }; 
let activeSatIndex = 0;          
const clock = new THREE.Clock(); 
let totalDriftNanoseconds = 0;
let lastTargetID = null;
let lastTelemetryUpdate = 0;

// --- CLICK DETECTION GLOBALS ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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

async function loadRealSatelliteData() {
    // This uses the AllOrigins proxy which is often more reliable for CelesTrak
const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json')}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let satArray = null;

        // 1. Check if the response is already a clean array
        if (Array.isArray(data)) {
            satArray = data;
        } 
        // 2. If it's an object, look inside for common proxy wrappers
        else if (data && typeof data === 'object') {
            satArray = data.data || data.results || data.contents || data.items;
            
            // 3. SPECIAL FIX: If the proxy returned the list as a STRING, turn it into JSON
            if (typeof satArray === 'string') {
                try {
                    satArray = JSON.parse(satArray);
                } catch (e) {
                    console.error("Proxy returned a string that isn't valid JSON");
                }
            }
        }

        // 4. Final Validation: If we still don't have an array, trigger the simulation fallback
        if (!satArray || !Array.isArray(satArray)) {
            console.warn("Mission Control: API format unrecognized. Switching to Simulation Mode.");
            return []; 
        }

        // 5. Clean and Map the data for the physics engine
        return satArray
            .filter(sat => sat && sat.TLE_LINE1 && sat.TLE_LINE2) 
            .slice(0, 50) 
            .map(sat => {
                try {
                    return {
                        name: sat.OBJECT_NAME || "Unknown Satellite",
                        satrec: satellite.twoline2satrec(
                            sat.TLE_LINE1.trim(), 
                            sat.TLE_LINE2.trim()
                        )
                    };
                } catch (err) {
                    return null;
                }
            })
            .filter(sat => sat !== null);

    } catch (e) {
        console.error("Uplink Failed (TLE Fetch Error):", e);
        return []; // Returns empty array to trigger simulated data
    }
}

// --- Scene Initialization ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000000);
camera.position.set(15400, 100, 500); 

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

const sun = createSun();
scene.add(sun);
const sunLight = new THREE.PointLight(0xffffff, 5, 0, 0); 
scene.add(sunLight);

const earthOrbitPivot = new THREE.Group();
scene.add(earthOrbitPivot);
scene.add(createOrbitPath(15000, 0xffff00)); 

const { group: earthGroup, earth, clouds } = createEarthSystem(textureLoader);
earthGroup.position.set(15000, 0, 0); 
earthGroup.rotation.z = PHYSICS.AXIAL_TILT_RADIANS; 
earthOrbitPivot.add(earthGroup);

const satelliteAnchor = new THREE.Group();
satelliteAnchor.position.copy(earthGroup.position);
earthOrbitPivot.add(satelliteAnchor);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const moonMesh = createMoon(textureLoader);
const moonOrbitPivot = new THREE.Group();
moonOrbitPivot.rotation.z = PHYSICS.MOON_INCLINATION_RADIANS; 
moonOrbitPivot.add(createOrbitPath(PHYSICS.MOON_DISTANCE_UNITS, 0xffffff));
moonMesh.position.set(PHYSICS.MOON_DISTANCE_UNITS, 0, 0);
moonMesh.rotation.y = Math.PI / 2; 
moonOrbitPivot.add(moonMesh);
earthGroup.add(moonOrbitPivot);

const satellites = createSatellites(satelliteAnchor, textureLoader);

const uiContainer = createUI({
    onSelectGPS: (index) => {
        focusTarget = { type: 'SATELLITE', index: index };
        trackingMode = 'SATELLITE';
        activeSatIndex = index;
        
        // Use your existing module function
        updateCameraLimits(controls, 'SATELLITE');

const targetSat = satellites[index];
    const satPos = new THREE.Vector3();
    targetSat.getWorldPosition(satPos);

    // 1. Get direction from satellite to Sun (0,0,0)
    const toSun = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), satPos).normalize();

    // 2. Move camera 20 units TOWARDS the sun from the satellite
    // This ensures the lit side is facing you
    camera.position.set(
        satPos.x + (toSun.x * 20),
        satPos.y + 5, // Keep a little height for 3D depth
        satPos.z + (toSun.z * 20)
    );
        // Move target instantly, camera follows via lerp in animate()
        controls.target.copy(satPos);    
    },
    onModeChange: (mode) => {
        focusTarget = { type: mode, index: null };
        trackingMode = mode;
        
        // Use your existing module function
        updateCameraLimits(controls, mode);
        
        // Set camera target based on body
        const targetPos = new THREE.Vector3();
        if (mode === 'SUN') {
            targetPos.set(0, 0, 0);
        } else if (mode === 'MOON') {
            moonMesh.getWorldPosition(targetPos);
            camera.position.set(
            targetPos.x + 90, 
            targetPos.y + 90, 
            targetPos.z + 90
        );
        } else {
            earth.getWorldPosition(targetPos);
        }
        
        controls.target.copy(targetPos);
    },
    onSpeedChange: (val) => { window.timeScale = val; },
    onReset: () => { simulatedTime = new Date(); }
});

window.addEventListener('selectGPS', (e) => uiContainer.callbacks.onSelectGPS(e.detail));
window.addEventListener('backToSystem', () => {
    focusTarget = { type: 'SYSTEM', index: null };
    trackingMode = 'EARTH';
    updateCameraLimits(controls, 'EARTH');
});

function animate() {
    requestAnimationFrame(animate);
    
    const realDt = clock.getDelta();                 
    const physicsDt = Math.min(realDt, 0.1);          
    const scaledDt = physicsDt * (window.timeScale || 1000);          

    simulatedTime = new Date(simulatedTime.getTime() + (scaledDt * 1000));

        // --- Update the Time Display in UI ---
    if (uiContainer && uiContainer.updateSimulatedTime) {
        uiContainer.updateSimulatedTime(simulatedTime);
    }

    earthOrbitPivot.rotation.y += (PHYSICS.EARTH_ORBIT_SPEED || 0.0000002) * scaledDt;

    if (earth) earth.rotation.y += PHYSICS.EARTH_ROTATION_SPEED * scaledDt;
    if (clouds) clouds.rotation.y += (PHYSICS.EARTH_ROTATION_SPEED * 1.05) * scaledDt;

    if (moonOrbitPivot && moonMesh) moonOrbitPivot.rotation.y += PHYSICS.MOON_ORBIT_SPEED * scaledDt;

    satelliteAnchor.position.copy(earthGroup.position);
    
    // --- NEW REAL-TIME DATA LOGIC ---
    /* 
    1. The Physics Behind the DataTo provide real scientific data, we calculate the following:
    Altitude: The distance from the satellite to Earth's center minus Earth's mean radius ($6,371\text{ km}$).
    Velocity: The magnitude of the velocity vector $(\sqrt{v_x^2 + v_y^2 + v_z^2})$ provided by the SGP4 algorithm in $\text{km/s}$.Special 
    Relativistic Dilation: Time slows down due to high velocity ($\approx -0.5 \cdot \frac{v^2}{c^2}$).
    General Relativistic Dilation: Time speeds up as you move away from Earth's gravity ($\approx \frac{G \cdot M}{c^2} \cdot (\frac{1}{R_{\text{earth}}} - \frac{1}{R_{\text{sat}}})$).
    */
// --- NEW REAL-TIME DATA LOGIC WITH TELEMETRY ---
const hasRealData = (window.realSatelliteData && window.realSatelliteData.length > 0);

// We always want to loop through our 3D satellite objects
satellites.forEach((satMesh, i) => {
    let pos, vel, name;
    const data = hasRealData ? window.realSatelliteData[i] : null;

    // 1. POSITIONING LOGIC
    if (data && data.satrec) {
        // SCENARIO A: Real TLE Data
        const posAndVel = satellite.propagate(data.satrec, simulatedTime);
        pos = posAndVel.position;
        vel = posAndVel.velocity;
        name = data.name;

        if (pos) {
            const s = 100 / 6371; 
            satMesh.position.set(
                (pos.x * s) + earthGroup.position.x,
                (pos.z * s) + earthGroup.position.y,
                (pos.y * s) + earthGroup.position.z
            );
        }
    } else {
        // SCENARIO B: API FAILED / Procedural Satellites
        // Move them using your old physics module first
        updateSatellites([satMesh], scaledDt); 

        // Extract data for telemetry calculations
        const d = satMesh.userData;
        pos = { 
            x: (satMesh.position.x - earthGroup.position.x) / (100/6371),
            y: (satMesh.position.y - earthGroup.position.y) / (100/6371),
            z: (satMesh.position.z - earthGroup.position.z) / (100/6371)
        };
        // Approximate velocity in km/s (assuming 7.5 km/s for LEO)
        vel = { x: 7.5, y: 0, z: 0 }; 
        name = d.id || `SIM-SAT-${i}`;
    }

    // 2. TELEMETRY & UI UPDATE (Only for focused satellite)
    const canUpdateTelemetry = Date.now() - lastTelemetryUpdate > 500;
    
    if (trackingMode === 'SATELLITE' && activeSatIndex === i && pos && vel && canUpdateTelemetry) {
        lastTelemetryUpdate = Date.now();

        const stats = calculateTelemetry({ name }, pos, vel, simulatedTime, scaledDt);

        // Geocoding
        updateCountry(stats.lat, stats.lon, realDt).then(countryName => {
            // Update the main Mission Control UI
            updateMissionControlUI(stats, countryName);
            
        }).catch(err => {
            // Even if geocoding fails, still update the UI with "Unknown" location
            updateMissionControlUI(stats, "Signal Interrupted");
        });
    }
});

// Hide overlay if not in satellite mode
if (trackingMode !== 'SATELLITE') {
    const overlay = document.getElementById('satellite-data-overlay');
    if (overlay) overlay.style.display = 'none';
}

    scene.updateMatrixWorld();

const targetPos = new THREE.Vector3();

    // Determine the focus point based on the mode
    if (trackingMode === 'SATELLITE' && satellites[activeSatIndex]) {
        satellites[activeSatIndex].getWorldPosition(targetPos);
    } else if (trackingMode === 'MOON' && moonMesh) {
        // This makes the Moon the pivot point for rotation
        moonMesh.getWorldPosition(targetPos);
    } else if (trackingMode === 'SUN') {
        targetPos.set(0, 0, 0);
    } else {
        // Default: Earth is the pivot
        earth.getWorldPosition(targetPos);
    }

    // Use your follow speed logic
    // 0.3 for fast-moving satellites, 0.1 for smooth planet rotation
    const followSpeed = (trackingMode === 'SATELLITE') ? 0.3 : 0.1;
    
    // This is what allows you to "look around" while staying attached
    controls.target.lerp(targetPos, followSpeed);

    // Update the UI
    updateUI(uiContainer, satellites, simulatedTime, window.timeScale, focusTarget);

    // Hide the mission control if we are not in satellite mode
    if (trackingMode !== 'SATELLITE') {
        const panel = document.getElementById('mission-control-panel');
        if (panel) panel.style.display = 'none';
    }
        
    controls.update(); // Vital for OrbitControls damping to work
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera); 
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// --- CLICK DETECTION LISTENER ---
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(satellites, true);

    if (intersects.length > 0) {
        let clickedObj = intersects[0].object;
        while (clickedObj.parent && !clickedObj.userData.id) {
            clickedObj = clickedObj.parent;
        }

        const index = satellites.indexOf(clickedObj);
        if (index !== -1) {
            uiContainer.callbacks.onSelectGPS(index);
        }
    }
});

// AT THE VERY BOTTOM OF app.js
loadRealSatelliteData().then(data => {
    window.realSatelliteData = data;
});

function updateMissionControlUI(stats, countryName) {
const panel = document.getElementById('mission-control-panel');
const content = document.getElementById('mission-content');

if (panel && content) {
    panel.style.display = 'block'; // Reveal the UI.js panel

    // Determine if we are using real data or fallback
    const isReal = window.realSatelliteData && window.realSatelliteData.length > 0;
    const statusColor = isReal ? '#00ff88' : '#ffa500'; // Green vs Orange
    const sourceLabel = isReal ? 'LIVE UPLINK (CELESTRAK)' : 'INTERNAL SIMULATION'

    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(0,242,255,0.2); padding-bottom: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 8px ${statusColor};"></div>
            <div style="font-size: 9px; letter-spacing: 1px; color: ${statusColor}">${sourceLabel}</div>
        </div>

        <div class="hud-row">
            <div class="hud-label">SATELLITE IDENTIFIER</div>
            <div class="hud-val">${stats.name}</div>
        </div>
        <div class="hud-row">
            <div class="hud-label">GEOSPATIAL LOCUS</div>
            <div class="hud-val" style="color: var(--neon); font-size: 11px;">${countryName}</div>
        </div>
        <div class="hud-row">
            <div class="hud-label">ALTITUDE / VELOCITY</div>
            <div class="hud-val">${stats.alt} KM <span style="font-size:10px; opacity:0.5;">@</span> ${stats.speed} KM/H</div>
        </div>
        <div class="hud-row">
            <div class="hud-label">TEMPORAL DILATION (NET)</div>
            <div class="hud-val" style="color: ${stats.dilation > 0 ? '#00ff88' : '#ff4444'}">
                ${stats.dilation > 0 ? '+' : ''}${stats.dilation} ns/day
            </div>
        </div>
        <div class="hud-row">
            <div class="hud-label">TOTAL ACCUMULATED DRIFT</div>
            <div class="hud-val" style="color: var(--neon); text-shadow: 0 0 10px rgba(0,242,255,0.5);">
                ${stats.drift} ns
            </div>
        </div>
    `;
} else {
    updateSatellites([satMesh], scaledDt); 
    
    // We create "Fake" stats using the 3D position of the mesh
    const stats = {
        name: satMesh.userData.id || `SIM-SAT-${i}`,
        alt: ((satMesh.position.length() * 6371 / 100) - 6371).toFixed(2),
        speed: "27500", // Standard LEO speed
        lat: 0, lon: 0, // Placeholder
        dilation: 0.003,
        drift: (performance.now() / 1000).toFixed(1)
    };

    if (trackingMode === 'SATELLITE' && activeSatIndex === i) {
        updateMissionControlUI(stats, "OFFLINE / PREDICTED");
    }
}
}