/**
 * @fileoverview HUD with Real-Time Sync and Warp Factor
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
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
            max-width: 90vw;
            overflow-x: auto;
        }

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
        }

        .tab.active { background: var(--neon); color: #000; box-shadow: 0 0 15px rgba(0, 242, 255, 0.3); }

        .station-panel {
            background: var(--panel-bg);
            backdrop-filter: var(--blur);
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: 'monospace';
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .clock-label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 2px; margin-bottom: 4px; text-transform: uppercase; }
        .clock-date { font-size: 11px; color: white; opacity: 0.8; }
        .clock-time { font-size: 16px; color: var(--neon); font-weight: 700; }
        
        .warp-indicator { font-size: 9px; color: var(--neon); float: right; margin-top: 2px; }
    `;
    document.head.appendChild(styleSheet);

    const tabContainer = document.createElement('div');
    tabContainer.className = 'hud-base tab-container';
    
    // Bottom Left Panel: Warp Control & Sim Time
    const speedBox = document.createElement('div');
    speedBox.className = 'hud-base station-panel';
    speedBox.style.cssText = `bottom: 20px; left: 20px; width: 220px; pointer-events: auto;`;
    speedBox.innerHTML = `
<div class="clock-label">
        SIMULATION CLOCK 
        <span id="warp-value" class="warp-indicator">1x (REAL-TIME)</span>
    </div>
    <div id="sim-date-text" class="clock-date">0000-00-00</div>
    <div id="sim-time-text" class="clock-time">00:00:00</div>
    
    <input type="range" id="global-speed" min="1" max="10000" step="1" value="1" style="width:100%; margin-top:10px; cursor:pointer;">
    
    <div style="display:flex; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.3); margin-top: 5px;">
        <span>REAL-TIME (1x)</span>
        <span>ACCELERATED WARP</span>
    </div>
`;

    const earthClock = document.createElement('div');
    earthClock.className = 'hud-base station-panel';
    earthClock.style.cssText = `bottom: 20px; right: 20px; text-align: right;`;
    earthClock.innerHTML = `
        <div class="clock-label">Station ID: Earth</div>
        <div id="live-date" class="clock-date">0000-00-00</div>
        <div id="live-clock" class="clock-time">00:00:00</div>
    `;

    document.body.append(tabContainer, speedBox, earthClock);

    // Update Warp Text and Trigger Callback
    setTimeout(() => {
        const speedInput = document.getElementById('global-speed');
        const warpText = document.getElementById('warp-value');
        
// Update the listener to reflect the 1x floor
    speedInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.timeScale = val; // Ensure global state is updated
        if (val === 1) {
            warpText.innerText = "1x (REAL-TIME)";
        }else {
            warpText.innerText = val.toLocaleString() + "x WARP";
        }
        callbacks.onSpeedChange(val);
    });
    }, 0);

    // Live Earth Clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('live-date').innerText = now.toISOString().split('T')[0];
        document.getElementById('live-clock').innerText = now.toLocaleTimeString();
    }, 1000);

    return { tabContainer, speedBox, callbacks };
}

export function updateUI(ui, satellites, simulatedTime, timeScale, focusTarget) {
    // Update Simulated clock to match the current warp speed
    document.getElementById('sim-date-text').innerText = simulatedTime.toISOString().split('T')[0];
    document.getElementById('sim-time-text').innerText = simulatedTime.toLocaleTimeString();

    // Standard Tab Updates...
    ui.tabContainer.innerHTML = '';
    const mainBodies = ['SUN', 'EARTH', 'MOON'];
    mainBodies.forEach(body => {
        const t = document.createElement('div');
        t.className = `tab ${focusTarget.type === body ? 'active' : ''}`;
        t.innerText = body;
        t.onclick = () => window.dispatchEvent(new CustomEvent('selectPlanet', {detail: body}));
        ui.tabContainer.appendChild(t);
    });

    satellites.forEach((sat, index) => {
        const t = document.createElement('div');
        const isActive = (focusTarget.type === 'SATELLITE' && focusTarget.index === index);
        t.className = `tab ${isActive ? 'active' : ''}`;
        t.innerHTML = `<span style="color:#${sat.userData.color.toString(16).padStart(6, '0')};">●</span> ${sat.userData.id}`;
        t.onclick = () => window.dispatchEvent(new CustomEvent('selectGPS', {detail: index}));
        ui.tabContainer.appendChild(t);
    });
}