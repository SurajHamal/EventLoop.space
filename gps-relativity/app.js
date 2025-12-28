/**
 * @fileoverview Main Orchestration Engine for Solar System Simulation
 * EventLoop Lab - Simulates Earth, Moon, Sun, and satellites with realistic physics and UI.
 * * Author: Suraj Hamal, Computer Scientist
 * Date: 2025
 */

import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as PHYSICS from './physics.js'; 
import { createSpace } from './space.js';
import { createSun } from './celestial/sun.js';
import { createEarthSystem } from './celestial/earth.js';
import { createMoon } from './celestial/moon.js';
import { createSatellites, updateSatellites } from './entities/satellite.js';
import { createUI, updateUI } from './ui.js';
import { initCameraControls, updateCameraLimits } from './camera.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// --- Global State Variables ---
let simulatedTime = new Date(); 
let timeScale = 1;   
window.timeScale = 1;         
let trackingMode = 'EARTH';      
let focusTarget = { type: 'SYSTEM', index: null }; 
let activeSatIndex = 0;          
const clock = new THREE.Clock(); 

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
        const satWorldPos = new THREE.Vector3();
        targetSat.getWorldPosition(satWorldPos);

        // Move target instantly, camera follows via lerp in animate()
        controls.target.copy(satWorldPos);
        camera.position.set(satWorldPos.x + 30, satWorldPos.y + 15, satWorldPos.z + 30);
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
    updateSatellites(satellites, scaledDt);

    scene.updateMatrixWorld();

    const targetPos = new THREE.Vector3();
    if (trackingMode === 'SATELLITE' && satellites.length > 0) {
        satellites[activeSatIndex]?.getWorldPosition(targetPos);
    } else if (trackingMode === 'MOON' && moonMesh) {
        moonMesh.getWorldPosition(targetPos);
    } else if (trackingMode === 'SUN') {
        targetPos.set(0, 0, 0);
    } else if (earth) {
        earth.getWorldPosition(targetPos);
    }

    const followSpeed = (trackingMode === 'SATELLITE') ? 0.3 : 0.1;
    controls.target.lerp(targetPos, followSpeed);

    updateUI(uiContainer, satellites, simulatedTime, timeScale, focusTarget);

    controls.update();
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