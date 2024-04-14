export class Codeplug {
    constructor() {
        this.Zones = [];
        this.ScanLists = [];
        this.RadioMode = 0;
        this.ControlHead = 0;
        this.CodeplugVersion = '';
        this.LastProgramSource = 0;
        this.ModelNumber = '';
        this.SerialNumber = '';
        this.FlickerCode = '';
        this.RadioKilled = false;
        this.TrunkingInhibited = false;
        this.TtsEnabled = false;
        this.SecondaryRadioTx = false;
        this.EnforceSystemId = false;
        this.HomeSystemId = '';
        this.PasswordProtected = false;
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