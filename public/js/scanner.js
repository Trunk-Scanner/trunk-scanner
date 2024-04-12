let paused = false;
let isPlaying = false; // flag if audio is currently playing
let isPcmPlaying = false; // flag if PCM audio is currently playing

let whiteListEnabled = true;
let streamEnabled = false;

let audioQueue = []; // queue to hold audio data
let avoidedTalkgroups = []; // talkgroups to avoid only during the current session

let currentTalkgroup = null; // talkgroup currently being played
let lastCallData = null; // last call received

let player; // PCMPlayer instance for UDP audio stream

document.addEventListener('DOMContentLoaded', function () {
    const socket = io();
    const audioPlayer = document.getElementById('audioPlayer');
    const pauseStream = document.getElementById('pauseStream');
    const avoidKeyedTalkgroupButton = document.getElementById('avoidKeyedTalkgroup');
    const whiteListEnableToggle = document.getElementById('whiteListEnableToggle');
    const extraInfo = document.getElementById('extraInfo');
    const queueCounter = document.getElementById('queueCounter');
    const scanner = document.getElementById('scanner');
    const usersCount = document.getElementById('usersCount');

    updateVolumeDisplay();
    loadPresets();

    $('#presetsModal').on('shown.bs.modal', function () {
        loadPresets();
    });

    $('#editPresetModal').on('show.bs.modal', function () {
        populateTalkgroupDropdownForEditing();
    });

    whiteListEnableToggle.addEventListener('click', function() {
        whiteListEnabled = !whiteListEnabled;

        if (whiteListEnabled) {
            beepOn();
            console.log("Whitelist enabled.");
            whiteListEnableToggle.textContent = "Disable Whitelist";
            whiteListEnableToggle.classList.remove('btn-danger');
            whiteListEnableToggle.classList.add('btn-success');
        } else {
            beepOff();
            console.log("Whitelist disabled.");
            whiteListEnableToggle.textContent = "Enable Whitelist";
            whiteListEnableToggle.classList.remove('btn-success');
            whiteListEnableToggle.classList.add('btn-danger');
        }
    });

    document.getElementById('addPresetButton').addEventListener('click', function() {
        const presetName = document.getElementById('presetNameInput').value.trim();
        if (presetName) {
            const presets = JSON.parse(localStorage.getItem('presets') || '{}');
            if (!presets[presetName]) {
                presets[presetName] = { enabled: true, talkgroups: [] };
                localStorage.setItem('presets', JSON.stringify(presets));
                $('#presetNameInput').val('');
                loadPresets();
            } else {
                alert('Preset already exists.');
            }
        }
    });

    document.getElementById('addTalkgroupButton').addEventListener('click', function() {
        const presetName = document.getElementById('currentlyEditingPresetName').value;
        const selectedTalkgroup = document.getElementById('editTalkgroupSelect').value;
        const presets = JSON.parse(localStorage.getItem('presets') || '{}');

        if (presetName && presets[presetName] && !presets[presetName].talkgroups.includes(selectedTalkgroup)) {
            presets[presetName].talkgroups.push(selectedTalkgroup);
            localStorage.setItem('presets', JSON.stringify(presets));
            updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
        } else {
            alert('This talkgroup is already in the preset or preset name is missing.');
        }
    });

    document.getElementById('playLastCall').addEventListener('click', playLastCall);

    document.getElementById('presetNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addPreset();
        }
    });

    // TODO: Remove. For debug use only
    audioPlayer.addEventListener('volumechange', function() {
        console.log('Volume changed event: Current volume is ' + audioPlayer.volume);
    });

    document.getElementById('volumeUp').addEventListener('click', () => {
        if (audioPlayer.volume <= 0.8) {
            audioPlayer.volume = Math.min(audioPlayer.volume + 0.2, 1);
            console.log("Volume Up Clicked: New Volume =", audioPlayer.volume);
            playVolumeBeep(audioPlayer.volume);
            updateVolumeDisplay();
        } else {
            playVolumeBeep(audioPlayer.volume, true);
        }
    });

    document.getElementById('volumeDown').addEventListener('click', () => {
        if (audioPlayer.volume >= 0.2) {
            audioPlayer.volume = Math.max(audioPlayer.volume - 0.2, 0);
            console.log("Volume Down Clicked: New Volume =", audioPlayer.volume);
            playVolumeBeep(audioPlayer.volume);
            updateVolumeDisplay();
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

    const updateQueueCounter = () => {
        queueCounter.innerText = `Queue: ${audioQueue.length}`;
        console.log(`Queue length updated: ${audioQueue.length}`);
    };

    audioPlayer.onended = () => {
        console.log("Audio ended.");
        lightOff();
        isPlaying = false;
        currentTalkgroup = null;

        if (!isPlaying && audioQueue.length === 0) {
            console.log("Queue is empty and we arnt playing anything");
            setTimeout(() => {
                if (!isPlaying) {
                    document.getElementById('source').textContent = "Waiting...";
                }
            }, 1500);
        }

        playNextInQueue();
    };

    const toggleStreamButton = document.getElementById('toggleStream');

    const toggleStream = () => {

        streamEnabled = !streamEnabled;

        player = new PCMPlayer({
            encoding: '16bitInt',
            channels: 1,
            sampleRate: 8000,
            flushingTime: 2000,
            onAudioEnd: audioStopped,
            onAudioStart: audioStarted
        });

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

    pauseStream.addEventListener('click', function() {
        paused = !paused;
        audioPlayer.paused = paused;

        if (paused) {
            beepOn();
            console.log("Stream paused.");
            pauseStream.textContent = "Resume";
            pauseStream.classList.remove('btn-primary');
            pauseStream.classList.add('btn-secondary');
        } else {
            beepOff();
            playNextInQueue();
            console.log("Stream unpuased.");
            pauseStream.textContent = "Pause";
            pauseStream.classList.remove('btn-secondary');
            pauseStream.classList.add('btn-primary');
        }
    });

    socket.on('userCount', function(count) {
        usersCount.textContent = `L: ${count}`;
    });

    socket.on('new_call', function(data) {
        if (!streamEnabled) return;

        if (data.type === "WAV_STREAM" && player) {
            let audio = new Uint8Array(data.audio);
            console.log("New WAV_STREAM call.");

            if (isPlaying) { // TODO: Add que system for PCM audio
                console.log("Audio skipped from UDP; something already playing");
                return;
            }

            player.feed(audio);
        } else if (data.type === "AUDIO_URL") {
            console.log("New AUDIO_URL call received.");

            if (isPcmPlaying) { // TODO: Add que system for PCM audio
                console.log("Audio skipped from URL; PCM already playing");
                return;
            }

            if (!isTalkgroupWhitelisted(data.call.talkgroup) && whiteListEnabled){
                console.log(`Talkgroup ${data.call.talkgroup} is not whitelisted. Skipping...`);
                return;
            }

            // Convert some ugly values to be more user friendly
            data.call.frequency = hzToMhz(data.call.frequency);
            data.call.dateTime = parseTimestamp(data.call.dateTime);

            if (isPlaying) {
                console.log("Audio queued.");
                audioQueue.push(data); // Add to queue if something is playing
            } else {
                updateInfoAndPlay(data); // Play immediately if nothing is playing
            }
            updateQueueCounter();
        }
    });

    const updateInfoAndPlay = (data) => {
        console.log(`About to play audio at volume: ${audioPlayer.volume}`);

        updateScannerInfo(data);

        currentTalkgroup = data.call.talkgroup;
        lastCallData = data;

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

        if (!paused) {
            console.log(`Playing audio: TGID: ${data.call.talkgroup}, Frequency: ${data.call.frequency}, Volume: ${audioPlayer.volume}`);

            audioPlayer.src = data.audio;
            audioPlayer.load();
            audioPlayer.play().catch(e => console.error('Error playing audio:', e));
        }
    };

    function audioStopped() {
        isPcmPlaying = false;
        console.debug("STREAM audio stopped");
    }

    function audioStarted() {
        isPcmPlaying = true;
        console.debug("STREAM audio started");
    }

    function updateVolumeDisplay() {
        const volumePercentage = Math.round(audioPlayer.volume * 100);
        console.log(`Updating Volume Display to ${volumePercentage}%`);
        document.getElementById('volumePercentage').textContent = `Volume: ${volumePercentage}%`;
    }

    function updateScannerInfo(data) {
        document.getElementById('tgid').textContent = data.call.talkgroup;
        document.getElementById('source').textContent = data.call.source;
        document.getElementById('frequency').textContent = data.call.frequency;
        document.getElementById('dateTime').textContent = data.call.dateTime;
        document.getElementById('talkgroupLabel').textContent = data.call.talkgroupLabel;
    }

    function playLastCall() {
        if (lastCallData && !isPlaying) {
            updateScannerInfo(lastCallData);
            console.log("Playing last call:", lastCallData.call.talkgroup);
            audioPlayer.src = lastCallData.audio;
            audioPlayer.load();
            audioPlayer.play().catch(e => console.error('Error playing last call audio:', e));
        } else {
            console.error('No last call data available or is currently playing.');
        }
    }
});

function togglePreset(presetName) {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        presets[presetName].enabled = !presets[presetName].enabled;
        localStorage.setItem('presets', JSON.stringify(presets));
        loadPresets();
    } else {
        console.error('Preset not found:', presetName);
    }
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
                <button class="btn btn-info btn-sm" onclick="togglePreset('${presetName}')">${presetData.enabled ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-primary btn-sm" onclick="openEditPresetModal('${presetName}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deletePreset('${presetName}')">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    }

    document.querySelectorAll('.toggle-preset').forEach(button => {
        button.addEventListener('click', function() {
            togglePreset(this.getAttribute('data-preset-name'));
        });
    });
}

function populateTalkgroupDropdownForEditing() {
    const dropdown = document.getElementById('editTalkgroupSelect');

    dropdown.innerHTML = '';

    groups.forEach(group => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = group.name;
        group.talkgroups.forEach(tg => {
            const option = document.createElement('option');
            option.value = tg.id;
            option.textContent = `${tg.alias} (${tg.id})`;
            optGroup.appendChild(option);
        });
        dropdown.appendChild(optGroup);
    });
}

function openEditPresetModal(presetName) {
    document.getElementById('currentlyEditingPresetName').value = presetName;

    populateTalkgroupDropdownForEditing();

    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
    }

    $('#editPresetModal').modal('show');
}

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

function playVolumeBeep(volumeLevel, longer = false) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = volumeLevel;
    oscillator.frequency.value = 520; // Hz
    oscillator.type = "sine"; // Sine

    const beepDuration = longer ? 0.5 : 0.1;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + beepDuration);
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

function addPreset() {
    const presetName = document.getElementById('presetNameInput').value.trim();
    const selectedTalkgroup = document.getElementById('talkgroupSelect').value;

    if (presetName) {
        const presets = JSON.parse(localStorage.getItem('presets') || '{}');
        if (!presets[presetName]) {
            presets[presetName] = { enabled: true, talkgroups: [selectedTalkgroup] }; // Include selected talkgroup
            localStorage.setItem('presets', JSON.stringify(presets));
            alert('Preset added successfully.');
        } else {
            alert('Preset already exists.');
        }
        loadPresets();
    } else {
        alert('Please enter a name for the preset.');
    }
}

function updatePresetTalkgroupsList(presetName, talkgroups) {
    const listElement = document.getElementById('editPresetTalkgroupsList');
    listElement.innerHTML = '';
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
    const selectedTalkgroup = document.getElementById('editTalkgroupSelect').value;
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');

    if (presets[presetName] && !presets[presetName].talkgroups.includes(selectedTalkgroup)) {
        presets[presetName].talkgroups.push(selectedTalkgroup);
        localStorage.setItem('presets', JSON.stringify(presets));
        updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
    }
}

function removeTalkgroupFromPreset(presetName, talkgroup) {
    const presets = JSON.parse(localStorage.getItem('presets') || '{}');
    if (presets[presetName]) {
        const index = presets[presetName].talkgroups.indexOf(talkgroup);
        if (index !== -1) {
            presets[presetName].talkgroups.splice(index, 1);
            localStorage.setItem('presets', JSON.stringify(presets));
            updatePresetTalkgroupsList(presetName, presets[presetName].talkgroups);
        }
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

// Simple helper functions

function hzToMhz(frequencyHz) {
    return parseInt(frequencyHz) / 1000000;
}

function parseTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toTimeString().split(' ')[0];
}