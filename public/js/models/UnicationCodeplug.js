export class UnicationCodeplug {
    constructor(data = {}) {
        this.Zones = data.Zones || [];
        this.ScanLists = data.ScanLists || [];
        this.CodeplugVersion = data.CodeplugVersion || '';
        this.LastProgramSource = data.LastProgramSource || 0;
        this.ModelNumber = data.ModelNumber || '';
        this.SerialNumber = data.SerialNumber || '';
        this.TrunkingInhibited = data.TrunkingInhibited || false;
        this.TtsEnabled = data.TtsEnabled || false;
        this.EnforceSystemId = data.EnforceSystemId || false;
        this.HomeSystemId = data.HomeSystemId || '';
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