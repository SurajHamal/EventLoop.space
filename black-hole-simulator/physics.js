// Black Hole Physics Functions
export const G = 6.67430e-11;       // Gravitational constant
export const c = 3e8;               // Speed of light
export const solarMass = 1.989e30;  // 1 solar mass in kg

// Schwarzschild radius (meters)
export function schwarzschildRadius(massKg){
    return (2 * G * massKg) / (c * c);
}

// Time dilation factor for stationary observer
export function timeDilationFactor(rs, r){
    return Math.sqrt(1 - rs/r);
}

// Escape velocity (m/s)
export function escapeVelocity(massKg, r){
    return Math.sqrt((2*G*massKg)/r);
}
