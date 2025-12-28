/**
 * @fileoverview Lunar Surface Construction
 * @author Suraj Hamal
 */
import * as THREE from 'three';
import { MOON_RADIUS_UNITS } from '../physics.js';

export function createMoon(textureLoader) {
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 64, 64);
    
    const moonMapUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg';

    const moonMat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(moonMapUrl),
        roughness: 0.9,
        metalness: 0.0
    });

    const moon = new THREE.Mesh(moonGeo, moonMat);
    
    // Internal labels that help the UI identify this object 
    // without using text that extensions might try to translate.
    moon.name = 'MOON_OBJECT';
    moon.userData = { id: 'MOON', type: 'PLANETARY_BODY' };
    
    return moon;
}