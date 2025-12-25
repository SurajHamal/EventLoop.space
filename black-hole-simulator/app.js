// 3D Black Hole Simulator using Three.js
// Author: Suraj Hamal
// Date: 2025-12-21

import * as physics from './physics.js';

// -------------------- HTML Elements --------------------
const massSlider = document.getElementById("mass");
const distanceSlider = document.getElementById("distance");
const massValue = document.getElementById("massValue");
const distanceValue = document.getElementById("distanceValue");

// -------------------- Three.js Scene --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 10000);
camera.position.set(0, 0, 500);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -------------------- Lights --------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(500, 500, 500);
scene.add(pointLight);

// -------------------- Black Hole --------------------
let bhRadius = 50;
const bhGeometry = new THREE.SphereGeometry(bhRadius, 64, 64);
const bhMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
const blackHole = new THREE.Mesh(bhGeometry, bhMaterial);
scene.add(blackHole);

// Optional halo
const haloGeometry = new THREE.SphereGeometry(bhRadius * 1.5, 64, 64);
const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x2222ff,
    transparent: true,
    opacity: 0.2
});
const halo = new THREE.Mesh(haloGeometry, haloMaterial);
scene.add(halo);

// -------------------- Orbiting Particle --------------------
const particleGeometry = new THREE.SphereGeometry(5, 16, 16);
const particleMaterial = new THREE.MeshBasicMaterial({color: 0xffff00});
const particle = new THREE.Mesh(particleGeometry, particleMaterial);
scene.add(particle);

let angle = 0;

// -------------------- Animation Loop --------------------
function animate() {
    requestAnimationFrame(animate);

    const mass = parseFloat(massSlider.value);
    const distanceMultiplier = parseFloat(distanceSlider.value);

    massValue.textContent = mass;
    distanceValue.textContent = distanceMultiplier;

    const massKg = mass * physics.solarMass;
    const rs = physics.schwarzschildRadius(massKg);
    bhRadius = Math.min(rs/1000, 50); // scale

    blackHole.scale.set(bhRadius/50, bhRadius/50, bhRadius/50);
    halo.scale.set(bhRadius/50*1.5, bhRadius/50*1.5, bhRadius/50*1.5);

    const orbitRadius = bhRadius * distanceMultiplier * 3; // arbitrary scaling
    const orbitalSpeed = Math.sqrt(physics.G * massKg / (orbitRadius * 1000)) / 1000; 
    angle += orbitalSpeed;

    particle.position.set(
        orbitRadius * Math.cos(angle),
        0,
        orbitRadius * Math.sin(angle)
    );

    renderer.render(scene, camera);
}

animate();
