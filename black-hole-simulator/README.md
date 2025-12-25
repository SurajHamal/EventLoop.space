# Interactive Black Hole Simulator

**Author:** Suraj Hamal  
**Date:** 2025-12-20

---

## Overview

This project simulates a **Schwarzschild (non-rotating) black hole** using **JavaScript and HTML5 Canvas**. It visualizes key physics concepts such as:

- Schwarzschild radius (event horizon)  
- Time dilation near a black hole  
- Escape velocity  
- Gravitational lensing of particles and background stars


🧱 Website Structure (Industry-Level)
cosmolab/
├── index.html          ← MAIN LANDING PAGE
├── black-hole/
│   ├── index.html
│   ├── app.js
│   └── README.md
├── gps-relativity/
│   ├── index.html
│   ├── app.js
│   └── README.md
├── assets/
│   └── images/
├── styles/
│   └── main.css
└── README.md           ← Platform-level README
---

## Features

1. **Interactive Sliders**
   - Adjust black hole mass (1–100 solar masses)  
   - Adjust observer distance (in multiples of Schwarzschild radius)  

2. **Visualization**
   - Black hole with subtle **halo and accretion disk**  
   - **Orbiting yellow particle** with motion trail  
   - **Observer red dot** with time dilation gradient  
   - **Starfield** distorted by gravitational lensing  

3. **Physics Calculations**
   - Displays Schwarzschild radius (km)  
   - Shows time dilation factor  
   - Shows escape velocity (% of speed of light)

4. **Educational Tooltip**
   - Hover over observer dot to see time dilation in real-time

---

## How It Works

- **Physics:** Uses basic Schwarzschild black hole formulas:
  - Schwarzschild radius: `rs = 2GM / c^2`  
  - Time dilation: `t0 = sqrt(1 - rs / r)`  
  - Escape velocity: `v = sqrt(2GM / r)`  
- **Visualization:** Canvas elements are updated each frame:
  - Orbiting particle moves using angle increment  
  - Lensing effect bends particle and stars toward black hole  
  - Motion trails create smooth animation  

---

## How to Run

1. Clone or download the project folder  
2. Open `index.html` in any modern web browser (Chrome/Edge/Firefox)  
3. Use sliders to adjust mass and observer distance  
4. Observe changes in visualization and physics output  

---

## Notes

- Simulation is **simplified** and for educational purposes  
- Does **not include black hole spin or relativistic light bending physics**  
- Highly **portfolio-ready demo** suitable for IT interviews  

---
