import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// Post-processing imports for the "Glow" effect
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ParticleEngine } from './ParticleEngine.js';

export class BlackHoleSim {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // 1. Renderer with Bloom Support
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 25);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.minDistance = 5;  // Prevent zooming into the hole
        this.controls.maxDistance = 60; // Prevent zooming too far out

        // 2. Post-Processing (The "Cinematic" Bloom)
        const renderScene = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
            1.8, // Strength of glow
            0.5, // Radius
            0.8 // Threshold (only bright things glow)
        );

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.bloomPass);

        this.initBlackHole();
        this.initAccretionDisk();
        this.particles = new ParticleEngine(this.scene, 5000, 2.8);
        this.animate();
    }

    initBlackHole() {
            const geometry = new THREE.SphereGeometry(15, 64, 64);
            this.bhMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    holeRadius: { value: 2.8 }, 
                    cameraPos: { value: new THREE.Vector3() }
                },
                vertexShader: `
                    varying vec3 vWorldPosition;
                    void main() {
                        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                        vWorldPosition = worldPosition.xyz;
                        gl_Position = projectionMatrix * viewMatrix * worldPosition;
                    }
                `,
                fragmentShader: `
                    varying vec3 vWorldPosition;
                    uniform vec3 cameraPos;
                    uniform float holeRadius;

                    void main() {
                        vec3 rayOrigin = cameraPos;
                        // FIXED: Removed mouseTarget reference
                        vec3 rayDir = normalize(vWorldPosition - cameraPos); 
                        vec3 currPos = rayOrigin;

                        for(int i = 0; i < 60; i++) {
                            float dist = length(currPos);
                            if (dist < holeRadius) {
                                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                                return;
                            }
                            vec3 gravity = -normalize(currPos) * (holeRadius / (dist * dist));
                            rayDir = normalize(rayDir + gravity * 0.5); 
                            currPos += rayDir * 0.4; 
                        }
                        float stars = pow(fract(sin(dot(rayDir.xy, vec2(12.9, 78.2))) * 43758.5), 30.0);
                        gl_FragColor = vec4(vec3(stars), 1.0);
                    }
                `,
                side: THREE.BackSide,
                transparent: true
            });

            this.scene.add(new THREE.Mesh(geometry, this.bhMaterial));
        }

    initAccretionDisk() {
        const diskGeo = new THREE.TorusGeometry(6, 0.05, 16, 100);
        this.diskMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff4400, 
            transparent: true, 
            opacity: 0.8 
        });
        
        // We use several rings to create a dense disk effect
        for(let i = 0; i < 20; i++) {
            const r = 4 + (i * 0.2);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(r, 0.02, 16, 100),
                new THREE.MeshBasicMaterial({ 
                    color: new THREE.Color().setHSL(0.08, 1, 0.5 + (i/40)),
                    transparent: true,
                    opacity: 0.5
                })
            );
            ring.rotation.x = Math.PI / 2;
            this.scene.add(ring);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update the physics engine
        // Parameter 1: Gravity strength (G)
        // Parameter 2: Swirl strength (Angular momentum)
        if (this.particleEngine) {
            this.particleEngine.update(3.5, 0.08);
        }

if (this.bhMaterial) {
        this.bhMaterial.uniforms.cameraPos.value.copy(this.camera.position);
        // Removed uMouse update here
    }
        
        this.controls.update();
        this.composer.render(); // Use composer instead of renderer
    }
}