import {UnicationCodeplug} from "./models/UnicationCodeplug.js";

const FIRMWARE_VERSION = "R01.00.00";

const DEFAULT_MODEL = "G5";
const DEFAULT_SERIAL = "123ABC1234";

export class UnicationPagerApp {
    constructor(actualModel, defaultCodeplug) {
        this.actualModel = actualModel;
        this.defaultCodeplug = defaultCodeplug;

        this.codeplug = null;

        this.isreceiving = false;
        this.isscanenabled = false;
        this.isstarted = false;
        this.isinprogrammode = false;
        this.iserrorstate = false;

        this.currentZoneIndex = 0;
        this.currentChannelIndex = 0;

        this.system = "Trunk-Scanner";

        this.socket = io();

        this.audioPlayer = document.getElementById('audioPlayer');

        this.audioPlayer.onended = () => {
            console.log("Audio ended.");
            this.handleCallStop();
        };

        document.getElementById("pwr_button").addEventListener("click", () => {this.radioPowerOn();});
        document.getElementById("loadCodeplugBtn").addEventListener("click", async () => {await this.loadCodeplugFromFile().then(r => {});});
        document.getElementById("channelButton").addEventListener("click", () => {this.changeChannel(true);});
        document.getElementById("zoneButton").addEventListener("click", () => {this.changeZone(true);});
        document.getElementById("scanButton").addEventListener("click", () => {this.toggleScan();});
    }

    radioPowerOn() {
        if (this.isstarted || this.isinprogrammode) {
            console.log("Powering off...");
            this.radioPowerOff();
            this.isstarted = false;
        } else {
            console.log("Powering on...");
            setTimeout(() => {
                this.mainFunction();
            }, 1000);
            this.isstarted = true;
        }
    }

    radioPowerOff() {
        this.clearLines();
        this.isstarted = false;
        this.isreceiving = false;
        this.iserrorstate = false;
    }

    toggleScan() {
        this.isscanenabled = !this.isscanenabled;
    }

    mainFunction() {
        /*        let audio = new Audio('/public/audio/trunking_tg_priority.wav');
                audio.play();*/
        try {
            if (this.defaultCodeplug) {
                this.codeplug = new UnicationCodeplug(this.defaultCodeplug);
            } else if (localStorage.getItem("pager_codeplug")){
                this.loadCodeplugFromStorage();
            } else {
                console.error("FATAL ERROR");
                this.iserrorstate = true;
                this.clearLines();
                this.updateTextContent("1", "Unication");
                this.updateTextContent("2", DEFAULT_MODEL);

                return;
            }

            this.isstarted = true;
            this.updateCurrentZoneChannel(true);

            this.socket.on("new_call", (data) => {
                if (!this.isstarted || this.isinprogrammode) return;

                if (this.codeplug.EnforceSystemId && (data.call.system !== this.codeplug.HomeSystemId)) {
                    console.log(`System ID ${data.call.system} does not match enforced System ID ${this.codeplug.HomeSystemId}. Skipping...`);
                    return;
                }

                if (data.type === "WAV_STREAM" && player) {
                    // TODO: Add later
                    console.log("New WAV_STREAM call received.");
                } else if (data.type === "AUDIO_URL") {
                    console.log("New AUDIO_URL call received.");

                    if (this.isreceiving) {
                        console.log("Audio skipped from URL; something already playing");
                        return;
                    }

                    //console.log("Current Channel:", currentChannel.Alias, "Current TGID:", currentChannel.Tgid, "Current Freq:", currentChannel.Frequency, "Current Mode:", currentChannel.Mode, "Current Zone:", currentZone.Name, "Current Zone Index:", this.currentZoneIndex, "Current Channel Index:", this.currentChannelIndex);

                    const isconventional = (this.current_channel.Mode == 1 || this.current_channel.Mode == 2);
                    const istrunking = (this.current_channel.Mode == 0 || this.current_channel.Mode == 4);

                    if (!this.isscanenabled && ((istrunking && data.call.talkgroup !== currentChannel.Tgid) || (isconventional && currentChannel.Frequency.toString() !== data.call.frequency))) {
                        console.log(`Talkgroup ${data.call.talkgroup} is not the current channel or frequncy ${parseInt(data.call.frequency)} is not the current Frequency Skipping...`);
                        return;
                    }

                    if (this.isscanenabled && ((istrunking && !this.isTgidInCurrentScanList(data.call.talkgroup)) || (isconventional && !this.isFrequencyInCurrentScanList(data.call.frequency)))){
                        console.log(`Talkgroup ${data.call.talkgroup} is not in the scan list or Frequency: ${data.call.frequency} is not in list. Skipping...`);
                        return;
                    }

                    this.handleCallStart(data.call, data.audio);
                } else {
                    console.error("Unknown call type received:", data.type);
                }
            });

            console.log("Unication pager app started");
        } catch (e) {
            console.log("Failed to start unication pager app");
            console.log(e);
        }
    }

    handleCallStart(call, audio) {
        this.isreceiving = true;
        this.updateTextContent("1", `To:${call.talkgroupLabel}`);
        this.updateTextContent("2", '');
        this.updateTextContent("3", `Fm:[${call.source}]`);

        const isltr = this.current_channel.Mode == 3;
        const isanalog = this.current_channel.Mode == 2;
        const isconventionalp25 = this.current_channel.Mode == 1;

        if (!isltr && !isanalog) {
            document.getElementById("line3").innerText = `ID: ${call.source}`;
        }

        if (this.isscanenabled && !isconventionalp25) {
            document.getElementById("line2").innerText = this.getChannelNameFromTgid(call.talkgroup);
        } else if (this.isscanenabled && isconventionalp25) {
            document.getElementById("line2").innerText = this.getChannelNameFromFrequency(call.frequency);
        }

        console.log(`Playing audio: TGID: ${call.talkgroup}, Frequency: ${call.frequency}, Volume: ${this.audioPlayer.volume}`);

        this.audioPlayer.src = audio;
        this.audioPlayer.load();
        this.audioPlayer.play().catch(async e => {
            await this.radioPowerOff();
            document.getElementById("line1").innerText = "FL 01/81";
            console.error('Error playing audio:', e)
        });
    }

    handleCallStop(call){
        setTimeout(() =>{
            this.isreceiving = false;
            this.updateCurrentZoneChannel(true);
        }, 1500)
    }

    changeChannel(next) {
        const currentZoneChannels = this.codeplug.Zones[this.currentZoneIndex].Channels;
        if (next) {
            this.currentChannelIndex = (this.currentChannelIndex + 1) % currentZoneChannels.length;
        } else {
            if (this.currentChannelIndex === 0) {
                this.currentChannelIndex = currentZoneChannels.length - 1;
            } else {
                this.currentChannelIndex--;
            }
        }
        this.updateCurrentZoneChannel(true);
    }

    changeZone(next) {
        if (next) {
            this.currentZoneIndex = (this.currentZoneIndex + 1) % this.codeplug.Zones.length;
        } else {
            if (this.currentZoneIndex === 0) {
                this.currentZoneIndex = this.codeplug.Zones.length - 1;
            } else {
                this.currentZoneIndex--;
            }
        }
        this.currentChannelIndex = 0;
        this.updateCurrentZoneChannel(true);
    }

    updateCurrentZoneChannel(updateDisplay = false) {
        this.current_zone = this.codeplug.Zones[this.currentZoneIndex].Name;
        this.current_channel = this.codeplug.Zones[this.currentZoneIndex].Channels[this.currentChannelIndex].Alias;

        if (updateDisplay) {
            this.updateTextContent("1", this.current_zone);
            this.updateTextContent("2", this.current_channel);
            this.updateTextContent("3", this.system);
        }
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

    editButtonClass(target, bool) {
        const classList = target.classList;
        classList.remove("enable-btn");
        classList.remove("disable-btn");

        if (bool)
            return classList.add("enable-btn");

        classList.add("disable-btn");
    }

    updateTextContent(line, newText) {
        const element = document.getElementById(`line${line}`);
        element.innerHTML = newText;
    }

    clearLines() {
        this.updateTextContent("1", "");
        this.updateTextContent("2", "");
        this.updateTextContent("3", "");
    }

    changeMenuName(menu_number, text){
        let thing = document.getElementById(`menu${menu_number}`);
        thing.innerHTML = text;
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

        if (codeplug.ModelNumber.length !== 2) {
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

        if (codeplug.CodeplugVersion !== FIRMWARE_VERSION) {
            console.error('Codeplug validation failed: Invalid codeplug version. Expected:', FIRMWARE_VERSION, '!=', codeplug.CodeplugVersion);
            this.iserrorstate = true;
            result = false;
        }

        return result;
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

    saveCodeplugToStorage() {
        if (!this.codeplug) {
            console.error('No codeplug to save.');
            return;
        }

        localStorage.setItem("pager_codeplug", JSON.stringify(this.codeplug));
    }

    loadCodeplugFromStorage() {
        const storedCodeplug = JSON.parse(localStorage.getItem("pager_codeplug"));

        if (!storedCodeplug) {
            console.error('No codeplug found in storage.');
            return;
        }

        this.codeplug = new UnicationCodeplug();
        this.codeplug.load(storedCodeplug);
        this.codeplug = storedCodeplug;

        if (!this.validateCodeplug(this.codeplug)) {
            console.error('Failed to validate codeplug from storage.');
            this.iserrorstate = true;
        }
    }

    async loadCodeplugFromFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';

        await this.programMode();

        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        this.codeplug = new UnicationCodeplug(data);
                        this.saveCodeplugToStorage();
                        this.currentZoneIndex = 0;
                        this.currentChannelIndex = 0;

                        if (!this.validateCodeplug(this.codeplug)) {
                            console.error('Failed to validate codeplug from file.');
                            this.iserrorstate = true;
                            return;
                        }

                        this.programMode(false);
                        console.log('Codeplug loaded successfully.');
                    } catch (error) {
                        this.iserrorstate = true;
                        console.error('Error reading codeplug:', error);
                    }
                };
                reader.readAsText(file);
            }
        };

        fileInput.click();
    }

    async programMode(enter = true) {
        if (!this.isstarted && !this.isinprogrammode) {
            console.error('Cannot enter or leave program mode when the radio is off; allowing load anyway');
            return;
        }

        if (enter) {
            console.log("Entering program mode...");
            await this.radioPowerOff();
            this.clearLines();
            await sleep(500);
            this.updateTextContent("1", "Program");
            this.isinprogrammode = true;
            console.log("In program mode");
        } else {
            console.log("Exiting program mode...");
            await sleep(1000);
            this.clearLines();
            await sleep(1000);
            console.log("Calling radio power on...");
            await this.radioPowerOn();
            this.isinprogrammode = false;
            console.log("Exited program mode");
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}