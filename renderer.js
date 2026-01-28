// Canvas setup for composition
const canvas = document.getElementById('studio-canvas');
const ctx = canvas.getContext('2d');

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// State management
let scenes = [
    { id: 1, name: 'Scene 1', sources: [] }
];
let activeSceneId = 1;
let isStreaming = false;
let currentFPS = 60;

// Helper to get current scene
function getActiveScene() {
    return scenes.find(s => s.id === activeSceneId);
}

// --- Settings Management ---
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const resSelect = document.getElementById('settings-res');
const fpsSelect = document.getElementById('settings-fps');
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
    
    // Update Canvas Size
    canvas.width = w;
    canvas.height = h;
    currentFPS = fps;
    
    // Update UI Display
    resDisplay.innerText = `${w}x${h} @ ${fps}FPS`;
    
    closeSettings();
};


// --- Scene Management ---
const sceneListEl = document.getElementById('scene-list');
const addSceneBtn = document.getElementById('add-scene-btn');

function renderSceneList() {
    sceneListEl.innerHTML = '';
    scenes.forEach(scene => {
        const div = document.createElement('div');
        div.className = `source-item ${scene.id === activeSceneId ? 'active' : ''}`;
        div.innerHTML = `
            <span>${scene.name}</span>
            ${scenes.length > 1 ? `<button class="btn btn-danger" style="padding: 2px 6px; font-size: 0.7rem;">X</button>` : ''}
        `;
        
        div.onclick = () => switchScene(scene.id);
        
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

function switchScene(id) {
    activeSceneId = id;
    renderSceneList();
    updateSourceListUI();
}

function addScene() {
    const newId = Date.now();
    const newScene = {
        id: newId,
        name: `Scene ${scenes.length + 1}`,
        sources: []
    };
    scenes.push(newScene);
    switchScene(newId);
}

function deleteScene(id) {
    scenes = scenes.filter(s => s.id !== id);
    if (activeSceneId === id) {
        activeSceneId = scenes[0].id;
    }
    renderSceneList();
    updateSourceListUI();
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
    
    if (type === 'display' || type === 'window') {
        const availableSources = await window.electronAPI.getSources();
        showSourceSelector(availableSources);

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
                height: 360
            });
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
        
        addSourceToState({
            type: 'audio',
            name: label,
            stream: stream
        });
        
        addAudioMixerControl(label, stream);
        
    } catch (e) {
        console.error("Audio selection error", e);
    }
};

function addAudioMixerControl(name, stream) {
    const mixerContent = document.getElementById('audio-mixer-content');
    const div = document.createElement('div');
    div.style.marginBottom = '15px';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <label style="font-size: 0.8rem;">${name}</label>
            <span class="volume-val" style="font-size: 0.7rem; color: #888;">0 dB</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" style="flex: 1" min="0" max="100" value="100">
            <div class="meter" style="width: 10px; height: 20px; background: #333; border-radius: 2px; overflow: hidden;">
                <div class="meter-fill" style="width: 100%; height: 0%; background: #03dac6; margin-top: auto;"></div>
            </div>
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
    
    const slider = div.querySelector('input');
    const meterFill = div.querySelector('.meter-fill');
    const volLabel = div.querySelector('.volume-val');

    slider.oninput = () => {
        // Logarithmic volume control
        const val = parseInt(slider.value);
        const gain = val === 0 ? 0 : Math.pow(val / 100, 2); 
        gainNode.gain.value = gain;
    };

    // Meter Animation Loop
    function updateMeter() {
        if (!document.body.contains(div)) return; // Stop if removed

        analyser.getByteFrequencyData(dataArray);
        
        // Calculate PEAK volume instead of average
        let max = 0;
        for(let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > max) max = dataArray[i];
        }
        
        // Scale 0-255 to 0-100%
        const percent = (max / 255) * 100;
        
        meterFill.style.height = `${percent}%`;
        
        // Color change based on level
        if (percent > 85) meterFill.style.background = '#cf6679'; // Red/Clip
        else if (percent > 60) meterFill.style.background = '#ffb74d'; // Yellow
        else meterFill.style.background = '#03dac6'; // Green

        requestAnimationFrame(updateMeter);
    }
    updateMeter();
}

function showSourceSelector(sourceList) {
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
        div.onclick = () => selectSource(source);
        sourceSelectorList.appendChild(div);
    });
    sourceSelectorModal.classList.add('show');
}

async function selectSource(source) {
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
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        video.onloadedmetadata = () => {
            addSourceToState({
                type: 'video',
                name: source.name,
                element: video,
                width: canvas.width,
                height: canvas.height
            });
        };

        // If stream has audio track, add to mixer
        if (stream.getAudioTracks().length > 0) {
            addAudioMixerControl(source.name, stream);
        }

    } catch (e) {
        console.error("Error selecting source", e);
    }
}

function addSourceToState(sourceConfig) {
    const activeScene = getActiveScene();
    if (!activeScene) return;

    const id = Date.now();
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
    
    const activeScene = getActiveScene();
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
    const activeScene = getActiveScene();
    if (activeScene) {
        activeScene.sources = activeScene.sources.filter(s => s.id !== id);
        updateSourceListUI();
        // Note: Removing audio source from mixer UI is not implemented yet for simplicity
    }
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

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeScene = getActiveScene();
    if (activeScene) {
        activeScene.sources.forEach(source => {
            if (source.type === 'video' && source.element && source.element.readyState >= 2) {
                ctx.drawImage(source.element, source.x, source.y, source.width, source.height);
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
        isStreaming = true;
        btn.innerText = "STOP STREAMING";
        btn.classList.replace('btn-primary', 'btn-danger');
        
        console.log(`Stream started at ${canvas.width}x${canvas.height} @ ${currentFPS}FPS`);
    } else {
        isStreaming = false;
        btn.innerText = "START STREAMING";
        btn.classList.replace('btn-danger', 'btn-primary');
        console.log("Stream stopped");
    }
};