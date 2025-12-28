/**
 * @fileoverview HUD Module - Top Menu Navigation & Restored Clocks
 */

// Global tracking variable to prevent redundant DOM re-renders
let lastTargetID = null;

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
                -ms-overflow-style: none;
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

            .focus-bar.hidden { display: none; }

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

            @media (max-width: 768px) {
                .tab { padding: 6px 12px; font-size: 9px; }
                .station-panel { padding: 8px 12px; min-width: 140px; }
                .clock-time { font-size: 14px; }
                .clock-label { font-size: 8px; }
                .station-panel[style*="left: 20px"] { left: 10px !important; bottom: 10px !important; }
                .station-panel[style*="right: 20px"] { right: 10px !important; bottom: 10px !important; }
                .focus-bar { bottom: 80px; width: 90vw; justify-content: center; }
            }

            .clock-label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 2px; margin-bottom: 4px; }
            .clock-date { font-size: 11px; color: white; opacity: 0.8; }
            .clock-time { font-size: 16px; color: var(--neon); font-weight: 700; }
        `;
    document.head.appendChild(styleSheet);

    const tabContainer = document.createElement('div');
    tabContainer.className = 'hud-base tab-container';

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
            callbacks.onSelectGPS(currentFocus.index);
        } else {
            callbacks.onModeChange(currentFocus.type);
        }
    };

    const speedBox = document.createElement('div');
    speedBox.className = 'hud-base station-panel';
    speedBox.style.cssText = `bottom: 20px; left: 20px; width: 220px;`;
    speedBox.innerHTML = `
        <div class="clock-label">SIMULATION CLOCK</div>
        <div id="sim-date-text" class="clock-date">---- -- --</div>
        <div id="sim-time-text" class="clock-time">--:--:--</div>
        <input type="range" id="global-speed" min="1" max="10000" step="1" value="1" style="width:100%; margin-top:10px;">
    `;

    const earthClock = document.createElement('div');
    earthClock.className = 'hud-base station-panel';
    earthClock.style.cssText = `bottom: 20px; right: 20px; text-align: right;`;
    earthClock.innerHTML = `
        <div class="clock-label">STATION ID: EARTH</div>
        <div id="live-date" class="clock-date">---- -- --</div>
        <div id="live-clock" class="clock-time">--:--:--</div>
    `;

    document.body.append(tabContainer, focusBar, speedBox, earthClock);

    const speedInput = speedBox.querySelector('#global-speed');
    speedInput.addEventListener('input', (e) => callbacks.onSpeedChange(parseFloat(e.target.value)));

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

export function updateUI(ui, satellites, simulatedTime, timeScale, focusTarget) {
    // 1. Update Clocks
    const simTimeEl = document.getElementById('sim-time-text');
    const simDateEl = document.getElementById('sim-date-text');
    if (simTimeEl) simTimeEl.innerText = simulatedTime.toLocaleTimeString();
    if (simDateEl) simDateEl.innerText = simulatedTime.toISOString().split('T')[0];

    // 2. Handle Tab Rendering
    const currentTargetID = `${focusTarget.type}-${focusTarget.index}`;
    
    // Check if the focus has changed OR if the container is empty
    if (currentTargetID !== lastTargetID || ui.tabContainer.innerHTML === '') {
        lastTargetID = currentTargetID;
        ui.tabContainer.innerHTML = '';
        
        // Render Mode Tabs
        ['SUN', 'EARTH', 'MOON'].forEach(body => {
            const t = document.createElement('div');
            t.className = `tab ${focusTarget.type === body ? 'active' : ''}`;
            t.innerText = body;
            t.onclick = () => ui.callbacks.onModeChange(body); 
            ui.tabContainer.appendChild(t);
        });

        // Render Satellite Tabs
        satellites.forEach((sat, index) => {
            const t = document.createElement('div');
            const isActive = (focusTarget.type === 'SATELLITE' && focusTarget.index === index);
            t.className = `tab ${isActive ? 'active' : ''}`;
            t.innerText = sat.userData.id || `SAT ${index}`;
            t.onclick = () => ui.callbacks.onSelectGPS(index);
            ui.tabContainer.appendChild(t);
        });

        // Sync state so the reset button knows the current target
        if (ui.setInternalState) ui.setInternalState(focusTarget.type, focusTarget.index);
    }

    // 3. Handle Reset Button (Focus Bar)
    if (ui && ui.focusBar) {
        const shouldShow = focusTarget.type === 'SATELLITE' || focusTarget.type === 'MOON';
        
        if (shouldShow) {
            ui.focusBar.style.display = 'flex'; 
            ui.focusBar.style.opacity = '1';
            ui.focusBar.style.visibility = 'visible'; 
            ui.focusBar.style.pointerEvents = 'auto';
            
            const labelEl = document.getElementById('focus-label');
            if (labelEl) {
                const name = focusTarget.type === 'SATELLITE' 
                    ? (satellites[focusTarget.index]?.userData.id || 'SATELLITE') 
                    : 'MOON';
                labelEl.innerText = `LOCKED: ${name}`;
            }
        } else {
            ui.focusBar.style.display = 'none';
            ui.focusBar.style.opacity = '0';
            ui.focusBar.style.pointerEvents = 'none';
        }
    }
}