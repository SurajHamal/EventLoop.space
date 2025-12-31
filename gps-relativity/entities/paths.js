// entities/paths.js
import * as THREE from 'three';

/**
 * Creates the visual orbital ring for any satellite or body.
 */
export function createOrbitPath(altitude, color = 0x555555) {
    const radius = (6371 + altitude) * (100 / 6371); 
    const points = [];
    const segments = 128; 
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.2 
    });
    
    return new THREE.LineLoop(geometry, material);
}