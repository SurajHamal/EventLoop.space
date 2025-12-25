/**
 * @fileoverview Lunar Surface Construction
 * @author Suraj Hamal
 */
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';
import { MOON_RADIUS_UNITS } from '../physics.js';

export function createMoon(textureLoader) {
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 64, 64);
    
    // High-quality NASA texture from a public CDN to avoid 404
    const moonMapUrl = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg';

    const moonMat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(moonMapUrl),
        roughness: 0.9,
        metalness: 0.0
    });

    const moon = new THREE.Mesh(moonGeo, moonMat);
    return moon;
}