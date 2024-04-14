export class Codeplug {
    constructor(data = {}) {
        this.Zones = data.Zones || [];
        this.ScanLists = data.ScanLists || [];
        this.RadioMode = data.RadioMode || 0;
        this.ControlHead = data.ControlHead || 0;
        this.CodeplugVersion = data.CodeplugVersion || '';
        this.LastProgramSource = data.LastProgramSource || 0;
        this.ModelNumber = data.ModelNumber || '';
        this.SerialNumber = data.SerialNumber || '';
        this.FlickerCode = data.FlickerCode || '';
        this.RadioKilled = data.RadioKilled || false;
        this.TrunkingInhibited = data.TrunkingInhibited || false;
        this.TtsEnabled = data.TtsEnabled || false;
        this.SecondaryRadioTx = data.SecondaryRadioTx || false;
        this.EnforceSystemId = data.EnforceSystemId || false;
        this.HomeSystemId = data.HomeSystemId || '';
        this.PasswordProtected = data.PasswordProtected || false;
    }

    async decrypt(encryptedData, password) {
        const enc = new TextEncoder();
        const dec = new TextDecoder();

        const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

        const iv = encryptedBytes.slice(0, 16);
        const encryptedContent = encryptedBytes.slice(16);

        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password.padEnd(32, '\0')),
            { name: "AES-CBC" },
            false,
            ["decrypt"]
        );

        try {
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-CBC", iv },
                keyMaterial,
                encryptedContent
            );
            const decryptedText = dec.decode(new Uint8Array(decrypted));
            return JSON.parse(decryptedText);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error("Failed to decrypt.");
        }
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