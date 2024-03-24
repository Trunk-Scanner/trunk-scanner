const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const LtrCallData = require("../models/LtrCallData");
const P25CallData = require("../models/P25CallData");
const callData = require("./callData");

class SdrTrunkApi {
    constructor(io, config) {
        this.port = config.sdrtrunk.port || 3000;
        this.bindAddress = config.sdrtrunk.bindAddress;

        this.io = io;
        this.app = express();

        this.baseUploadPath = path.join(__dirname, '../uploads');

        this.upload = multer({ dest: 'uploads/tmp/' });

        this.app.post('/api/call-upload', this.upload.any(), async (req, res) => {
/*            console.log('Headers:', req.headers);
            console.log('Files:', req.files);
            console.log('Body:', req.body);
            console.log("Received call data");*/
            const {key, system, test} = req.body;

            const systemConfig = config.systems.find(s => s.id.toString() === system && s.enabled);

            if (!systemConfig) {
                console.error("Unknown system ID: ", system);
                return res.status(401).send("Invalid API key or System ID");
            }

            if (systemConfig.type !== "sdrtrunk") {
                console.error("Unknown system type:", systemConfig.type, "for:", systemConfig.alias);
                return res.status(401).send("Invalid API key or System ID");
            }

            if (systemConfig.apiKey !== key.toString())  {
                console.error("Invalid key for:", systemConfig.alias, "with key:", key);
                return res.status(401).send("Invalid API key or System ID");
            }

            // handle test connection. VERY dumb way to do this. Not sure why sdr trunk expects this body for the test
            if (test && systemConfig.type === "sdrtrunk") {
                console.log("New SDR Trunk connection for system:", systemConfig.alias);
                return res.status(200).send("incomplete call data: no talkgroup");
            }

            if (req.files && req.files.length > 0 && this.io) {
                if (callData.isLtrCall(req.body)){
                    await this.handleCall(new LtrCallData(req.body), req);
                } else if (callData.isP25Call(req.body)){
                    await this.handleCall(new P25CallData(req.body), req);
                } else {
                    console.log(req.body.mode, "call type");
                    return res.status(400).send("Unknown call type");
                }
            }

            console.log("Call data received and sent successfully");
            res.send('Call imported successfully.\n');
        });

        this.app.listen(this.port, this.bindAddress, () => {
            console.log(`SDR Trunk server listening at http://${this.bindAddress}:${this.port}`);
        });
    }

    async handleCall(call, req) {
        const originalPath = req.files[0].path;
        const dateObj = new Date(parseInt(call.dateTime) * 1000);
        const datePath = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const timePath = `${String(dateObj.getHours()).padStart(2, '0')}-${String(dateObj.getMinutes()).padStart(2, '0')}-${String(dateObj.getSeconds()).padStart(2, '0')}`;

        const audioPath = path.join(this.baseUploadPath, call.system, call.talkgroup, datePath, `${timePath}.mp3`);
        console.log(req.body.mode, "Call Received; TG:", call.talkgroup, "Freq:", call.frequency, "Source:", call.source, "System:", call.system, "DateTime:", call.dateTime);
        try {
            await this.storeFile(originalPath, audioPath);
            const relativeAudioPath = `/uploads/${path.relative(this.baseUploadPath, audioPath)}`;
            this.io.emit('newAudio', { audio: relativeAudioPath, call: call });
        } catch (err) {
            console.error("Failed to store file:", err);
        }
    }

    async storeFile(originalPath, targetPath) {
        const dir = path.dirname(targetPath);
        try {
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.rename(originalPath, targetPath);
        } catch (err) {
            throw err;
        }
    }
}

module.exports = SdrTrunkApi;