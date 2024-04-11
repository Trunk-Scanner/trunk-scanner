import { Codeplug } from '/public/js/models/Codeplug.js';

const DEFAULT_MODEL = "APX7500";
const DEFAULT_SERIAL = "123ABC1234";

export class ApxRadioApp {
    constructor() {
        this.codeplug = new Codeplug();
        this.isstarted = false;
        this.iserrorstate = false;
        this.iskilled = false;
    }

    loadCodeplugJson() {
        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.handleFileSelect(e); // This is good
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            console.error('No file selected.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.codeplug.load(data);
                console.log('Codeplug loaded:', this.codeplug);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Error loading the codeplug.');
            }
        };
        reader.readAsText(file);
    }

    isRadioKilled(codeplug) {
        return codeplug.radioKilled || codeplug.trunkingInhibited;
    }

    validateCodeplug(codeplug) {
        let result = true;

        if (codeplug.systems.length < 0 || codeplug.talkgroups.length < 0 || codeplug.channels.length < 0) {
            result = false;
            this.iserrorstate = true;
        }

        if (codeplug.modelNumber.length !== 7){
            result = false;
            this.iserrorstate = true;
            codeplug.modelNumber = DEFAULT_MODEL;
        }

        if (codeplug.serialNumber.length !== 10){
            result = false;
            this.iserrorstate = true;
            codeplug.serialNumber = DEFAULT_SERIAL;
        }

        if (this.isRadioKilled(codeplug)){
            result = false;
            this.iskilled = true;
        }

        return result;
    }

    async start() {
        console.log('Starting Main Radio App');

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
                if (this.codeplug.modelNumber) {
                    document.getElementById("line1").innerText = this.codeplug.modelNumber;
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

        this.isstarted = true;
        console.log('Radio app started successfully.');
        document.getElementById("line1").innerText = this.codeplug.modelNumber;
        await sleep(500);
        document.getElementById("line1").innerText = '';
        await sleep(500);
        document.getElementById("line1").innerText = 'Zone A';
        document.getElementById("line2").innerText = this.codeplug.channels[0];
        document.getElementById("line3").innerText = '';
        return true;
    }

    async stop() {
        console.log('Stopping Main Radio App');
        this.isstarted = false;
        document.getElementById("line1").innerText = "";
        document.getElementById("line2").innerText = "";
        document.getElementById("line3").innerText = "";

        stopBlinkingLed();
        return true;

    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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