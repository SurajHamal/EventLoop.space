/**
 * @fileoverview Universal Physical Constants & Orbital Parameters
 * @author Suraj Hamal, Computer Scientist
 * @description Master physics engine for Earth-Moon orbital mechanics and GPS relativity.
 */

// --- Fundamental Physical Constants ---
export const G = 6.67430e-11;              // Gravitational Constant (m^3 kg^-1 s^-2)
export const c = 299792458;               // Speed of Light in Vacuum (m/s)
export const earthMass = 5.972e24;        // Mass of the Earth (kg)
export const R_EARTH = 6371000;           // Mean Earth Radius (m)

// --- Earth & Solar Rotation Constants ---
/**
 * Earth's Axial Tilt (Obliquity).
 * Scientific Value: 23.436 degrees.
 */
export const AXIAL_TILT_RADIANS = (23.436 * Math.PI) / 180;

/**
 * Earth's Angular Velocity (ω).
 * Equation: ω = 2π / 86400 seconds.
 */
export const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86400;

// --- Lunar Physics Constants ---
/**
 * Mean distance from Earth center to Moon center.
 * Scaled: (384,400km / 6,371km) * 100 units.
 */
export const MOON_DISTANCE_UNITS = 6034.37;

/**
 * Lunar Radius.
 * Scaled: (1,737.4km / 6,371km) * 100 units.
 */
export const MOON_RADIUS_UNITS = 27.27;

/**
 * Sidereal Orbital Period of the Moon.
 * Value: ~27.32 days (2,360,591 seconds).
 */
export const MOON_ORBIT_PERIOD_SECONDS = 2360591;

/**
 * Angular Velocity of the Moon's Orbit.
 * Equation: ω = 2π / T.
 */
export const MOON_ORBIT_SPEED = (2 * Math.PI) / MOON_ORBIT_PERIOD_SECONDS;

/**
 * Orbital Inclination relative to the Ecliptic.
 * Value: 5.14 degrees.
 */
export const MOON_INCLINATION_RADIANS = (5.14 * Math.PI) / 180;

// --- GPS & Satellite Constants ---
export const GPS_ALTITUDE_METERS = 20200000; 
export const GPS_RADIUS_METERS = R_EARTH + GPS_ALTITUDE_METERS;
export const GPS_PERIOD_SECONDS = 43080; 

// --- Physical & Relativistic Functions ---
/**
 * Calculates the constant Angular Velocity for a GPS satellite.
 * Equation: ω = 2π / T (where T is 43,080 seconds).
 */
export function getGPSAngularVelocity() {
    return (2 * Math.PI) / GPS_PERIOD_SECONDS;
}

/**
 * Calculates Specific GPS Velocity.
 * Scientific Result: ~3,874 m/s.
 */
export function getRealGPSVelocity() {
    return Math.sqrt((G * earthMass) / GPS_RADIUS_METERS);
}

/**
 * Derives Angular Velocity (ω) from Linear Velocity (v).
 * Equation: ω = v / r
 */
export function getAngularVelocity(velocity, radiusMeters) {
    return velocity / radiusMeters;
}

/**
 * Predicts the Angular Displacement (θ) relative to Time (t).
 * Logic: (Elapsed Time / Total Period) * 2π radians.
 * Equation: θ = (t / T) * 2π
 */
export function calculateOrbitalPosition(timeInSeconds, period) {
    return (timeInSeconds / period) * Math.PI * 2;
}

/**
 * Computes Special Relativity Time Dilation Factor.
 * Equation: Lorentz Factor γ = sqrt(1 - v^2/c^2).
 */
export function getSpecialRelativityFactor(v) {
    return Math.sqrt(1 - (v * v) / (c * c));
}

/**
 * Computes General Relativity Time Dilation (Gravitational).
 * Equation: 1 + (ΔΦ / c^2) where ΔΦ is change in potential.
 */
export function getGeneralRelativityFactor(radiusMeters) {
    const deltaPhi = (G * earthMass / R_EARTH) - (G * earthMass / radiusMeters);
    return 1 + (deltaPhi / (c * c));
}

/**
 * Calculates Initial Rotation based on UTC time.
 * Logic: Aligns the Prime Meridian (London) with the Sun at noon.
 */
export function getInitialEarthRotation() {
    const now = new Date();
    const secondsToday = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
    return (secondsToday / 86400) * Math.PI * 2 + Math.PI;
}