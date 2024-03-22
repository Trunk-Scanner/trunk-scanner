let streamEnabled = false;
let muted = false;
let audioQueue = []; // queue to hold audio data
let isPlaying = false; // flag if audio is currently playing
let avoidedTalkgroups = []; // talkgroups to avoid only during the current session
let currentTalkgroup = null; // talkgroup currently being played

document.addEventListener('DOMContentLoaded', function () {
    const socket = io();
    const audioPlayer = document.getElementById('audioPlayer');
    const muteStream = document.getElementById('muteStream');
    const avoidKeyedTalkgroupButton = document.getElementById('avoidKeyedTalkgroup');
    const extraInfo = document.getElementById('extraInfo');
    const queueCounter = document.getElementById('queueCounter');
    const scanner = document.getElementById('scanner');

    loadPresets();
    $('#presetsModal').on('shown.bs.modal', loadPresets);

    document.getElementById('addPresetButton').addEventListener('click', addPreset);
    document.getElementById('presetNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addPreset();
        }
    });

    avoidKeyedTalkgroupButton.addEventListener('click', () => {
        if (isTalkgroupAvoided(currentTalkgroup)) {
            unAvoidKeyedTalkgroup();
        } else {
            avoidKeyedTalkgroup();
        }
    });

    const playNextInQueue = () => {
        if (audioQueue.length > 0 && !isPlaying) {
            console.log("Attempting to play next in queue...");
            const data = audioQueue.shift(); // next audio data from the queue
            updateInfoAndPlay(data);
            updateQueueCounter();
        }
    };

    const updateInfoAndPlay = (data) => {
        document.getElementById('tgid').textContent = data.call.talkgroup;
        document.getElementById('source').textContent = data.call.source;
        document.getElementById('frequency').textContent = data.call.frequency;
        document.getElementById('dateTime').textContent = data.call.dateTime;
        document.getElementById('talkgroupLabel').textContent = data.call.talkgroupLabel;

        currentTalkgroup = data.call.talkgroup;

        if (isTalkgroupAvoided(data.call.talkgroup)){
            console.log(`Talkgroup ${data.call.talkgroup} is avoided. Skipping...`);
            extraInfo.classList.add("badge");
            extraInfo.classList.add("badge-success");
            extraInfo.innerText = "AVOID";
            return;
        } else {
            extraInfo.classList.remove("badge");
            extraInfo.classList.remove("badge-success");
            extraInfo.innerText = "";
        }

        isPlaying = true;
        lightOn();

        if (!muted) {
            console.log(`Playing audio: TGID: ${data.call.talkgroup}, Frequency: ${data.call.frequency}`);

            audioPlayer.src = data.audio;
            audioPlayer.load();
            audioPlayer.play().catch(e => console.error('Error playing audio:', e));
        }
    };

    const updateQueueCounter = () => {
        queueCounter.innerText = `Queue: ${audioQueue.length}`;
        console.log(`Queue length updated: ${audioQueue.length}`);
    };

    audioPlayer.onended = () => {
        console.log("Audio ended.");
        lightOff();
        isPlaying = false;
        currentTalkgroup = null;

        if (!isPlaying) {
            setTimeout(() => {
                document.getElementById('source').textContent = "Waiting...";
            }, 1500);
        }

        playNextInQueue();
    };

    const toggleStreamButton = document.getElementById('toggleStream');

    const toggleStream = () => {
        streamEnabled = !streamEnabled;

        if (streamEnabled) {
            beepOn();
            console.log("Stream started.");
            scanner.classList.remove('scanner-off');
            playNextInQueue();
            toggleStreamButton.textContent = "Stop";
            toggleStreamButton.classList.remove('btn-success');
            toggleStreamButton.classList.add('btn-danger');
        } else {
            beepOff();
            console.log("Stream stopped.");
            audioQueue = [];
            updateQueueCounter();
            scanner.classList.add('scanner-off');
            toggleStreamButton.textContent = "Start";
            toggleStreamButton.classList.remove('btn-danger');
            toggleStreamButton.classList.add('btn-success');
        }
    };

    toggleStreamButton.addEventListener('click', toggleStream);

    muteStream.addEventListener('click', function() {
        muted = !muted;
        audioPlayer.muted = muted;

        if (muted) {
            beepOn();
            console.log("Stream muted.");
            muteStream.textContent = "Unmute";
            muteStream.classList.remove('btn-primary');
            muteStream.classList.add('btn-secondary');
        } else {
            beepOff();
            console.log("Stream unmuted.");
            muteStream.textContent = "Mute";
            muteStream.classList.remove('btn-secondary');
            muteStream.classList.add('btn-primary');
        }
    });

    socket.on('newAudio', function(data) {
        console.log("New call received.");
        if (!streamEnabled) return;

        if (!isTalkgroupWhitelisted(data.call.talkgroup)){
            console.log(`Talkgroup ${data.call.talkgroup} is not whitelisted. Skipping...`);
            return;
        }

        data.call.frequency = hzToMhz(data.call.frequency);

        if (isPlaying) {
            console.log("Audio queued.");
            audioQueue.push(data); // Add to queue if something is playing
        } else {
            updateInfoAndPlay(data); // Play immediately if nothing is playing
        }
        updateQueueCounter();
    });
});

function lightOn() {
    document.getElementById('keyLight').classList.remove('off');
    document.getElementById('keyLight').classList.add('on');
}

function lightOff() {
    document.getElementById('keyLight').classList.remove('on');
    document.getElementById('keyLight').classList.add('off');
}

function beepOn() {
    playBeep(520, 0.2);
}

function beepOff() {
    playBeep(320, 0.2);
}

function beepError() {
    playBeep(220, 0.2);
    setTimeout(() => playBeep(220, 0.2), 300);
}

function playBeep(freq = 520, duration = 0.1) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = 0.1; // Volume
    oscillator.frequency.value = freq; // Hz smh
    oscillator.type = "sine"; // sine, square, sawtooth, triangle

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration); // Duration
}

function isTalkgroupWhitelisted(talkgroup) {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');

    for (const presetName in presets) {
        const preset = presets[presetName];
        // check if preset is enabled and if the talkgroup is included in its talkgroups list
        if (preset.enabled && preset.talkgroups.includes(talkgroup)) {
            return true; // is whitelisted
        }
    }
    return false; // is not whitelisted
}

function loadPresets() {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    const listElement = document.getElementById('presetsList');
    listElement.innerHTML = '';
    for (const [presetName, presetData] of Object.entries(presets)) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            ${presetName} <span class="badge badge-${presetData.enabled ? 'success' : 'secondary'}">${presetData.enabled ? 'Enabled' : 'Disabled'}</span>
            <div>
                <button class="btn btn-primary btn-sm" onclick="openEditPresetModal('${presetName}')">Edit</button>
                <button class="btn btn-info btn-sm" onclick="togglePreset('${presetName}')">${presetData.enabled ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-danger btn-sm" onclick="deletePreset('${presetName}')">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    }
}

function addPreset() {
    const presetName = document.getElementById('presetNameInput').value.trim();
    if(presetName) {
        const presets = JSON.parse(localStorage.getItem('presets') || '{}');
        if (!presets[presetName]) {
            presets[presetName] = { enabled: true, talkgroups: [] };
            localStorage.setItem('presets', JSON.stringify(presets));
            loadPresets();
            document.getElementById('presetNameInput').value = '';
        } else {
            alert('Preset already exists.');
        }
    }
}

function togglePreset(presetName) {
    console.log('Toggling preset:', presetName);
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        presets[presetName].enabled = !presets[presetName].enabled;
        localStorage.setItem('presets', JSON.stringify(presets));
        loadPresets();
    }
}

function openEditPresetModal(presetName) {
    $('#editPresetModal').modal('show');
    document.getElementById('editPresetName').innerText = `Edit Preset: ${presetName}`;
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
    }
    document.getElementById('addTalkgroupButton').onclick = () => addTalkgroupToPreset(presetName);
}

function updatePresetTalkgroupsList(presetName, talkgroups) {
    const listElement = document.getElementById('editPresetTalkgroupsList');
    listElement.innerHTML = ''; // Clear the list
    talkgroups.forEach(talkgroup => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.textContent = talkgroup;
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-danger btn-sm';
        removeButton.textContent = 'Remove';
        removeButton.onclick = () => removeTalkgroupFromPreset(presetName, talkgroup);
        listItem.appendChild(removeButton);
        listElement.appendChild(listItem);
    });
}

function addTalkgroupToPreset(presetName) {
    const talkgroup = document.getElementById('editPresetInput').value.trim();
    if (talkgroup) {
        const presets = JSON.parse(localStorage.getItem('presets') || '{}');
        if (!presets[presetName].talkgroups.includes(talkgroup)) {
            presets[presetName].talkgroups.push(talkgroup);
            localStorage.setItem('presets', JSON.stringify(presets));
            updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
            document.getElementById('editPresetInput').value = ''; // Clear the input field
        } else {
            alert('Talkgroup already in the preset.');
        }
    }
}

function removeTalkgroupFromPreset(presetName, talkgroup) {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    const index = presets[presetName].talkgroups.indexOf(talkgroup);
    if (index !== -1) {
        presets[presetName].talkgroups.splice(index, 1);
        localStorage.setItem('presets', JSON.stringify(presets));
        updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
    }
}

function deletePreset(presetName) {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        delete presets[presetName];
        localStorage.setItem('presets', JSON.stringify(presets));
        loadPresets();
    }
}

function isTalkgroupAvoided(talkgroup) {
    return avoidedTalkgroups.includes(talkgroup);
}

function avoidKeyedTalkgroup() {
    const talkgroup = currentTalkgroup;
    if (talkgroup) {
        avoidedTalkgroups.push(talkgroup);
        beepOn();
        console.log('Talkgroup added to avoid list:', talkgroup);
    } else {
        beepError();
        console.log('No talkgroup to avoid.');
    }
}

function unAvoidKeyedTalkgroup() {
    const talkgroup = currentTalkgroup;
    if (talkgroup) {
        const index = avoidedTalkgroups.indexOf(talkgroup);
        if (index !== -1) {
            beepOn();
            avoidedTalkgroups.splice(index, 1);
            console.log('Talkgroup removed from avoid list:', talkgroup);
        } else {
            beepError();
            console.log('Talkgroup not in avoid list:', talkgroup);
        }
    } else {
        beepError();
        console.log('No talkgroup to un-avoid.');
    }
}

function clearAvoidedTalkgroups() {
    beepOn();
    avoidedTalkgroups = [];
    console.log('Avoided talkgroups cleared.');
}

function searchAudioFiles() {
    const system = document.getElementById('systemInput').value;
    const talkgroup = document.getElementById('talkgroupInput').value;
    const date = document.getElementById('dateInput').value;
    const recordingsList = document.getElementById('recordingsList');
    console.log(`Searching for recordings: System: ${system}, Talkgroup: ${talkgroup}, Date: ${date}`);
    fetch(`/api/recordings?system=${system}&talkgroup=${talkgroup}&date=${date}`)
        .then(response => response.json())
        .then(recordings => {
            recordingsList.innerHTML = '';
            console.log('Recordings:', recordings);
            recordings.forEach(recording => {
                const listItem = document.createElement('div');
                listItem.className = 'list-group-item list-group-item-action';
                listItem.innerHTML = `
                    <p>System: ${recording.system}, Talkgroup: ${recording.talkgroup}, Date: ${recording.date}</p>
                    <audio controls src="${recording.path}"></audio>  
                `;
                recordingsList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error('Error fetching recordings:', error);
            recordingsList.innerHTML = '<p class="text-danger">Failed to load recordings.</p>';
        });
}

function hzToMhz(frequencyHz) {
    return parseInt(frequencyHz) / 1000000;
}