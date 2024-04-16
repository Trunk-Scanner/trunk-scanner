import {Codeplug} from '/public/js/models/Codeplug.js';
import {Enum} from '/public/js/models/Enum.js';

const FIRMWARE_VERSION = "R01.12.00";

const DEFAULT_MODEL = "APX7500";
const DEFAULT_SERIAL = "123ABC1234";

const ControlHeadTypes = new Enum({
    None: 0,
    O2: 1,
    E5: 2,
    O9: 3
});

const socket = io();

export class ApxRadioApp {
    constructor(actualModel, defaultCodeplug, allowLoad) {
        this.codeplug = new Codeplug();

        this.actualRadioModel = actualModel;
        this.defaultCodeplug = defaultCodeplug;
        this.allowLoad = allowLoad;

        this.isstarted = false;
        this.iserrorstate = false;
        this.iskilled = false;
        this.isplaying = false;
        this.isscanenabled = false;
        this.initialBoot = false;
        this.isprimarypresent = false;

        this.disablePrimaryMessage = false;

        this.currentZoneIndex = 0;
        this.currentChannelIndex = 0;

        this.buttonPressCount = 0;
        this.primaryMissingInterval = null;

        const audioPlayer = document.getElementById('audioPlayer');

        document.getElementById('zoneUp').addEventListener('click', () => this.zoneUp());
        document.getElementById('zoneDown').addEventListener('click', () => this.zoneDown());
        document.getElementById('channelButton').addEventListener('click', () => this.nextChannel());
        document.getElementById('homeButton').addEventListener('click', () => this.homeButton_Click());
        document.getElementById('softButton1').addEventListener('click', () => this.softButton1_Click());

        this.loadCodeplugFromStorage().then(r => {
            console.log('Codeplug loaded from storage.');
        });

        const updateInfoAndPlay = (data) => {
            const srcId = data.call.source;
            this.isplaying = true;
            let currentZone = this.codeplug.Zones[this.currentZoneIndex];
            let currentChannel = currentZone.Channels[this.currentChannelIndex];

            this.stopPrimaryMissingInterval().then(r => {});

            const isltr = currentChannel.Mode == 3;
            const isanalog = currentChannel.Mode == 2;
            const isconventionalp25 = currentChannel.Mode == 1;

            if (!isltr && !isanalog) {
                document.getElementById("line3").innerText = `ID: ${srcId}`;
            }

            if (this.isscanenabled && !isconventionalp25) {
                document.getElementById("line2").innerText = this.getChannelNameFromTgid(data.call.talkgroup);
            } else if (this.isscanenabled && isconventionalp25) {
                document.getElementById("line2").innerText = this.getChannelNameFromFrequency(data.call.frequency);
            }

            console.log(`Playing audio: TGID: ${data.call.talkgroup}, Frequency: ${data.call.frequency}, Volume: ${audioPlayer.volume}`);

            audioPlayer.src = data.audio;
            audioPlayer.load();
            audioPlayer.play().catch(async e => {
                await this.stop();
                startBlinkingLed(150);
                document.getElementById("line1").innerText = "FL 01/81";
                console.error('Error playing audio:', e)
            });
        };

        socket.on('new_call', (data) => {
            if (!this.isstarted) return;

            if (this.codeplug.EnforceSystemId && (data.call.system !== this.codeplug.HomeSystemId)) {
                console.log(`System ID ${data.call.system} does not match enforced System ID ${this.codeplug.HomeSystemId}. Skipping...`);
                return;
            }

            if (data.type === "WAV_STREAM" && player) {
                // TODO: Add later
                console.log("New WAV_STREAM call received.");
            } else if (data.type === "AUDIO_URL") {
                console.log("New AUDIO_URL call received.");
                let currentZone = this.codeplug.Zones[this.currentZoneIndex];
                let currentChannel = currentZone.Channels[this.currentChannelIndex];

                if (this.isplaying) {
                    console.log("Audio skipped from URL; something already playing");
                    return;
                }

                //console.log("Current Channel:", currentChannel.Alias, "Current TGID:", currentChannel.Tgid, "Current Freq:", currentChannel.Frequency, "Current Mode:", currentChannel.Mode, "Current Zone:", currentZone.Name, "Current Zone Index:", this.currentZoneIndex, "Current Channel Index:", this.currentChannelIndex);

                const isconventional = (currentChannel.Mode == 1 || currentChannel.Mode == 2);
                const istrunking = (currentChannel.Mode == 0 || currentChannel.Mode == 4);

                if (!this.isscanenabled && ((istrunking && data.call.talkgroup !== currentChannel.Tgid) || (isconventional && currentChannel.Frequency.toString() !== data.call.frequency))) {
                    console.log(`Talkgroup ${data.call.talkgroup} is not the current channel or frequncy ${parseInt(data.call.frequency)} is not the current Frequency Skipping...`);
                    return;
                }
                if (this.isscanenabled && ((istrunking && !this.isTgidInCurrentScanList(data.call.talkgroup)) || (isconventional && !this.isFrequencyInCurrentScanList(data.call.frequency)))){
                    console.log(`Talkgroup ${data.call.talkgroup} is not in the scan list or Frequency: ${data.call.frequency} is not in list. Skipping...`);
                    return;
                }

                updateInfoAndPlay(data);
            } else {
                console.error("Unknown call type received:", data.type);
            }
        });

        audioPlayer.onended = () => {
            console.log("Audio ended.");
            this.isplaying = false;
            let currentZone = this.codeplug.Zones[this.currentZoneIndex];
            let currentChannel = currentZone.Channels[this.currentChannelIndex];
            setTimeout(async () => {
                if (!this.isplaying) {
                    document.getElementById("line3").innerText = '';
                    await this.startPrimaryMissingInterval(this.codeplug.RadioMode === 2);
                }
                if (this.isscanenabled) {
                    document.getElementById("line2").innerText = currentChannel.Alias;
                }
            }, 1500);
        };
    }

    updateScanState() {
        if (!this.isScanlistInZone()) {
            this.isscanenabled = false;
            document.getElementById("scan_icon").style.display = 'none';
            console.log("Scan list not available in this zone. Scanning disabled.");
        }
    }

    isScanlistInZone() {
        const currentZone = this.codeplug.Zones[this.currentZoneIndex];
        const hasScanList = currentZone
            && currentZone.ScanListName !== null
            && currentZone.ScanListName !== undefined
            && currentZone.ScanListName !== "<None>";

        return hasScanList;
    }

    getChannelNameFromTgid(tgid) {
        for (const zone of this.codeplug.Zones) {
            for (const channel of zone.Channels) {
                if (channel.Tgid === tgid) {
                    return channel.Alias;
                }
            }
        }
        return "Not Found";
    }

    getChannelNameFromFrequency(frequency) {
        for (const zone of this.codeplug.Zones) {
            for (const channel of zone.Channels) {
                if (channel.Frequency === frequency) {
                    return channel.Alias;
                }
            }
        }
        return "Not Found";
    }

    async softButton1_Click() {
        if (!this.isstarted) {
            return;
        }

        if (!this.isScanlistInZone()) {
            this.buttonBonk();
            console.log("Scan list not available in this zone. Refusing to enable scan list.");
            return;
        }

        if (this.isscanenabled){
            this.buttonBeep();
            this.isscanenabled = false;

            if (this.codeplug.TtsEnabled) {
                responsiveVoice.speak("Scan off", `US English Male`, {rate: .8});
            }

            document.getElementById("scan_icon").style.display = 'none';
            await this.restartPrimaryMissingInterval(1500);
            document.getElementById("line3").innerText = "Scan off";
            setTimeout(() => {
                document.getElementById("line3").innerText = '';
            }, 1000);
        } else {
            this.buttonBeep();
            this.isscanenabled = true;

            if (this.codeplug.TtsEnabled) {
                responsiveVoice.speak("Scan on", `US English Male`, {rate: .8});
            }

            if (this.codeplug.ControlHead === 1) {
                changeIconImage("/public/images/apx_color_icons/scan.png", "scan_icon");
            } else if (this.codeplug.ControlHead === 2) {
                changeIconImage("/public/images/apx_color_icons/black/scan.webp", "scan_icon");
            }
            await this.restartPrimaryMissingInterval(1500);
            document.getElementById("line3").innerText = "Scan on";
            setTimeout(() => {
                document.getElementById("line3").innerText = '';
            }, 1000);
        }
    }

    async homeButton_Click() {
        if (!this.isstarted) {
            return;
        }
        this.buttonBeep();

        this.buttonPressCount += 1;
        if (this.buttonPressCount === 5) {
            console.debug('Button pressed 5 times');
            this.isstarted = false;
            await this.stop();

            this.serviceModeBeep();

            document.getElementById("line2").innerText = "Service";

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Host Version";
            document.getElementById("line2").innerText = FIRMWARE_VERSION;

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "CPG Version";
            document.getElementById("line2").innerText = this.codeplug.CodeplugVersion;

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Secure Version";
            document.getElementById("line2").innerText = "SEC-SW";

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Secure Version";
            document.getElementById("line2").innerText = "R01.03.05";

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Secure HW Type";
            document.getElementById("line2").innerText = "MACE";

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "KG 1 ADP";

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Model";
            document.getElementById("line2").innerText = this.codeplug.ModelNumber;

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "CH Type";
            document.getElementById("line2").innerText = ControlHeadTypes.fromInt(this.codeplug.ControlHead);

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Serial Number";
            document.getElementById("line2").innerText = this.codeplug.SerialNumber;

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Flickercode";
            document.getElementById("line2").innerText = this.codeplug.FlickerCode;

            await sleep(2500);
            clearDisplayLines();
            document.getElementById("line1").innerText = "Done....";
            document.getElementById("line2").innerText = "Rebooting";

            await sleep(2000);
            clearDisplayLines();
            await sleep(500);
            await this.start();

            //this.buttonPressCount = 0;
        }
    }

    async programMode() {
        if (this.isstarted && this.codeplug) {
            console.log("Stopping current operations.");
            await this.stop();
            await sleep(500);
            this.programModeBeep();
            document.getElementById("line1").innerText = "Program Mode";
            await sleep(500);
        }
    }

    async updateCodeplugJson() {
        await this.programMode();

        this.codeplug = new Codeplug();

        this.codeplug.load(this.defaultCodeplug);
        await this.handleLoadCodeplug();
        console.log('Codeplug loaded from server successfully.');
    }

    async loadCodeplugJson() {
        await this.programMode();

        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.onchange = async (e) => {
            if (e.target.files.length === 0) {
                console.log("File dialog was canceled.");
            } else {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const content = e.target.result;
                    if (!isJsonValid(content)) {
                        let password;
                        if (localStorage.getItem("cpg_password")){
                            password = localStorage.getItem("cpg_password");
                        } else {
                            password = prompt("This codeplug is password protected. Please enter the password:");
                            localStorage.setItem("cpg_password", password);
                        }

                        if (password) {
                            try {
                                const decryptedContent = await this.codeplug.decrypt(content, password);
                                this.codeplug.load(decryptedContent);
                                console.log("CPG: ", this.codeplug);
                                await this.handleLoadCodeplug();

                                console.log('Encrypted codeplug loaded and decrypted successfully.');
                            } catch (error) {

                                localStorage.setItem('codeplug', null);
                                this.codeplug = null;

                                await this.stop();
                                startBlinkingLed(150);
                                document.getElementById("line1").innerText = "FL 01/81";

                                console.error('Failed to decrypt codeplug:', error);
                            }
                        } else {
                            console.log("No password provided.");
                        }
                    } else {
                        this.codeplug.load(JSON.parse(content));
                        await this.handleLoadCodeplug();
                        console.log('Codeplug loaded successfully.');
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    }

    async loadCodeplugFromStorage() {
        const storedCodeplug = localStorage.getItem('codeplug');
        if (storedCodeplug) {
            try {
                const data = JSON.parse(storedCodeplug);
                this.codeplug.load(data);
                console.log('Codeplug loaded from storage:', this.codeplug);
            } catch (error) {
                await this.stop();
                startBlinkingLed(150);
                document.getElementById("line1").innerText = "FL 01/81";
                console.error('Error parsing stored codeplug:', error);
            }
        } else {
            console.log('No codeplug found in storage. loading a default codeplug.');
            this.codeplug = JSON.parse(this.defaultCodeplug);
            //this.createDefaultCodeplug(); // TODO: Remove in the future; maybe keep; unsure
            console.log('Default codeplug loaded:', this.codeplug);
        }
    }

    createDefaultCodeplug() {
        const defaultZone = {
            Name: "Zone 1",
            Channels: [
                {
                    Alias: "Channel 1",
                    Frequency: null,
                    Tgid: "5601",
                    Mode: 0
                }
            ],
            ScanListName: null
        };

        this.codeplug = new Codeplug({
            ModelNumber: DEFAULT_MODEL,
            SerialNumber: DEFAULT_SERIAL,
            Zones: [defaultZone],
            ScanLists: [],
            RadioMode: 2,
            ControlHead: 2,
            TtsEnabled: true,
            HomeSystemId: '500',
            LastProgramSource: 3,
            CodeplugVersion: FIRMWARE_VERSION,
            FlickerCode: '100000-000000-1',
            RadioKilled: false,
            TrunkingInhibited: false
        });

        localStorage.setItem('codeplug', JSON.stringify(this.codeplug));
    }

    async handleLoadCodeplug() {
        clearDisplayLines();
        await sleep(1000);

        localStorage.setItem('codeplug', JSON.stringify(this.codeplug));

        if (this.codeplug && this.initialBoot) {
            await this.stop();
            await sleep(1000);
            clearDisplayLines();
            startBlinkingLed(150);
            document.getElementById("line1").innerText = "Updating";
            document.getElementById("line2").innerText = "Codeplug";
            await sleep(1500);
            stopBlinkingLed();
            clearDisplayLines();
            await sleep(500);
            await this.start();
        }
    }

    isRadioKilled(codeplug) {
        return codeplug.RadioKilled || codeplug.TrunkingInhibited;
    }

    validateCodeplug(codeplug) {
        let result = true;

        if (!codeplug.Zones || codeplug.Zones.length === 0) {
            console.error('Codeplug validation failed: No zones defined.');
            this.iserrorstate = true;
            result = false;
        }

        if (typeof codeplug.LastProgramSource !== 'number' || codeplug.LastProgramSource > 3) {
            console.error('Codeplug validation failed: LastProgramSource is not a number.');
            this.iserrorstate = true;
            result = false;
        }

        if (codeplug.ModelNumber.length !== 7) {
            console.error('Codeplug validation failed: Invalid ModelNumber length.');
            this.iserrorstate = true;
            codeplug.ModelNumber = DEFAULT_MODEL;
            result = false;
        }

        if (codeplug.SerialNumber.length !== 10) {
            console.error('Codeplug validation failed: Invalid SerialNumber length.');
            this.iserrorstate = true;
            codeplug.SerialNumber = DEFAULT_SERIAL;
            result = false;
        }

        if (this.isRadioKilled(codeplug)) {
            console.error('Codeplug validation failed: Radio is killed or trunking inhibited.');
            this.iskilled = true;
            result = false;
        }

        if (codeplug.ControlHead === 0 || !codeplug.ControlHead) {
            console.error('Codeplug validation failed: No control head type defined.');
            this.iserrorstate = true;
            result = false;
        }

        if (codeplug.RadioMode > 3) {
            console.error('Codeplug validation failed: Invalid radio mode.', codeplug.RadioMode);
            this.iserrorstate = true;
            result = false;
        }

        if (codeplug.SecondaryRadioTx == null || typeof codeplug.SecondaryRadioTx !== 'boolean') {
            console.error('Codeplug validation failed: Invalid secondary radio TX value.');
            this.iserrorstate = true;
            result = false;
        }

        if (codeplug.CodeplugVersion !== FIRMWARE_VERSION) {
            console.error('Codeplug validation failed: Invalid codeplug version. Expected:', FIRMWARE_VERSION, '!=', codeplug.CodeplugVersion);
            this.iserrorstate = true;
            result = false;
        }

        return result;
    }


    zoneUp() {
        if (this.currentZoneIndex < this.codeplug.Zones.length - 1) {
            this.buttonBeep();
            this.currentZoneIndex++;
        } else {
            this.buttonBonk();
            this.currentZoneIndex = 0;
        }
        this.currentChannelIndex = 0;

        this.updateScanState();

        this.updateDisplay(true, true);
    }

    zoneDown() {
        if (this.currentZoneIndex > 0) {
            this.buttonBeep();
            this.currentZoneIndex--;
        } else {
            this.buttonBonk();
            this.currentZoneIndex = this.codeplug.Zones.length - 1;
        }
        this.currentChannelIndex = 0;

        this.updateScanState();

        this.updateDisplay(true, true);
    }

    nextChannel() {
        let currentZone = this.codeplug.Zones[this.currentZoneIndex];

        if (this.currentChannelIndex < currentZone.Channels.length - 1) {
            this.buttonBeep();
            this.currentChannelIndex++;
        } else {
            this.buttonBonk();
            this.currentChannelIndex = 0;
        }

        this.updateDisplay(false, true);
    }

    serviceModeBeep() {
        playSoundEffect('/public/audio/apx_service_mode.wav');
    }

    programModeBeep() {
        playSoundEffect('/public/audio/apx_program_mode.wav');
    }

    buttonBeep() {
        playSoundEffect('/public/audio/apx_beep.wav');
    }

    buttonBonk() {
        playSoundEffect('/public/audio/apx_bonk.wav');
    }

    updateDisplay(sayZone = true, sayChannel = false) {
        let currentZone = this.codeplug.Zones[this.currentZoneIndex];
        let currentChannel = currentZone.Channels[this.currentChannelIndex];
        document.getElementById("line1").innerText = currentZone.Name;
        document.getElementById("line2").innerText = currentChannel.Alias;
        document.getElementById("line3").innerText = ``;

        if (sayZone && this.codeplug.TtsEnabled) {
            responsiveVoice.speak(currentZone.Name, `US English Male`, {rate: .8});
        }

        if (sayChannel && this.codeplug.TtsEnabled) {
            responsiveVoice.speak(currentChannel.Alias, `US English Male`, {rate: .8});
        }
    }

    async start() {
        console.log('Starting Main Radio App');
        this.initialBoot = true;

        if (!this.codeplug) {
            console.error('No codeplug loaded.');
            this.isstarted = false;
            return false;
        }

        if (!this.validateCodeplug(this.codeplug)) {
            console.error('Invalid codeplug.');
            if (this.iskilled){
                document.getElementById("line1").innerText = "";
                console.warn("RADIO KILLED!");
            } else if (this.iserrorstate){
                if (this.codeplug.ModelNumber) {
                    document.getElementById("line1").innerText = this.codeplug.ModelNumber;
                    await sleep(2000);
                    document.getElementById("line1").innerText = "";
                    await sleep(500);
                }
                document.getElementById("line1").innerText = "FL 01/82";
                startBlinkingLed(150);
            }

            this.isstarted = false;
            return false;
        }

        const controlHeadType = ControlHeadTypes.fromInt(this.codeplug.ControlHead);

        const currentZone = this.codeplug.Zones[this.currentZoneIndex];
        const currentChannel = currentZone.Channels[this.currentChannelIndex];

        console.log('Radio app started successfully.');
        document.getElementById("line1").innerText = this.codeplug.ModelNumber;
        await sleep(500);
        document.getElementById("line1").innerText = '';
        await sleep(500);

        if (this.codeplug.ModelNumber !== this.actualRadioModel) {
            document.getElementById("line1").innerText = "ERR 01/02";
            await sleep(1000);
            clearDisplayLines();
            await sleep(500);
        }

        document.getElementById("line1").innerText = currentZone.Name;
        document.getElementById("line2").innerText = currentChannel.Alias;
        document.getElementById("line3").innerText = '';

        document.getElementById("menu1").style.display = 'block';
        document.getElementById("menu1").innerText = "Scan";

        this.isstarted = true;

        this.buttonBeep();
        await sleep(200);

        if (this.codeplug.TtsEnabled) {
            responsiveVoice.speak(currentZone.Name, `US English Male`, {rate: .8});
            responsiveVoice.speak(currentChannel.Alias, `US English Male`, {rate: .8});
        }

        await sleep(2000);

        if (this.codeplug.ControlHead === 1) {
            changeClassSize("rssi_icon", "18px", "20px");
        } else if (this.codeplug.ControlHead === 2) {
            changeClassSize("rssi_icon", "20px", "22px");
        } else {
            changeClassSize("rssi_icon", "18px", "20px");
        }

        if ((this.codeplug.RadioMode === 1 || this.codeplug.RadioMode === 0) && !this.isprimarypresent) {
            this.disablePrimaryMessage = false;

            this.buttonBonk();
            await sleep(200);
            this.buttonBonk();
            await this.startPrimaryMissingInterval(this.codeplug.RadioMode === 2);
            await sleep(200);
            this.buttonBonk();
            await sleep(500);
            this.buttonBonk();
        } else {
            this.disablePrimaryMessage = true;
        }
        if (this.codeplug.ControlHead === 1) {
            changeIconImage("/public/images/apx_color_icons/rssi/rssi_4.png", "rssi_icon");
        } else if (this.codeplug.ControlHead === 2) {
            changeIconImage("/public/images/apx_color_icons/rssi/black/rssi_4.webp", "rssi_icon");
        }

        return true;
    }

    async stop() {
        console.log('Stopping Main Radio App');
        this.isstarted = false;
        this.isscanenabled = false;
        document.getElementById("rssi_icon").style.display = 'none';
        document.getElementById("scan_icon").style.display = 'none';
        document.getElementById("menu1").style.display = 'none';

        document.getElementById("menu1").innerText = "";

        document.getElementById("line1").innerText = "";
        document.getElementById("line2").innerText = "";
        document.getElementById("line3").innerText = "";

        clearInterval(this.primaryMissingInterval);

        stopBlinkingLed();
        this.buttonPressCount = 0;
        return true;
    }

    async startPrimaryMissingInterval(issecondary = false) {
        if (this.disablePrimaryMessage) {
            console.debug("Primary missing interval disabled.");
            return;
        }

        let message1;

        if (issecondary) {
            message1 = "Secondary";
        } else {
            message1 = "Primary";
        }

        if (!this.primaryMissingInterval){
            console.warn("no primary missing interval set");
        }

        if (!this.isstarted) {
            console.log("Radio not started. Skipping primary missing interval.");
            return;
        }

        this.primaryMissingInterval = await setInterval(() => {
            document.getElementById("line3").innerText = message1;
            setTimeout(() => {
                document.getElementById("line3").innerText = "missing";
            }, 1000);
        }, 2000);
    }

    async restartPrimaryMissingInterval(delay = 1000) {

        await this.stopPrimaryMissingInterval();

        setTimeout(async () => {
            await this.startPrimaryMissingInterval(this.codeplug.RadioMode === 2);
        }, delay);
    }

    async stopPrimaryMissingInterval() {
        if (this.disablePrimaryMessage) {
            console.debug("Primary missing interval disabled.");
            return;
        }

        await clearInterval(this.primaryMissingInterval);
        this.primaryMissingInterval = null;
    }

    isTgidInCurrentScanList(tgid) {
        const currentZone = this.codeplug.Zones[this.currentZoneIndex];
        if (!currentZone || !currentZone.ScanListName) return false;

        const scanList = this.codeplug.ScanLists.find(list => list.Name === currentZone.ScanListName);
        if (!scanList) return false;

        return scanList.Items.some(item => item.Tgid === tgid);
    }

    isFrequencyInCurrentScanList(frequency) {
        const currentZone = this.codeplug.Zones[this.currentZoneIndex];
        if (!currentZone || !currentZone.ScanListName) return false;

        const scanList = this.codeplug.ScanLists.find(list => list.Name === currentZone.ScanListName);
        if (!scanList) return false;
        return scanList.Items.some(item => item.Frequency.toString() === frequency);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clearDisplayLines() {
    document.getElementById("line1").innerText = '';
    document.getElementById("line2").innerText = '';
    document.getElementById("line3").innerText = '';
}

let ledBlinkingInterval = null;

function startBlinkingLed(interval) {
    let isLedOn = false;

    if (ledBlinkingInterval !== null) {
        clearInterval(ledBlinkingInterval);
    }

    ledBlinkingInterval = setInterval(() => {
        if (isLedOn) {
            ledOff();
            isLedOn = false;
        } else {
            ledOn();
            isLedOn = true;
        }
    }, interval);
}

function stopBlinkingLed() {
    if (ledBlinkingInterval !== null) {
        clearInterval(ledBlinkingInterval);
        ledBlinkingInterval = null;
    }
    ledOff();
}

function ledOn(){
    document.getElementById("ptt_indicator").style.display = 'block';
}

function ledOff(){
    document.getElementById("ptt_indicator").style.display = 'none';
}

function changeIconImage(url, icon) {
    let iconElement = document.getElementById(icon);

    if (iconElement.style.display !== 'block') {
        iconElement.style.display = 'block';
    }

    iconElement.src = url;
}

function changeClassColor(className, color) {
    let elements = document.getElementsByClassName(className);

    for (let i = 0; i < elements.length; i++) {
        elements[i].style.background = color;
    }
}

function changeClassSize(className, newHeight, newWidth) {
    let elements = document.getElementsByClassName(className);
    //console.log(`Found ${elements.length} elements with class '${className}'`);
    for (let i = 0; i < elements.length; i++) {
        //console.log(`Changing size of element ${i}`);
        elements[i].style.height = newHeight;
        elements[i].style.width = newWidth;
    }
}

function playSoundEffect(url) {
    const player = document.getElementById('soundEffectsPlayer');
    player.src = url;
    player.play();
}

function pauseSoundEffect() {
    const player = document.getElementById('soundEffectsPlayer');
    player.pause();
}

function stopSoundEffect() {
    const player = document.getElementById('soundEffectsPlayer');
    player.pause();
    player.currentTime = 0;
}

function isJsonValid(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (e) {
        return false;
    }
}
