/**
 * @fileoverview Satellite Systems & Orbital Geometry Engine
 * @author Suraj Hamal, Computer Scientist
 * * CORE ARCHITECTURAL PRINCIPLES:
 * 1. ORBITAL MECHANICS (KEPLERIAN & SGP4):
 * - Circular Velocity Approximation: v = sqrt(GM/r).
 * - TLE Propagation: Utilizes Two-Line Element sets for high-precision 
 * positioning via the SGP4 algorithm (implemented in the main loop).
 * * 2. GEOSPATIAL TRANSFORMATION:
 * - Converts Geodetic coordinates (Lat/Lon/Alt) into 3D Cartesian vectors.
 * - Maps the Earth's radius (R_EARTH ≈ 6,371km) to a normalized 
 * simulation scale (100 units).
 * * 3. HIERARCHICAL SCENE GRAPH:
 * - Satellites are anchored to a global 'SatelliteAnchor' group that 
 * tracks Earth's translation but remains independent of its rotation 
 * to preserve ECI (Earth-Centered Inertial) frame integrity.
 */

import * as THREE from 'three';
import * as PHYSICS from '../physics.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createOrbitPath } from './paths.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Global Visual Constants: Normalizes astronomical distances to scene units
const VISUAL_SCALE = 100 / PHYSICS.R_EARTH;
const SATELLITE_VISUAL_SCALE = 0.15; 

/**
 * STATIC REGISTRY: Fallback dataset used if live API telemetry is unavailable.
 */
const SATELLITE_REGISTRY = [
    { id: "ISS-ALPHA", type: "STATION", altitude: 408000, inclination: 51.6, color: 0xffcc00, launchDate: "1998-11-20" },
    { id: "CHRONOS-01", type: "GPS", altitude: 20200000, inclination: 55, color: 0x00f2ff, launchDate: "2014-05-18" },
    { id: "AURA-NET", type: "LEO", altitude: 1200000, inclination: 98, color: 0x00ffaa, launchDate: "2021-02-14" },
    { id: "STAR-LINK", type: "COMM", altitude: 550000, inclination: 53, color: 0xffffff, launchDate: "2019-11-11" },
    { id: "SPECTER-9", type: "RELAY", altitude: 15000000, inclination: 15, color: 0xff4400, launchDate: "2023-08-30" }
];

/**
 * GENERATE FALLBACK MESH
 * Internal helper to create the original "Gold Foil" satellite if 3D models fail to load.
 */
function createFallbackMesh(textureLoader) {
    const foil = textureLoader.load('./assets/images/satellite/gold_foil.jpg');
    const solar = textureLoader.load('./assets/images/satellite/solar_panel.jpg');
    
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 4), 
        new THREE.MeshStandardMaterial({ map: foil, metalness: 0.8, roughness: 0.3 })
    );
    const p1 = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 2.5), 
        new THREE.MeshStandardMaterial({ map: solar, side: THREE.DoubleSide })
    );
    p1.position.x = 4.5;
    const p2 = p1.clone();
    p2.position.x = -4.5;
    group.add(body, p1, p2);
    return group;
}

/**
 * INITIALIZE SATELLITE CONSTELLATIONS
 * @param {THREE.Group} parent - The ECI Anchor group following Earth's translation.
 * @param {THREE.TextureLoader} textureLoader - Manager for PBR material textures.
 * @returns {Promise<Array<THREE.Group>>} Collection of instantiated satellite mesh groups.
 */
export async function createSatellites(parent, textureLoader) {
    const satellites = [];
    const loader = new GLTFLoader();
    const modelLibrary = {};

    // 1. Asset Mapping: Direct file paths for specific mission profiles
    const modelPaths = {
        'STATION': './assets/images/satellite/sat1.glb',
        'GPS':     './assets/images/satellite/sat2.glb',
        'COMM':    './assets/images/satellite/sat3.glb',
        'RELAY':   './assets/images/satellite/sat4.glb',
        'LEO':     './assets/images/satellite/sat5.glb'
    };

    const modelKeys = Object.keys(modelPaths);

    // 2. Parallel Asset Acquisition: Concurrent loading to minimize blocking of the Main Thread
    await Promise.all(modelKeys.map(async (key) => {
        try {
            const gltf = await loader.loadAsync(modelPaths[key]);
            // Traverse scene graph to enable hardware-accelerated shadows for all sub-meshes
            gltf.scene.traverse(node => { 
                if(node.isMesh) { 
                    node.castShadow = true; 
                    node.receiveShadow = true; 
                }
            });
            modelLibrary[key] = gltf.scene;
        } catch (e) {
            console.warn(`[SatEngine] Model ${key} missing. Using Gold Foil fallback.`);
            modelLibrary[key] = createFallbackMesh(textureLoader);
        }
    }));

    // 3. Data Source Selection: Prioritize live telemetry over pre-defined registry
    const activeData = (window.realSatelliteData && window.realSatelliteData.length > 0) 
                        ? window.realSatelliteData 
                        : SATELLITE_REGISTRY;

    // 4. Scene Construction Loop: Procedural instantiation and spatial orientation
    activeData.forEach((config, i) => {
        // --- VISUAL ROUND-ROBIN LOGIC ---
        // Forces visual variety by cycling through the 5 model types regardless of API classification
        const autoType = modelKeys[i % modelKeys.length];
        const selectedType = modelLibrary[config.type] ? config.type : autoType;
        
        const template = modelLibrary[selectedType];
        const satGroup = template.clone(); // Instantiate unique object from loaded buffer

        satGroup.scale.setScalar(SATELLITE_VISUAL_SCALE);
        
        // Geometric alignment: Aligns model's forward vector with the Earth's geocenter (0,0,0)
        satGroup.lookAt(0, 0, 0);

        // --- CSS2D INTERFACE OVERLAY: DOM-based labels projected to 3D space ---
        const name = config.name || config.id || "Satellite";
        const satDiv = document.createElement('div');
        satDiv.className = 'sat-label';
        satDiv.textContent = name;
        
        // Dynamic styling: Border color corresponds to the satellite's designated hex code
        const col = config.color ? `#${config.color.toString(16).padStart(6, '0')}` : '#00f2ff';
        satDiv.style.borderLeft = `3px solid ${col}`;

        const satLabel = new CSS2DObject(satDiv);
        satLabel.position.set(0, 5, 0); // Offset label above the model center
        satGroup.add(satLabel);

        // --- METADATA: Binds properties to the object for Raycasting and UI selection ---
        satGroup.userData = { ...config, name: name, visualType: selectedType };

        // --- ORBITAL PATH RENDERING ---
        if (config.tle && config.tle.length >= 2) {
            // SGP4 Path: Complex orbital ellipse based on Two-Line Element math
            const path = createOrbitPath(config.tle[0], config.tle[1], config.color || 0x00ffff);
            if (path) {
                parent.add(path); 
            }
        } else if (config.altitude) { 
            // Circular Fallback: Simplified Keplerian path for non-TLE registry data
            const radius = (PHYSICS.R_EARTH + (config.altitude / 1000)) * (100 / PHYSICS.R_EARTH);
            const fallbackPath = createOrbitLine(radius, config.color || 0x444444);
            parent.add(fallbackPath);
        }

        parent.add(satGroup);
        satellites.push(satGroup);
    });

    return satellites;
}

/**
 * CIRCULAR ORBIT VISUALIZER (LEGACY/FALLBACK)
 * Procedural generation of a 128-point vertex loop representing a stable circular orbit.
 */
function createOrbitLine(radius, color) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius);
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.3 
    });
    const line = new THREE.LineLoop(geometry, material);
    // Align plane with the equatorial reference frame
    line.rotation.x = Math.PI / 2; 
    return line;
}