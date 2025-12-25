import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';

/**
 * @function createSpace
 * @description Creates a procedurally generated starfield at a massive scale.
 */
export function createSpace(scene) {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,             // Small dots for distant stars
        sizeAttenuation: false  // Stars stay the same size regardless of camera distance
    });

    const starVertices = [];
    const starCount = 15000;
    
    // We place stars at a distance of 30,000 to 35,000 units.
    // This is far beyond the Moon's orbit (approx 6,000 units).
    const minRadius = 35000;
    const maxRadius = 40000;

    for (let i = 0; i < starCount; i++) {
        // Random spherical distribution
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const r = minRadius + (Math.random() * (maxRadius - minRadius));

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Set a deep black background color as a fallback
    scene.background = new THREE.Color(0x000005); 
}