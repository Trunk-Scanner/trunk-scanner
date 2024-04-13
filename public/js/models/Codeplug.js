export class Codeplug {
    constructor() {
        this.Zones = [];
        this.ScanLists = [];
        this.ControlHead = 0;
        this.CodeplugVersion = '';
        this.LastProgramSource = 0;
        this.ModelNumber = '';
        this.SerialNumber = '';
        this.FlickerCode = '';
        this.RadioKilled = false;
        this.TrunkingInhibited = false;
        this.TtsEnabled = false;
    }

    load(data) {
        Object.keys(data).forEach(key => {
            if (this.hasOwnProperty(key)) {
                this[key] = data[key];
            }
        });

        this.processScanLists();
    }

    processScanLists() {
        this.Zones.forEach(zone => {
            if (zone.ScanListName) {
                const scanList = this.ScanLists.find(list => list.Name === zone.ScanListName);
                if (scanList) {
                    zone.ScanList = scanList;
                } else {
                    console.warn(`ScanList named '${zone.ScanListName}' not found for zone '${zone.Name}'.`);
                }
            }
        });
    }
}