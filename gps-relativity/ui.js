/**
 * @fileoverview Integrated UI Management - Suraj Hamal
 */

export function createUI(callbacks) {
    // 1. LEFT CONTAINER: Main Panel
    const dataContainer = document.createElement('div');
    dataContainer.style.cssText = `
        position: absolute; top: 20px; left: 20px;
        background: rgba(0, 0, 10, 0.85); color: #00ffcc;
        padding: 20px; font-family: 'Courier New', monospace;
        border-radius: 10px; border: 1px solid #004444;
        box-shadow: 0 0 15px rgba(0, 255, 204, 0.2);
        min-width: 250px; z-index: 1000; pointer-events: auto;
    `;
    document.body.appendChild(dataContainer);

    // Create a sub-div JUST for the changing stats so we don't overwrite buttons
    const statsDisplay = document.createElement('div');
    dataContainer.appendChild(statsDisplay);

    // 2. RIGHT CONTAINER: Clock
    const clockOverlay = document.createElement('div');
    clockOverlay.style.cssText = `
        position: absolute; top: 20px; right: 20px;
        background: rgba(0, 0, 10, 0.85); border: 1px solid #00ffcc;
        color: #00ffcc; padding: 15px; font-family: 'Courier New', monospace;
        font-size: 1.1rem; pointer-events: none; border-radius: 8px;
        text-align: center; min-width: 250px; z-index: 1000;
    `;
    document.body.appendChild(clockOverlay);

    // 3. NAVIGATION CONSOLE: Buttons
    const navPanel = document.createElement('div');
    navPanel.style.cssText = `
        margin-top: 15px; padding-top: 10px; border-top: 2px solid #004444;
        display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
    `;
    dataContainer.appendChild(navPanel);

    const createModeBtn = (text, mode) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `
            background: #001111; color: #00ffcc; border: 1px solid #00ffcc;
            padding: 8px 5px; font-family: 'Courier New', monospace; font-size: 10px;
            cursor: pointer; border-radius: 4px; transition: 0.2s;
        `;
        btn.onmouseover = () => btn.style.background = "#004444";
        btn.onmouseout = () => btn.style.background = "#001111";
        btn.onclick = () => callbacks.onModeChange(mode);
        navPanel.appendChild(btn);
    };

    createModeBtn("VIEW SUN", 'SUN');
    createModeBtn("VIEW EARTH", 'EARTH');
    createModeBtn("VIEW MOON", 'MOON');
    createModeBtn("VIEW GPS", 'SATELLITE');

    // 4. SPEED CONTROL
    const speedContainer = document.createElement('div');
    speedContainer.style.cssText = `position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; z-index: 1000; pointer-events: auto;`;
    
    const speedLabel = document.createElement('div');
    speedLabel.style.cssText = `color: #00ffcc; font-family: 'Courier New', monospace; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px #000;`;
    
    const speedInput = document.createElement('input');
    speedInput.type = 'range'; speedInput.min = '1'; speedInput.max = '100000'; speedInput.value = '1000';
    speedInput.style.width = "300px";
    speedInput.oninput = (e) => callbacks.onSpeedChange(parseFloat(e.target.value));

    speedContainer.appendChild(speedLabel);
    speedContainer.appendChild(speedInput);
    document.body.appendChild(speedContainer);

    return { statsDisplay, clockOverlay, speedLabel };
}

export function updateUI(ui, satellites, simulatedTime, timeScale) {
    // A. Update Clock
    ui.clockOverlay.innerHTML = `
        <div style="font-size: 0.7rem; color: #888; margin-bottom: 5px;">SIMULATED EPOCH (UTC)</div>
        ${simulatedTime.toUTCString().replace('GMT', '')}
    `;

    // B. Update Speed
    ui.speedLabel.innerText = `TEMPORAL SCALE: ${timeScale}x`;

    // C. Update Relativity Data
    if (!satellites || satellites.length === 0) return;

    let html = `<h2 style="margin:0 0 10px 0; font-size:14px; color:#fff; border-bottom:1px solid #333;">RELATIVITY DATA CENTER</h2>`;
    const earthTime = satellites[0].userData.earthTime || 0;
    html += `<div style="margin-bottom:10px; font-size: 12px;">EARTH TIME: <span style="color:#fff;">${earthTime.toFixed(2)}s</span></div>`;

    satellites.forEach((sat, i) => {
        const speedKMH = (sat.userData.velocity * 3.6).toLocaleString();
        const driftMicro = (sat.userData.satTime - sat.userData.earthTime) * 1000000;

        html += `
        <div style="font-size:10px; margin-top:5px; padding-top:5px; border-top:1px solid #111;">
            <b>GPS UNIT ${i + 1}</b><br>
            SPEED: <span style="color:#fff;">${speedKMH} km/h</span><br>
            REL. DRIFT: <span style="color:#55ff55;">+${driftMicro.toFixed(4)} μs</span>
        </div>`;
    });

    // We only update the statsDisplay, so the navPanel remains untouched
    ui.statsDisplay.innerHTML = html;
}