import * as THREE from 'three';

export class ParticleEngine {
    constructor(scene, count = 5000, holeRadius = 2.8) {
        this.scene = scene;
        this.count = count;
        this.holeRadius = holeRadius;
        this.particles = null;
        this.velocities = new Float32Array(count * 3);
        
        this.init();
    }

    init() {
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        const color = new THREE.Color();

        for (let i = 0; i < this.count; i++) {
            this.resetParticle(i, positions, this.velocities);
            
            
            // Give particles a gradient based on distance
            color.setHSL(0.05 + (Math.random() * 0.1), 1.0, 0.5);
            color.toArray(colors, i * 3);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.04,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    resetParticle(i, pos, vel) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 8 + Math.random() * 15;
        
        pos[i * 3] = Math.cos(angle) * distance;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5; // Very thin disk
        pos[i * 3 + 2] = Math.sin(angle) * distance;

        // Initial tangential velocity (Start them in an orbit)
        vel[i * 3] = -Math.sin(angle) * 0.15;
        vel[i * 3 + 1] = 0;
        vel[i * 3 + 2] = Math.cos(angle) * 0.15;
    }

    update(G = 3.5, swirl = 0.2) { 
        const pos = this.particles.geometry.attributes.position.array;
        const vel = this.velocities;
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < this.count; i++) {
            let idx = i * 3;
            let pPos = new THREE.Vector3(pos[idx], pos[idx+1], pos[idx+2]);
            let dist = pPos.length();

            if (dist < this.holeRadius) {
                this.resetParticle(i, pos, vel);
                continue;
            }

            // 1. Core Gravity
            let force = G / (dist * dist);
            let pullDir = pPos.clone().negate().normalize();

            // 2. Add "Jitter/Turbulence" 
            // This makes particles look like boiling plasma rather than dots
            let jitter = (Math.random() - 0.5) * 0.05;

            // 3. Apply high-speed orbital velocity
            let swirlDir = new THREE.Vector3().crossVectors(pullDir, new THREE.Vector3(0, 1, 0)).normalize();

            vel[idx]     += (pullDir.x * force) + (swirlDir.x * swirl) + jitter;
            vel[idx + 1] += (pullDir.y * force) + jitter;
            vel[idx + 2] += (pullDir.z * force) + (swirlDir.z * swirl) + jitter;

            // Velocity cap (prevents particles from breaking the speed of light/glitching)
            let speed = Math.sqrt(vel[idx]**2 + vel[idx+1]**2 + vel[idx+2]**2);
            if (speed > 0.8) {
                vel[idx] *= 0.8 / speed;
                vel[idx+1] *= 0.8 / speed;
                vel[idx+2] *= 0.8 / speed;
            }

            pos[idx]     += vel[idx];
            pos[idx + 1] += vel[idx + 1];
            pos[idx + 2] += vel[idx + 2];
            
            // Update colors based on speed (kinetic energy)
            this.updateColor(i, speed, dist);
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    }
}