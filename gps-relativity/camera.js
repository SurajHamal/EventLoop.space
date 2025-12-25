/**
 * @fileoverview Camera Management Module - Suraj Hamal
 */
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';

export function initCameraControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 150;
    controls.maxDistance = 27000;

    return controls;
}

/**
 * @function updateCameraLimits
 * @description Adjusts zoom constraints based on the active tracking mode
 */
export function updateCameraLimits(controls, mode) {
    switch (mode) {
        case 'SUN':
            controls.minDistance = 2000;
            controls.maxDistance = 200000;
            break;
        case 'EARTH':
            controls.minDistance = 20;
            controls.maxDistance = 50000;
            break;
        case 'MOON':
            controls.minDistance = 20;
            controls.maxDistance = 5000;
            break;
        case 'SATELLITE':
            controls.minDistance = 5;
            controls.maxDistance = 2000;
            break;
    }
}