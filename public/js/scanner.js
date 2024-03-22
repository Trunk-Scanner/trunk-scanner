let streamEnabled = false;
let muted = false;
let audioQueue = []; // queue to hold audio data
let isPlaying = false; // flag if audio is currently playing

document.addEventListener('DOMContentLoaded', function () {
    const socket = io();
    const audioPlayer = document.getElementById('audioPlayer');
    const startStream = document.getElementById('startStream');
    const stopStream = document.getElementById('stopStream');
    const muteStream = document.getElementById('muteStream');
    const queueCounter = document.getElementById('queueCounter');
    const scanner = document.getElementById('scanner');

    const playNextInQueue = () => {
        if (audioQueue.length > 0 && !isPlaying) {
            console.log("Attempting to play next in queue...");
            const data = audioQueue.shift(); // next audio data from the queue
            updateInfoAndPlay(data);
            updateQueueCounter();
        }
    };

    const updateInfoAndPlay = (data) => {
        console.log(`Playing audio: TGID: ${data.call.talkgroup}, Frequency: ${data.call.frequency}`);
        document.getElementById('tgid').textContent = data.call.talkgroup;
        document.getElementById('source').textContent = data.call.source;
        document.getElementById('frequency').textContent = data.call.frequency;
        document.getElementById('dateTime').textContent = data.call.dateTime;
        document.getElementById('talkgroupLabel').textContent = data.call.talkgroupLabel;

        isPlaying = true;
        lightOn();

        if (!muted) {
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
        playNextInQueue();
    };

    startStream.addEventListener('click', function() {
        playBeep();
        console.log("Stream started.");
        streamEnabled = true;
        scanner.classList.remove('scanner-off');
        playNextInQueue();
    });

    stopStream.addEventListener('click', function() {
        playBeep();
        console.log("Stream stopped.");
        streamEnabled = false;
        audioQueue = [];
        updateQueueCounter();
        scanner.classList.add('scanner-off');
    });

    muteStream.addEventListener('click', function() {
        playBeep();
        muted = !muted;
        audioPlayer.muted = muted;

        if (muted) {
            console.log("Stream muted.");
            muteStream.textContent = "Unmute";
            muteStream.classList.remove('btn-primary');
            muteStream.classList.add('btn-secondary');
        } else {
            console.log("Stream unmuted.");
            muteStream.textContent = "Mute";
            muteStream.classList.remove('btn-secondary');
            muteStream.classList.add('btn-primary');
        }
    });

    socket.on('newAudio', function(data) {
        console.log("New audio received.");
        if (!streamEnabled) return;

        if (isPlaying) {
            console.log("Audio queued.");
            audioQueue.push(data); // Add to queue if something is playing
        } else {
            lightOn();
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

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = 0.1; // Volume
    oscillator.frequency.value = 520; // Hz smh
    oscillator.type = "sine"; // sine, square, sawtooth, triangle

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1); // Duration
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
