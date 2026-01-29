// Canvas setup for composition
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');

const programCanvas = document.getElementById('program-canvas');
const programCtx = programCanvas.getContext('2d');

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// State management
let scenes = [
    { id: 1, name: 'Scene 1', sources: [] }
];
let activeSceneId = 1; // The scene currently being edited (Preview)
let programSceneId = 1; // The scene currently live (Program)

let isStreaming = false;
let currentFPS = 60;

// Multi-stream destinations
let destinations = [];

// Listen for Deep Links (Auth Tokens from Laravel)
window.electronAPI.onDeepLink((url) => {
    console.log("Received Deep Link:", url);
    
    // Parse URL: nitro://auth?token=XYZ&platform=YouTube
    try {
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        const token = params.get('token');
        const platform = params.get('platform');
        const name = params.get('name') || 'User';
        
        if (token && platform) {
            handleAuthCallback(platform, token, name);
        }
    } catch (e) {
        console.error("Invalid Deep Link", e);
    }
});

function handleAuthCallback(platform, token, name) {
    // If the modal is open and waiting for this platform, update it
    if (destModal.classList.contains('show') && currentDestPlatform === platform) {
        isLoggedIn = true;
        const btn = destLoginArea.querySelector('button');
        btn.innerText = 'Connect Account';
        btn.disabled = false;
        
        destLoginArea.style.display = 'none';
        destMetadataArea.style.display = 'block';
        
        // Update User Profile UI
        const profileName = destMetadataArea.querySelector('.user-profile div div:first-child');
        if (profileName) profileName.innerText = name;
        
        // Store token for future API calls (e.g., creating broadcast)
        // In a real app, you'd save this securely
        console.log(`Authenticated ${platform} with token: ${token}`);
    } else {
        alert(`Successfully connected to ${platform}! You can now add it as a destination.`);
    }
}

// Helper to get current preview scene
function getPreviewScene() {
    return scenes.find(s => s.id === activeSceneId);
}

// Helper to get current program scene
function getProgramScene() {
    return scenes.find(s => s.id === programSceneId);
}

// --- Settings Management ---
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const resSelect = document.getElementById('settings-res');
const fpsSelect = document.getElementById('settings-fps');
const themeSelect = document.getElementById('settings-theme');
const resDisplay = document.getElementById('resolution-display');

settingsBtn.onclick = () => {
    settingsModal.classList.add('show');
};
window.closeSettings = () => {
    settingsModal.classList.remove('show');
};

window.applySettings = () => {
    const [w, h] = resSelect.value.split('x').map(Number);
    const fps = parseInt(fpsSelect.value);
    const theme = themeSelect.value;
    
    // Apply Theme
    applyTheme(theme);

    // Update Canvas Size
    previewCanvas.width = w;
    previewCanvas.height = h;
    programCanvas.width = w;
    programCanvas.height = h;
    currentFPS = fps;
    
    // Update UI Display
    resDisplay.innerText = `${w}x${h} @ ${fps}FPS`;
    
    // Adjust canvas container aspect ratio if needed (simple CSS tweak)
    const isVertical = h > w;
    const containers = document.querySelectorAll('.canvas-container');
    containers.forEach(c => {
        if (isVertical) {
            c.style.maxWidth = '400px'; // Constrain width for vertical layout
        } else {
            c.style.maxWidth = 'none';
        }
    });

    closeSettings();
};

function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'light') {
        root.style.setProperty('--bg-dark', '#f5f5f5');
        root.style.setProperty('--bg-panel', '#ffffff');
        root.style.setProperty('--text-main', '#121212');
        root.style.setProperty('--border', '#ddd');
        root.style.setProperty('--primary', '#6200ee');
        root.style.setProperty('--accent', '#018786');
    } else if (theme === 'blue') {
        root.style.setProperty('--bg-dark', '#0f172a');
        root.style.setProperty('--bg-panel', '#1e293b');
        root.style.setProperty('--text-main', '#e2e8f0');
        root.style.setProperty('--border', '#334155');
        root.style.setProperty('--primary', '#38bdf8');
        root.style.setProperty('--accent', '#22d3ee');
    } else if (theme === 'high-contrast') {
        root.style.setProperty('--bg-dark', '#000000');
        root.style.setProperty('--bg-panel', '#000000');
        root.style.setProperty('--text-main', '#ffffff');
        root.style.setProperty('--border', '#ffffff');
        root.style.setProperty('--primary', '#ffff00');
        root.style.setProperty('--accent', '#00ffff');
    } else {
        // Default Dark
        root.style.setProperty('--bg-dark', '#121212');
        root.style.setProperty('--bg-panel', '#1e1e1e');
        root.style.setProperty('--text-main', '#e0e0e0');
        root.style.setProperty('--border', '#333');
        root.style.setProperty('--primary', '#bb86fc');
        root.style.setProperty('--accent', '#03dac6');
    }
}


// --- Scene Management ---
const sceneListEl = document.getElementById('scene-list');
const addSceneBtn = document.getElementById('add-scene-btn');

function renderSceneList() {
    sceneListEl.innerHTML = '';
    scenes.forEach(scene => {
        const div = document.createElement('div');
        // Highlight logic: 
        // - Blue border (active) if it's the Preview scene
        // - Red background/indicator if it's the Program scene
        let className = 'source-item';
        if (scene.id === activeSceneId) className += ' active';
        
        div.className = className;
        div.style.position = 'relative';
        
        // Program indicator
        const isProgram = (scene.id === programSceneId);
        
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                ${isProgram ? '<div style="width: 8px; height: 8px; background: #cf6679; border-radius: 50%;"></div>' : ''}
                <span>${scene.name}</span>
            </div>
            ${scenes.length > 1 ? `<button class="btn btn-danger" style="padding: 2px 6px; font-size: 0.7rem;">X</button>` : ''}
        `;
        
        div.onclick = () => switchPreviewScene(scene.id);
        
        if (scenes.length > 1) {
            const deleteBtn = div.querySelector('button');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteScene(scene.id);
            };
        }
        
        sceneListEl.appendChild(div);
    });
}

function switchPreviewScene(id) {
    activeSceneId = id;
    renderSceneList();
    updateSourceListUI();
}

function transitionToProgram() {
    programSceneId = activeSceneId;
    renderSceneList();
    rebuildAudioMixer(); // Mixer should reflect what is LIVE
}

document.getElementById('transition-btn').onclick = transitionToProgram;

function addScene() {
    const newId = Date.now();
    
    // Generate a unique name
    let counter = 1;
    let newName = `Scene ${counter}`;
    while (scenes.some(s => s.name === newName)) {
        counter++;
        newName = `Scene ${counter}`;
    }

    const newScene = {
        id: newId,
        name: newName,
        sources: []
    };
    scenes.push(newScene);
    switchPreviewScene(newId);
}

function deleteScene(id) {
    scenes = scenes.filter(s => s.id !== id);
    
    if (activeSceneId === id) {
        activeSceneId = scenes[0].id;
    }
    if (programSceneId === id) {
        programSceneId = scenes[0].id;
    }
    
    renderSceneList();
    updateSourceListUI();
    rebuildAudioMixer();
}

addSceneBtn.onclick = addScene;
renderSceneList();


// --- Source Management ---

const modal = document.getElementById('source-modal');
const sourceSelectorModal = document.getElementById('source-selector-modal');
const sourceSelectorList = document.getElementById('source-selector-list');
const audioSelectorModal = document.getElementById('audio-selector-modal');
const audioDeviceSelect = document.getElementById('audio-device-select');

document.getElementById('add-source-btn').onclick = () => {
    modal.classList.add('show');
};
window.closeModal = () => {
    modal.classList.remove('show');
};
window.closeSourceSelector = () => {
    sourceSelectorModal.classList.remove('show');
};
window.closeAudioSelector = () => {
    audioSelectorModal.classList.remove('show');
};

window.addSource = async (type) => {
    closeModal();
    
    if (type === 'display' || type === 'window' || type === 'audio-output') {
        const availableSources = await window.electronAPI.getSources();
        showSourceSelector(availableSources, type);

    } else if (type === 'camera') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            
            addSourceToState({
                type: 'video',
                name: 'Webcam',
                element: video,
                width: 480,
                height: 360,
                stream: stream // Store stream to stop tracks later
            });
            
            // Note: Audio is added to the scene state, but mixer only updates if this scene is Program
            if (stream.getAudioTracks().length > 0 && activeSceneId === programSceneId) {
                addAudioMixerControl('Webcam', stream, Date.now());
            }

        } catch (e) {
            console.error("Camera error", e);
        }
    } else if (type === 'audio') {
        // Enumerate audio input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        audioDeviceSelect.innerHTML = '';
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microphone ${audioDeviceSelect.length + 1}`;
            audioDeviceSelect.appendChild(option);
        });
        
        audioSelectorModal.classList.add('show');
    }
};

window.confirmAudioSelection = async () => {
    const deviceId = audioDeviceSelect.value;
    const label = audioDeviceSelect.options[audioDeviceSelect.selectedIndex].text;
    closeAudioSelector();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
            video: false
        });
        
        const id = Date.now();
        addSourceToState({
            id: id, // Pass ID explicitly
            type: 'audio',
            name: label,
            stream: stream
        });
        
        if (activeSceneId === programSceneId) {
            addAudioMixerControl(label, stream, id);
        }
        
    } catch (e) {
        console.error("Audio selection error", e);
    }
};

function addAudioMixerControl(name, stream, sourceId) {
    const mixerContent = document.getElementById('audio-mixer-content');
    
    // Clear placeholder if it exists
    if (mixerContent.innerText.includes('No audio sources active')) {
        mixerContent.innerHTML = '';
    }
    
    // Check if control already exists
    if (document.getElementById(`mixer-control-${sourceId}`)) return;

    const div = document.createElement('div');
    div.id = `mixer-control-${sourceId}`; // Assign ID to remove later
    div.className = 'mixer-channel';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 5px;">
            <label style="font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px;" title="${name}">${name}</label>
            <button class="btn-monitor" style="background: none; border: none; color: #666; cursor: pointer; font-size: 0.7rem; padding: 0;">🎧</button>
        </div>
        
        <div class="knob-container" id="knob-${sourceId}" title="Drag up/down to adjust volume">
            <div class="knob"></div>
        </div>
        
        <span class="volume-val" style="font-size: 0.65rem; color: #888; margin-bottom: 5px;">0 dB</span>

        <div class="meter-container">
            <div class="meter-bar"></div>
        </div>
    `;
    
    mixerContent.appendChild(div);

    // Audio Processing
    const source = audioCtx.createMediaStreamSource(stream);
    const gainNode = audioCtx.createGain();
    const analyser = audioCtx.createAnalyser();
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(gainNode);
    gainNode.connect(analyser);
    
    // Monitor Logic (Headphones)
    const monitorBtn = div.querySelector('.btn-monitor');
    let isMonitored = false;
    
    monitorBtn.onclick = () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        if (isMonitored) {
            gainNode.disconnect(audioCtx.destination);
            monitorBtn.style.color = '#666';
            isMonitored = false;
        } else {
            gainNode.connect(audioCtx.destination);
            monitorBtn.style.color = '#03dac6';
            isMonitored = true;
        }
    };
    
    // Knob Logic
    const knobContainer = div.querySelector('.knob-container');
    const knob = div.querySelector('.knob');
    const meterBar = div.querySelector('.meter-bar');
    const volLabel = div.querySelector('.volume-val');
    
    let startY = 0;
    let currentVolume = 100; // 0 to 100

    const onMouseMove = (e) => {
        const deltaY = startY - e.clientY; // Up is positive
        startY = e.clientY;
        
        // Sensitivity factor
        currentVolume += deltaY * 1.0;
        
        // Clamp between 0 and 100
        if (currentVolume > 100) currentVolume = 100;
        if (currentVolume < 0) currentVolume = 0;
        
        updateKnobVisuals();
        updateAudioGain();
    };

    const onMouseUp = () => {
        document.body.style.cursor = 'default';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };

    knobContainer.onmousedown = (e) => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        startY = e.clientY;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault(); // Prevent text selection
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };
    
    // Double click to reset
    knobContainer.ondblclick = () => {
        currentVolume = 100;
        updateKnobVisuals();
        updateAudioGain();
    };

    function updateKnobVisuals() {
        // Map 0-100 to -135deg to +135deg (270 degree range)
        const angle = (currentVolume / 100) * 270 - 135;
        knob.style.transform = `rotate(${angle}deg)`;
        
        if (currentVolume === 0) volLabel.innerText = '-∞ dB';
        else if (currentVolume >= 100) volLabel.innerText = '0 dB';
        else {
            const db = 20 * Math.log10(currentVolume / 100);
            volLabel.innerText = `${db.toFixed(1)} dB`;
        }
    }

    function updateAudioGain() {
        const gain = currentVolume === 0 ? 0 : Math.pow(currentVolume / 100, 2); 
        gainNode.gain.value = gain;
    }

    // Initial state
    updateKnobVisuals();

    function updateMeter() {
        if (!document.body.contains(div)) return; // Stop if removed

        analyser.getByteFrequencyData(dataArray);
        
        let max = 0;
        for(let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > max) max = dataArray[i];
        }
        
        const percent = (max / 255) * 100;
        meterBar.style.height = `${percent}%`;
        
        if (percent > 85) meterBar.style.background = '#cf6679'; // Red
        else if (percent > 60) meterBar.style.background = '#ffb74d'; // Orange
        else meterBar.style.background = '#03dac6'; // Teal/Green

        requestAnimationFrame(updateMeter);
    }
    updateMeter();
}

function showSourceSelector(sourceList, type) {
    sourceSelectorList.innerHTML = '';
    if (sourceList.length === 0) {
        sourceSelectorList.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 20px;">No sources found.</div>';
    }
    sourceList.forEach(source => {
        const div = document.createElement('div');
        div.className = 'source-option';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        
        const img = document.createElement('img');
        img.src = source.thumbnail;
        img.style.width = '100%';
        img.style.marginBottom = '5px';
        img.style.borderRadius = '4px';
        
        const label = document.createElement('div');
        label.innerText = source.name;
        label.style.fontSize = '0.8rem';
        label.style.wordBreak = 'break-word';

        div.appendChild(img);
        div.appendChild(label);
        div.onclick = () => selectSource(source, type);
        sourceSelectorList.appendChild(div);
    });
    sourceSelectorModal.classList.add('show');
}

async function selectSource(source, type) {
    closeSourceSelector();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                }
            },
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                }
            }
        });
        
        const id = Date.now();

        if (type === 'audio-output') {
            if (stream.getAudioTracks().length > 0) {
                addSourceToState({
                    id: id,
                    type: 'audio',
                    name: 'Desktop Audio',
                    stream: stream
                });
                if (activeSceneId === programSceneId) {
                    addAudioMixerControl('Desktop Audio', stream, id);
                }
            } else {
                alert('Selected source does not have audio.');
            }
            return;
        }

        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        video.onloadedmetadata = () => {
            addSourceToState({
                id: id,
                type: 'video',
                name: source.name,
                element: video,
                width: previewCanvas.width,
                height: previewCanvas.height,
                stream: stream
            });
        };

        if (stream.getAudioTracks().length > 0 && activeSceneId === programSceneId) {
            addAudioMixerControl(source.name, stream, id);
        }

    } catch (e) {
        console.error("Error selecting source", e);
    }
}

function addSourceToState(sourceConfig) {
    const activeScene = getPreviewScene();
    if (!activeScene) return;

    // Use provided ID or generate new one
    const id = sourceConfig.id || Date.now();
    const newSource = {
        id,
        x: 0,
        y: 0,
        ...sourceConfig
    };
    activeScene.sources.push(newSource);
    updateSourceListUI();
}

function updateSourceListUI() {
    const list = document.getElementById('current-sources-list');
    list.innerHTML = '';
    
    const activeScene = getPreviewScene();
    if (!activeScene) return;

    activeScene.sources.forEach(source => {
        const div = document.createElement('div');
        div.className = 'source-item';
        div.innerHTML = `
            <span>${source.name}</span>
            <button class="btn btn-danger" onclick="removeSource(${source.id})">X</button>
        `;
        list.appendChild(div);
    });
}

window.removeSource = (id) => {
    const activeScene = getPreviewScene();
    if (activeScene) {
        const sourceToRemove = activeScene.sources.find(s => s.id === id);
        
        // Stop all tracks (audio/video) to release hardware
        if (sourceToRemove && sourceToRemove.stream) {
            sourceToRemove.stream.getTracks().forEach(track => track.stop());
        }

        // Remove from state
        activeScene.sources = activeScene.sources.filter(s => s.id !== id);
        
        // Update UI
        updateSourceListUI();
        
        // Remove from Audio Mixer if this scene is currently Program
        if (activeSceneId === programSceneId) {
            const mixerControl = document.getElementById(`mixer-control-${id}`);
            if (mixerControl) {
                mixerControl.remove();
            }
            
            // Check if mixer is empty
            const mixerContent = document.getElementById('audio-mixer-content');
            if (mixerContent.children.length === 0) {
                mixerContent.innerHTML = '<div style="color: #666; font-size: 0.8rem; margin: auto;">No audio sources active</div>';
            }
        }
    }
};

function rebuildAudioMixer() {
    const mixerContent = document.getElementById('audio-mixer-content');
    mixerContent.innerHTML = '<div style="color: #666; font-size: 0.8rem; margin: auto;">No audio sources active</div>';
    
    const programScene = getProgramScene();
    if (programScene) {
        programScene.sources.forEach(source => {
            if (source.stream && source.stream.getAudioTracks().length > 0) {
                addAudioMixerControl(source.name, source.stream, source.id);
            }
        });
    }
}

// --- Destination Management ---
const destModal = document.getElementById('dest-modal');
const destForm = document.getElementById('dest-form');
const destPlatformSelect = document.getElementById('dest-platform-select');
const destFormTitle = document.getElementById('dest-form-title');
const destLoginArea = document.getElementById('dest-login-area');
const destMetadataArea = document.getElementById('dest-metadata-area');
const destRtmpArea = document.getElementById('dest-rtmp-area');
const destListEl = document.getElementById('destinations-list');
const destPillContainer = document.getElementById('destinations-pill-container');

let currentDestPlatform = '';
let isLoggedIn = false;

window.openDestModal = () => {
    resetDestModal();
    destModal.classList.add('show');
};

window.closeDestModal = () => {
    destModal.classList.remove('show');
};

window.resetDestModal = () => {
    destPlatformSelect.style.display = 'none';
    destForm.style.display = 'none';
    isLoggedIn = false;
    
    // Reset fields
    document.getElementById('new-dest-url').value = '';
    document.getElementById('new-dest-key').value = '';
    document.getElementById('dest-title').value = '';
    document.getElementById('dest-desc').value = '';
    document.getElementById('dest-thumb').value = '';
};

window.showDestPlatformSelect = () => {
    destPlatformSelect.style.display = 'block';
    destForm.style.display = 'none';
};

window.showDestForm = (platform) => {
    currentDestPlatform = platform;
    destPlatformSelect.style.display = 'none';
    destForm.style.display = 'block';
    destFormTitle.innerText = `Setup ${platform}`;
    
    if (platform === 'Custom') {
        destLoginArea.style.display = 'none';
        destMetadataArea.style.display = 'none';
        destRtmpArea.style.display = 'block';
    } else {
        destLoginArea.style.display = 'block';
        destMetadataArea.style.display = 'none';
        destRtmpArea.style.display = 'none';
    }
};

window.simulateLogin = () => {
    // Simulate OAuth flow
    const btn = destLoginArea.querySelector('button');
    btn.innerText = 'Connecting...';
    btn.disabled = true;
    
    // Open external browser for login
    let authUrl = '';
    if (currentDestPlatform === 'YouTube') {
        authUrl = 'http://localhost:8000/auth/youtube'; 
    } else if (currentDestPlatform === 'Twitch') {
        authUrl = 'http://localhost:8000/auth/twitch';
    } else if (currentDestPlatform === 'Facebook') {
        authUrl = 'http://localhost:8000/auth/facebook';
    }
    
    if (authUrl) {
        window.electronAPI.openExternal(authUrl);
    }
};

window.logoutDest = () => {
    isLoggedIn = false;
    destMetadataArea.style.display = 'none';
    destLoginArea.style.display = 'block';
};

window.saveDestination = () => {
    let url, key, title, desc;
    
    if (currentDestPlatform === 'Custom') {
        url = document.getElementById('new-dest-url').value;
        key = document.getElementById('new-dest-key').value;
        if (!url || !key) {
            alert('Please provide Server URL and Stream Key');
            return;
        }
    } else {
        if (!isLoggedIn) {
            alert('Please connect your account first.');
            return;
        }
        url = document.getElementById('new-dest-url').value;
        key = document.getElementById('new-dest-key').value;
        title = document.getElementById('dest-title').value || 'Untitled Stream';
        desc = document.getElementById('dest-desc').value;
    }
    
    destinations.push({
        id: Date.now(),
        platform: currentDestPlatform,
        url: url,
        key: key,
        title: title,
        active: false
    });
    
    renderDestinations();
    closeDestModal();
};

function renderDestinations() {
    // Render list in the modal
    destListEl.innerHTML = '';
    if (destinations.length === 0) {
        destListEl.innerHTML = '<div style="color: #666; font-size: 0.8rem; text-align: center;">No destinations added</div>';
    } else {
        destinations.forEach(dest => {
            const div = document.createElement('div');
            div.className = 'destination-list-item';
            div.innerHTML = `
                <div>
                    <div style="font-weight: bold; font-size: 0.9rem;">${dest.platform}</div>
                    <div style="font-size: 0.7rem; color: #888;">${dest.title || dest.url}</div>
                </div>
                <button class="btn btn-danger" style="padding: 2px 8px; font-size: 0.7rem;" onclick="removeDestination(${dest.id})">Remove</button>
            `;
            destListEl.appendChild(div);
        });
    }

    // Render pills in the header
    destPillContainer.innerHTML = '';
    if (destinations.length === 0) {
        const pill = document.createElement('div');
        pill.className = 'destination-pill';
        pill.innerHTML = `<span class="destination-dot"></span><span>Destinations</span>`;
        pill.onclick = openDestModal;
        destPillContainer.appendChild(pill);
    } else {
        destinations.forEach(dest => {
            const pill = document.createElement('div');
            pill.className = 'destination-pill';
            pill.innerHTML = `<span class="destination-dot ${dest.active ? 'live' : ''}"></span><span>${dest.platform}</span>`;
            pill.onclick = openDestModal;
            destPillContainer.appendChild(pill);
        });
    }
}

window.removeDestination = (id) => {
    destinations = destinations.filter(d => d.id !== id);
    renderDestinations();
};


// Render Loop
let lastTime = 0;
function render(time) {
    const interval = 1000 / currentFPS;
    if (time - lastTime < interval) {
        requestAnimationFrame(render);
        return;
    }
    lastTime = time;

    // 1. Render Preview Canvas (Active Scene)
    previewCtx.fillStyle = '#000';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    const previewScene = getPreviewScene();
    if (previewScene) {
        previewScene.sources.forEach(source => {
            if (source.type === 'video' && source.element && source.element.readyState >= 2) {
                previewCtx.drawImage(source.element, source.x, source.y, source.width, source.height);
            }
        });
    }

    // 2. Render Program Canvas (Live Scene)
    programCtx.fillStyle = '#000';
    programCtx.fillRect(0, 0, programCanvas.width, programCanvas.height);

    const programScene = getProgramScene();
    if (programScene) {
        programScene.sources.forEach(source => {
            if (source.type === 'video' && source.element && source.element.readyState >= 2) {
                programCtx.drawImage(source.element, source.x, source.y, source.width, source.height);
            }
        });
    }

    requestAnimationFrame(render);
}
requestAnimationFrame(render);

// Streaming Logic
document.getElementById('start-stream-btn').onclick = () => {
    const btn = document.getElementById('start-stream-btn');
    if (!isStreaming) {
        if (destinations.length === 0) {
            alert("Please add at least one destination first.");
            openDestModal();
            return;
        }
        
        isStreaming = true;
        btn.innerText = "STOP STREAMING";
        btn.classList.replace('btn-primary', 'btn-danger');
        
        // Mark all destinations as LIVE
        destinations.forEach(d => d.active = true);
        renderDestinations();
        
        console.log(`Stream started to ${destinations.length} destinations`);
    } else {
        isStreaming = false;
        btn.innerText = "START STREAMING";
        btn.classList.replace('btn-danger', 'btn-primary');
        
        // Mark all destinations as OFFLINE
        destinations.forEach(d => d.active = false);
        renderDestinations();
        
        console.log("Stream stopped");
    }
};

// Initial render
renderDestinations();