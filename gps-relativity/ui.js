/**
 * @fileoverview Mission Control HUD & Telemetry Interface
 * @author Suraj Hamal, Computer Scientist
 * * * ARCHITECTURAL DESIGN:
 * 1. DYNAMIC DOM MANIPULATION: 
 * Managed through a hybrid of template literals and standard DOM API for 
 * high-performance UI updates in a 60FPS WebGL environment.
 * 2. STATE SYNCHRONIZATION: 
 * Employs a 'lastTargetID' memoization pattern to prevent redundant 
 * re-renders of the navigation tab system.
 * 3. MULTI-CLOCK TEMPORAL TRACKING:
 * Dual-track time management: Real-time Station ID (Earth) and 
 * Scalable Simulation Epoch (SGP4 Delta).
 */

// Memoization anchor to prevent unnecessary tab redraws
let lastTargetID = null;

/**
 * INJECTS THE UI ARCHITECTURE AND CSS INTO THE DOCUMENT
 * @param {Object} callbacks - Function pointers for Mode Changes and Time Scaling.
 * @returns {Object} References to key UI nodes and state setters.
 */
export function createUI(callbacks) {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
            :root {
                --neon: #00f2ff;
                --panel-bg: rgba(10, 10, 15, 0.9);
                --blur: blur(20px) saturate(180%);
                --tab-inactive: rgba(255, 255, 255, 0.05);
            }

            .hud-base {
                position: fixed;
                z-index: 1000;
                font-family: 'Inter', sans-serif;
                color: white;
                pointer-events: none;
            }

            .tab-container {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                background: var(--panel-bg);
                backdrop-filter: var(--blur);
                padding: 6px;
                border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                gap: 6px;
                max-width: 95vw;
                overflow-x: auto;
                pointer-events: auto;
                scrollbar-width: none; 
            }

            .tab-container::-webkit-scrollbar { display: none; }

            .tab {
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 1px;
                text-transform: uppercase;
                white-space: nowrap;
                background: var(--tab-inactive);
                transition: 0.2s;
                color: rgba(255,255,255,0.5);
                flex-shrink: 0; 
            }

            .tab:hover { background: rgba(255, 255, 255, 0.1); color: white; }
            .tab.active { background: var(--neon); color: #000; box-shadow: 0 0 15px rgba(0, 242, 255, 0.3); }

            .mission-control {
                top: 80px; 
                right: 20px;
                width: 240px;
                background: var(--panel-bg);
                backdrop-filter: var(--blur);
                border-radius: 12px;
                border: 1px solid rgba(0, 242, 255, 0.2);
                border-left: 4px solid var(--neon);
                padding: 15px;
                font-family: 'monospace';
                pointer-events: auto;
                display: none; 
            }
            .hud-title { font-size: 9px; color: var(--neon); opacity: 0.7; letter-spacing: 2px; margin-bottom: 10px; }
            .hud-row { margin-bottom: 8px; }
            .hud-val { font-size: 14px; color: #fff; font-weight: bold; }
            .hud-label { font-size: 8px; color: rgba(255,255,255,0.5); text-transform: uppercase; }

            .focus-bar {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 12px;
                background: var(--panel-bg);
                backdrop-filter: var(--blur);
                padding: 8px 20px;
                border-radius: 30px;
                border: 1px solid var(--neon);
                z-index: 1100;
                pointer-events: auto;
                transition: opacity 0.3s ease;
            }

            .reset-btn {
                background: var(--neon);
                color: #000;
                border: none;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 9px;
                font-weight: 800;
                cursor: pointer;
                text-transform: uppercase;
            }

            .station-panel {
                background: var(--panel-bg);
                backdrop-filter: var(--blur);
                padding: 12px 18px;
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-family: 'monospace';
                pointer-events: auto;
            }

            .clock-label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 2px; margin-bottom: 4px; }
            .clock-date { font-size: 11px; color: white; opacity: 0.8; }
            .clock-time { font-size: 16px; color: var(--neon); font-weight: 700; }
        `;
    document.head.appendChild(styleSheet);

    // --- DOM STRUCTURE ASSEMBLY ---
    
    // Top Navigation (Object Tracking Tabs)
    const tabContainer = document.createElement('div');
    tabContainer.className = 'hud-base tab-container';

    // Mission Control (Relativistic Data Display)
    const missionControl = document.createElement('div');
    missionControl.id = 'mission-control-panel';
    missionControl.className = 'hud-base mission-control';
    missionControl.innerHTML = `
        <div class="hud-title">LIVE TELEMETRY</div>
        <div id="mission-content"></div>
    `;

    // Lower Focus Bar (Camera Recenter Logic)
    const focusBar = document.createElement('div');
    focusBar.className = 'hud-base focus-bar hidden'; 
    focusBar.innerHTML = `
        <span id="focus-label" style="font-size: 10px; letter-spacing: 1px;">TRACKING: MOON</span>
        <button class="reset-btn">RECENTER VIEW</button>
    `;
    
    let currentFocus = { type: 'EARTH', index: null };

    const resetBtn = focusBar.querySelector('.reset-btn');
    resetBtn.onclick = () => {
        if (currentFocus.type === 'SATELLITE') {
            if (typeof currentFocus.index === 'number') {
                callbacks.onSelectGPS(currentFocus.index);
            }
        } else {
            callbacks.onModeChange(currentFocus.type);
        }
    };

    // Simulation Clock Controller (Temporal Scaling)
    const speedBox = document.createElement('div');
    speedBox.className = 'hud-base station-panel';
    speedBox.style.cssText = `bottom: 20px; left: 20px; width: 220px;`;
    speedBox.innerHTML = `
        <div class="clock-label">SIMULATION CLOCK</div>
        <div id="sim-date-text" class="clock-date">---- -- --</div>
        <div id="sim-time-text" class="clock-time">--:--:--</div>
        <input type="range" id="global-speed" min="1" max="10000" step="1" value="1" style="width:100%; margin-top:10px;">
    `;

    // Real-World Epoch (Reference Clock)
    const earthClock = document.createElement('div');
    earthClock.className = 'hud-base station-panel';
    earthClock.style.cssText = `bottom: 20px; right: 20px; text-align: right;`;
    earthClock.innerHTML = `
        <div class="clock-label">STATION ID: EARTH</div>
        <div id="live-date" class="clock-date">---- -- --</div>
        <div id="live-clock" class="clock-time">--:--:--</div>
    `;

    document.body.append(tabContainer, focusBar, speedBox, earthClock, missionControl);

    // Event Listener: Global Simulation Time-Scaling
    const speedInput = speedBox.querySelector('#global-speed');
    speedInput.addEventListener('input', (e) => callbacks.onSpeedChange(parseFloat(e.target.value)));

    // Tick: Real-world reference clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('live-date').innerText = now.toISOString().split('T')[0];
        document.getElementById('live-clock').innerText = now.toLocaleTimeString();
    }, 1000);

    return { 
        tabContainer, 
        focusBar, 
        callbacks,
        setInternalState: (type, index) => { currentFocus = { type, index }; }
    };
}

/**
 * FRAME-BY-FRAME UI SYNCHRONIZATION
 * Updates the HUD based on current simulation state.
 */
export function updateUI(ui, satellites, simulatedTime, timeScale, focusTarget) {
    // Synchronize Simulation Date/Time display
    const simTimeEl = document.getElementById('sim-time-text');
    const simDateEl = document.getElementById('sim-date-text');
    if (simTimeEl) simTimeEl.innerText = simulatedTime.toLocaleTimeString();
    if (simDateEl) simDateEl.innerText = simulatedTime.toISOString().split('T')[0];

    // OPTIMIZED TAB RENDER: Only rebuild DOM if focus target has changed
    const currentTargetID = `${focusTarget.type}-${focusTarget.index}`;
    
    if (currentTargetID !== lastTargetID || ui.tabContainer.innerHTML === '') {
        lastTargetID = currentTargetID;
        ui.tabContainer.innerHTML = '';
        
        // Celestial Body Navigation Tabs
        ['SUN', 'EARTH', 'MOON'].forEach(body => {
            const t = document.createElement('div');
            t.className = `tab ${focusTarget.type === body ? 'active' : ''}`;
            t.innerText = body;
            t.onclick = () => ui.callbacks.onModeChange(body); 
            ui.tabContainer.appendChild(t);
        });

        // Dynamic Satellite Registry Tabs
        satellites.forEach((sat, index) => {
            const t = document.createElement('div');
            const isActive = (focusTarget.type === 'SATELLITE' && focusTarget.index === index);
            t.className = `tab ${isActive ? 'active' : ''}`;
            
            // Source Resolver: Use Real Data naming if available
            const satName = window.realSatelliteData?.[index]?.name || sat.userData.id || `SAT ${index}`;
            t.innerText = satName;
            
            t.onclick = () => ui.callbacks.onSelectGPS(index);
            ui.tabContainer.appendChild(t);
        });

        if (ui.setInternalState) ui.setInternalState(focusTarget.type, focusTarget.index);
    }

    // Toggle Camera Focus Bar Visibility
    if (ui && ui.focusBar) {
        const shouldShowFocus = focusTarget.type === 'SATELLITE' || focusTarget.type === 'MOON';
        ui.focusBar.style.display = shouldShowFocus ? 'flex' : 'none';
        ui.focusBar.style.opacity = shouldShowFocus ? '1' : '0';
        ui.focusBar.style.pointerEvents = shouldShowFocus ? 'auto' : 'none';
        
        if (shouldShowFocus) {
            const labelEl = document.getElementById('focus-label');
            if (labelEl) {
                const name = focusTarget.type === 'SATELLITE' 
                    ? (window.realSatelliteData?.[focusTarget.index]?.name || satellites[focusTarget.index]?.userData.id || 'SATELLITE') 
                    : 'MOON';
                labelEl.innerText = `LOCKED: ${name}`;
            }
        }
    }

    // MISSION CONTROL VISIBILITY: Only displayed during active satellite tracking
    const missionPanel = document.getElementById('mission-control-panel');
    if (missionPanel) {
        if (focusTarget.type === 'SATELLITE') {
            missionPanel.style.display = 'block';
        } else {
            missionPanel.style.display = 'none';
            const content = document.getElementById('mission-content');
            if (content) content.innerHTML = '';
        }
    }
}

/**
 * UPDATES THE LIVE TELEMETRY FEED (Mission Control Dashboard)
 * Maps physical calculations (Dilation, Drift) to the visual HUD.
 * @param {Object} stats - The telemetry payload (Velocity, Altitude, Drift).
 * @param {string} countryName - Resolved geodetic location.
 */
export function updateMissionControlUI(stats, countryName) {
    const panel = document.getElementById('mission-control-panel');
    const content = document.getElementById('mission-content');

    if (panel && content) {
        panel.style.display = 'block'; 

        // Uplink Status Logic: Identify data source for UX clarity
        const isReal = window.realSatelliteData && window.realSatelliteData.length > 0;
        const statusColor = isReal ? '#00ff88' : '#ffa500'; 
        const sourceLabel = isReal ? 'LIVE UPLINK (N2YO)' : 'INTERNAL SIMULATION';

        // Dynamic Template Injection: Formats relativistic results for high-readability
        content.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(0,242,255,0.2); padding-bottom: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 8px ${statusColor};"></div>
                <div style="font-size: 9px; letter-spacing: 1px; color: ${statusColor}">${sourceLabel}</div>
            </div>

            <div class="hud-row">
                <div class="hud-label">SATELLITE IDENTIFIER</div>
                <div class="hud-val">${stats.name}</div>
            </div>

            <div class="hud-row">
                <div class="hud-label">GEOSPATIAL LOCUS</div>
                <div class="hud-val" style="color: var(--neon); font-size: 11px;">${countryName}</div>
            </div>

            <div class="hud-row">
                <div class="hud-label">ALTITUDE / VELOCITY</div>
                <div class="hud-val">${stats.alt} KM <span style="font-size:10px; opacity:0.5;">@</span> ${stats.speed} KM/S</div>
            </div>

            <div class="hud-row">
                <div class="hud-label">TEMPORAL DILATION (NET)</div>
                <div class="hud-val" style="color: ${stats.dilation > 0 ? '#00ff88' : '#ff4444'}">
                    ${stats.dilation > 0 ? '+' : ''}${stats.dilation} ns/day
                </div>
            </div>

            <div class="hud-row">
                <div class="hud-label">TOTAL ACCUMULATED DRIFT</div>
                <div class="hud-val" style="color: var(--neon); text-shadow: 0 0 10px rgba(0,242,255,0.5);">
                    ${stats.drift} ns
                </div>
            </div>
        `;
    }
}