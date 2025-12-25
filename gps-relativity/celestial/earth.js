/**
 * @fileoveriew Earth Terrestrial System Construction
 * @author Suraj Hamal, Computer Scientist
 * * LOGIC ARCHITECTURE:
 * This module utilizes a multi-layered spherical approach to simulate a 
 * Physically Based Rendering (PBR) model of Earth. It adheres to 
 * SI-derived volumetric scales where 100 units = 6,371km (Earth Mean Radius).
 * * LAYERING HIERARCHY:
 * 1. Lithosphere (Core Mesh): Opaque, PBR-enabled surface.
 * 2. Anthropogenic Radiance (Night Lights): Additive light-blending shell.
 * 3. Troposphere (Cloud Layer): Alpha-mapped moisture distribution.
 * 4. Rayleigh Scattering (Atmospheric Halo): Back-face culled gas simulation.
 */

import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';

export function createEarthSystem(textureLoader) {
    // -------------------------------------------------------------------------
    // CONTAINER INITIALIZATION
    // -------------------------------------------------------------------------
    // We initialize a THREE.Group to encapsulate all sub-systems.
    // This allows for global transformations (like orbital tilt) without
    // disrupting individual axial rotations of the atmosphere or crust.
    const group = new THREE.Group();

    // -------------------------------------------------------------------------
    // 1. THE LITHOSPHERE (Crust & Water)
    // -------------------------------------------------------------------------
    // DIMENSIONS: Radius 100. Reference: Earth Mean Radius (6,371km).
    const earthGeo = new THREE.SphereGeometry(100, 64, 64);
    
    const earthMat = new THREE.MeshStandardMaterial({ 
        // DIFFUSE MAP: Represents the albedo (reflectivity) of the planet surface.
        map: textureLoader.load('./assets/images/earth/earth_day.jpg'),
        
        // EMISSIVE PROPERTIES: Represents internal light generation (City Lights).
        // Using a 0.6 intensity provides a base 'glow' without overwhelming the sun side.
        emissiveMap: textureLoader.load('./assets/images/earth/earth_night.jpg'),
        emissive: new THREE.Color(0xfff0b3), 
        emissiveIntensity: 0.6,
        
        // ROUGHNESS MAP (SPECULAR LOGIC):
        // This is the core of the realism. In PBR, the roughnessMap defines 
        // micro-surface detail. Oceans (black on map) get a value near 0 (shiny),
        // while continents (white on map) get a value near 1 (diffuse/matte).
        roughnessMap: textureLoader.load('./assets/images/earth/earth_specular.jpg'), 
        roughness: 1.0, 
        metalness: 0.0, // Dielectric material (Earth is rock/water, not metal).

        // RENDERING PIPELINE STABILITY:
        // Explicitly disabling transparency prevents the 'Ghosting' depth-sorting bug.
        transparent: false,
        depthWrite: true
    });
    
    const earth = new THREE.Mesh(earthGeo, earthMat);
    group.add(earth);

    // -------------------------------------------------------------------------
    // 2. ANTHROPOGENIC RADIANCE (City Glow Layer)
    // -------------------------------------------------------------------------
    // LOGIC: To avoid city lights looking 'flat', we overlay a secondary mesh.
    // Using AdditiveBlending mimics how light pollution scatters into space.
    const nightMat = new THREE.MeshBasicMaterial({
        map: textureLoader.load('./assets/images/earth/earth_night.jpg'),
        blending: THREE.AdditiveBlending, // Mathematically adds pixel colors.
        transparent: true,
        opacity: 0.4, // Calibrated for subtle night-side visibility.
        color: new THREE.Color(0xffaa55), // Sodium-vapor lamp spectrum.
        depthWrite: false // Do not block the Earth mesh from the GPU depth-buffer.
    });
    
    const nightLights = new THREE.Mesh(earthGeo, nightMat);
    
    // SCALE CALIBRATION: 1.0005 (Sit 3.1km above the crust).
    // This solves Z-fighting (stochastic flickering) where the two meshes overlap.
    nightLights.scale.set(1.0005, 1.0005, 1.0005);
    earth.add(nightLights); // Attach to parent for synchronized rotation.

    // -------------------------------------------------------------------------
    // 3. THE TROPOSPHERE (Cloud Layer)
    // -------------------------------------------------------------------------
    // SCALE: 100.4 units (~25km altitude). 
    // While 99% of clouds are <15km, 100.4 provides the best visual parallax
    // without looking like the clouds are in deep space.
    const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(100.4, 64, 64),
        new THREE.MeshStandardMaterial({ 
            map: textureLoader.load('./assets/images/earth/earth_clouds.png'), 
            transparent: true, 
            opacity: 0.3, 
            depthWrite: false // Allows the viewer to see the continents through the clouds.
        })
    );
    group.add(clouds);

    // -------------------------------------------------------------------------
    // 4. RAYLEIGH SCATTERING (Atmospheric Boundary)
    // -------------------------------------------------------------------------
    // SCIENCE: The atmosphere doesn't have a hard edge, but the 'Karman Line' 
    // at 100km is the visual boundary. 100km / 6,371km = 0.0157.
    // RADIUS: 101.57 units.
    const atmosphereGeo = new THREE.SphereGeometry(101.57, 64, 64);
    
    const atmosphereMat = new THREE.MeshBasicMaterial({ 
        // COLOR LOGIC: 0x437ab3 matches the specific blue wavelength of 
        // Earth's atmosphere observed from the Low Earth Orbit (LEO).
        color: 0x437ab3, 
        transparent: true, 
        opacity: 0.25, 
        // BACKSIDE RENDERING: We render the inner faces of the sphere. 
        // This creates the 'Limb Glow' effect where the atmosphere is 
        // thickest at the visual edges of the planet.
        side: THREE.BackSide 
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    group.add(atmosphere);

    // -------------------------------------------------------------------------
    // DATA RETURN
    // -------------------------------------------------------------------------
    // Exporting critical components for the main Animation Loop.
    return { 
        group,    // The master container.
        earth,    // The crust (for axial rotation).
        clouds    // The clouds (for separate wind-speed rotation).
    };
}