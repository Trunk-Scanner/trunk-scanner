import {UnicationCodeplug} from "./models/UnicationCodeplug.js";

const FIRMWARE_VERSION = "R01.01.00";

const DEFAULT_MODEL = "G5";
const DEFAULT_SERIAL = "123ABC1234";

export class UnicationPagerApp {
    constructor(actualModel, defaultCodeplug) {
        this.actualModel = actualModel;
        this.defaultCodeplug = defaultCodeplug;

        this.codeplug = null;

        this.isreceiving = false;
        this.iserrorstate = false;

        this.currentZoneIndex = 0;
        this.currentChannelIndex = 0;

        this.system = "Trunk-Scanner";

        this.socket = io();

        document.getElementById("pwr_button").addEventListener("click", () => {this.radioPowerOn();});
    }

    radioPowerOn()
    {
        console.log("Powering on...");
        setTimeout(() => {
            this.mainFunction();
        }, 1000);
    }

    mainFunction(time) {
        /*        let audio = new Audio('/public/audio/trunking_tg_priority.wav');
                audio.play();*/
        try {
            if (this.defaultCodeplug) {
                this.codeplug = new UnicationCodeplug(this.defaultCodeplug);
            } else {
                console.error("FATAL ERROR");
                this.iserrorstate = true;
                this.clearLines();
                this.updateTextContent("1", "Unication");
                this.updateTextContent("2", DEFAULT_MODEL);

                return;
            }
            this.updateCurrentZoneChannel(true);

            this.socket.on("new_call", function (data) {
                console.log(data);
            });

            console.log("Unication pager app started");
        } catch (e) {
            console.log("Failed to start unication pager app");
            console.log(e);
        }
    }

    handleCallStart(call) {
        if(call.talkgroup === this.current_channel) {
            this.updateTextContent("1", `To:${call.talkgroup}`);
            this.updateTextContent("3", `Fm:[${call.source}]`);
            this.updateTextContent("2", '');
        }
    }

    handleCallStop(call){
        if(call.talkgroup === this.current_channel) {
            setTimeout(() =>{
                this.updateCurrentZoneChannel(true);
            }, 1500)
        }
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
}