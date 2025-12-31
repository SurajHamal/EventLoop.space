<h1>
  <a href="https://eventloop.space" target="_blank"> 🛰️ EventLoop.space</a>
</h1>

## Computational Architecture & Relativistic Engineering

An advanced computational engine architected to simulate deterministic orbital environments and relativistic time-dilation variances. This system serves as a core demonstration of the EventLoop Systems capability in bridging high-fidelity WebGL rendering with Einsteinian physics.

* **Systems Orchestration:** Managed through an **Agile framework**, simulating key roles (Product Owner, Scrum Master, Developer, and Tester) to build a complex 4D simulation.
* **Deterministic Logic:** A professional-grade implementation of Relativistic Physics, ensuring temporal drift is calculated with scientific accuracy ($+38 \mu s$ per day).
* **High-Performance Rendering:** Optimized for modern GPU-accelerated browsers using Three.js to visualize the Earth-Moon-Satellite system with zero latency.

---

## 🛠️ Tech Stack & Development Environment

### **Core Development**

* **Languages:** `JavaScript (ES6+)` • `HTML5` • `CSS3 (Modern Glassmorphism)`
* **Graphics Engine:** `Three.js` (WebGL-based 3D Rendering)
* **Physics Engine:** `Satellite.js` (SGP4 Propagation)
* **Environment:** `Visual Studio Code` (Workspace Orchestration)

### **Methodologies**

* **Project Management:** `Agile` • `Scrum Framework` • `Sprint Planning`
* **Architecture:** `Modular Design` • `Separation of Concerns (SoC)`

---

## 🔬 Technical Specification: The Relativity Manifold

The engine accounts for the net temporal offset  by calculating the divergence between a ground-based clock and the orbital clock.

### 1. Kinematic Dilation (Special Relativity)

Using the Lorentz transformation, we calculate time loss due to high orbital velocity ():


### 2. Gravitational Dilation (General Relativity)

Based on the **Schwarzschild metric**, clocks gain time as they move further from Earth's center ():


---

## 🏗️ Software Architecture

The project utilizes **Visual Studio Code** for modular file management, ensuring the simulation remains performant at 60 FPS:

* **`telemetry.js`:** The physics "brain" that calculates dilation, drift, and geodetic positioning.
* **`ui.js`:** A reactive HUD that generates the "Mission Control" interface dynamically using CSS3 Backdrop-filters.
* **`app.js`:** The main orchestration script that manages the Three.js render loop and event listeners.

gps-relativity/
├── celestial/
│   ├── earth.js
│   ├── moon.js
│   ├── sun.js
├── entities/
│   ├── satellite.js
│   ├── telemetry.js
│   └── paths.js            <-- [NEW] Orbital math & Line geometries
├── api/                    <-- [NEW] Create this folder for external data
│   └── n2yo.js             <-- [NEW] Fetching and syncing logic
├── assets/
│   ├── images/
│   └── videos/
├── app.js
├── camera.js
├── ui.js
├── physics.js
├── space.js
└── index.html

---

## 📚 References & Citations

* **Ashby, N. (2003).** *Relativity in the Global Positioning System.* Living Reviews in Relativity.
* **Einstein, A. (1916).** *The Foundation of the General Theory of Relativity.* * **Hoots, F. R., & Roehrich, R. L. (1980).** *Models for Propagation of NORAD Element Sets.*
* **Hoots, F. R., & Roehrich, R. L. (1980).** *Models for Propagation of NORAD Element Sets (SGP4).*

> **Engineering Philosophy:** *"In a deterministic system, error is not a random occurrence, but a failure of the coordinate frame."* — **EventLoop Systems**
