import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js?module';
import * as PHYSICS from '../physics.js';

const VISUAL_SCALE = 100 / PHYSICS.R_EARTH; 
const SATELLITE_COUNT = 5; 

export function createSatellites(scene, textureLoader) {
    const satellites = [];

    // --- Materials ---
    const foilTexture = textureLoader.load('./assets/images/satellite/gold_foil.jpg');
    const solarTexture = textureLoader.load('./assets/images/satellite/solar_panel.jpg');
    const bodyMat = new THREE.MeshStandardMaterial({ map: foilTexture, metalness: 0.8, roughness: 0.3 });
    const panelMat = new THREE.MeshStandardMaterial({ map: solarTexture, side: THREE.DoubleSide });

    const visualRadius = PHYSICS.GPS_RADIUS_METERS * VISUAL_SCALE;
    const colors = [0x00ffff, 0xff00ff, 0x00ff00, 0xffff00, 0xff4400];

    for (let i = 0; i < SATELLITE_COUNT; i++) {
        const satGroup = new THREE.Group();

        // 1. YOUR ORIGINAL STRUCTURE
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), bodyMat);
        const p1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.5), panelMat);
        p1.position.x = 4.5;
        const p2 = p1.clone();
        p2.position.x = -4.5;
        satGroup.add(body, p1, p2);

        // 2. INSTALLING SMALL "LED" EMITTERS (Instead of big bulbs)
        // We place 4 tiny, bright dots on the corners of the satellite
        const ledGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const ledMat = new THREE.MeshBasicMaterial({ color: colors[i] });
        
        const positions = [
            [1.1, 1.1, 2.1], [-1.1, 1.1, 2.1], 
            [1.1, -1.1, 2.1], [-1.1, -1.1, 2.1]
        ];

        positions.forEach(pos => {
            const led = new THREE.Mesh(ledGeo, ledMat);
            led.position.set(...pos);
            satGroup.add(led);
        });

        // 3. SIGNAL BEAM (A thin line pointing to Earth)
        // This makes the satellite visible from a distance without a "bulb"
        const beamPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -15)];
        const beamGeo = new THREE.BufferGeometry().setFromPoints(beamPoints);
        const beamMat = new THREE.LineBasicMaterial({ color: colors[i], transparent: true, opacity: 0.6 });
        const beam = new THREE.Line(beamGeo, beamMat);
        satGroup.add(beam);

        // 4. HIDDEN POINT LIGHT (To make the gold foil glow slightly)
        const glow = new THREE.PointLight(colors[i], 20, 15);
        satGroup.add(glow);

        // --- ORBITAL PHYSICS ---
        const inclination = (Math.PI / 4) + (i * 0.15); 
        const planeRotation = (i / SATELLITE_COUNT) * Math.PI * 2;

        satGroup.userData = {
            visualRadius: visualRadius,
            realRadius: PHYSICS.GPS_RADIUS_METERS,
            velocity: PHYSICS.getRealGPSVelocity(),
            angularVelocity: PHYSICS.getGPSAngularVelocity(),
            angle: (i / SATELLITE_COUNT) * Math.PI * 2,
            planeRotation: planeRotation,
            inclination: inclination,
            earthTime: 0,
            satTime: 0
        };

        scene.add(satGroup);
        satellites.push(satGroup);
    }
    return satellites;
}

export function updateSatellites(satellites, dt) {
    satellites.forEach(sat => {
        const data = sat.userData;
        data.angle += data.angularVelocity * dt;

        const x = data.visualRadius * Math.cos(data.angle);
        const z = data.visualRadius * Math.sin(data.angle);
        const yInclined = z * Math.sin(data.inclination);
        const zInclined = z * Math.cos(data.inclination);

        sat.position.set(
            x * Math.cos(data.planeRotation) - zInclined * Math.sin(data.planeRotation),
            yInclined,
            x * Math.sin(data.planeRotation) + zInclined * Math.cos(data.planeRotation)
        );
        
        sat.lookAt(0, 0, 0); // Always point the "Signal Beam" at the center of Earth

        // Update Relativity
        data.earthTime += dt;
        data.satTime += dt * PHYSICS.getSpecialRelativityFactor(data.velocity) * PHYSICS.getGeneralRelativityFactor(data.realRadius);
    });
}