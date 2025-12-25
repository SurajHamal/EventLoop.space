/**
 * @fileoverview Solar Primary Construction
 * @author Suraj Hamal
 * @description Creates a textured stellar body with a volumetric corona effect.
 */
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';

export function createSun() {
    const sunGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // 1. The Photosphere (The visible surface of the Sun)
    const sunGeometry = new THREE.SphereGeometry(1400, 64, 64);
    
    // Logic: We use MeshBasicMaterial because the Sun is self-illuminated.
    // Map: Solar surface texture (loops of plasma and sunspots).
    const sunTexture = loader.load('./assets/images/sun/sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({
        map: sunTexture,
        color: 0xffcc00 // Warm tint
    });

    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunGroup.add(sunMesh);

    // 2. The Corona (The glowing atmosphere)
    /**
     * @scientific_reasoning The corona is visible as a soft glow. We use a Sprite 
     * because it always faces the camera, simulating a volumetric light effect.
     */
    const coronaTexture = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png');
    const spriteMaterial = new THREE.SpriteMaterial({
        map: coronaTexture,
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending // Makes the colors "bleed" into the background
    });
    const corona = new THREE.Sprite(spriteMaterial);
    corona.scale.set(3500, 3500, 1); // Large scale for the atmosphere
    sunGroup.add(corona);

    // 3. Stellar Rotation logic
    // We will update this in the animate loop to show plasma movement
    sunGroup.userData = { type: 'star' };

    return sunGroup;
}