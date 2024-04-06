const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

class UdpReceiver {
    constructor(io, config, baseUploadPath) {
        this.io = io;
        this.config = config;
        this.baseUploadPath = baseUploadPath;
        this.udpPort = config.udp.port || 5000;

        this.debug = config.udp.receive.debug;

        this.server = dgram.createSocket('udp4');

        if (config.udp.receive && config.udp.receive.enabled) {
            this.setupUdpServer();
        } else {
            if (this.debug) {
                console.log('UDP Receiver is disabled');
            }
        }
    }

    setupUdpServer() {
        this.server.on('error', (err) => {
            console.log(`UDP Server error: ${err.stack}`);
            this.server.close();
        });

        this.server.on('message', (msg, rinfo) => {
            console.log(`UDP Server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
            this.handleIncomingAudio(msg, rinfo).then(r => {
                if (this.debug) {
                    console.log('Audio handled successfully');
                }
            }).catch(e => {
                console.error('Error handling incoming audio:', e);
            });
        });

        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`UDP Server listening ${address.address}:${address.port}`);
        });

        this.server.bind(this.udpPort);
    }

    async handleIncomingAudio(msg, rinfo) {
        // TODO: do this properly
        if (this.debug) {
            console.log(`Received audio from ${rinfo.address}:${rinfo.port}`);
        }

        const filePath = path.join(this.baseUploadPath, `udp_audio_${Date.now()}.wav`);
        await fs.promises.writeFile(filePath, msg);


        const call = {}; // TODO: Check call type or make up a fake p25call or som
        const relativeAudioPath = `/uploads/${path.relative(this.baseUploadPath, filePath)}`;
        this.io.emit('newAudio', { audio: relativeAudioPath, call: call });
    }
}

module.exports = UdpReceiver;