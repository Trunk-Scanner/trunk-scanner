export class Codeplug {
    constructor() {
        this.systems = [];
        this.talkgroups = [];
        this.channels = [];
        this.modelNumber = '';
        this.serialNumber = '';
        this.flickerCode = '';
        this.radioKilled = false;
        this.trunkingInhibited = false;
    }

    load(data) {
        Object.keys(data).forEach(key => {
            if (this.hasOwnProperty(key)) {
                this[key] = data[key];
            }
        });
    }
}