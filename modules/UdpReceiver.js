const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const P25CallData = require('../models/P25CallData');

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
            if (this.debug) {
                console.log(`UDP Server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
            }

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
        // Fake p25 call
        let call = new P25CallData({
            key: 0,
            system: `udp:${rinfo.address}:${rinfo.port}`,
            dateTime: Date.now(),
            talkgroup: 'Unknown',
            source: "UDP CALL",
            frequency: "000000000",
            talkgroupLabel: 'Unknown',
            talkgroupGroup: 'Unknown',
            systemLabel: 'Unknown',
            patches: [],
            mode: 'P25_UDP'
        });

        console.log(call.mode, "Call Received; TG:", call.talkgroup, "Freq:", call.frequency, "Source:", call.source, "System:", call.system, "DateTime:", call.dateTime);

        this.io.emit('new_call', { audio: msg, call: call, type: "WAV_STREAM" });
    }
}

module.exports = UdpReceiver;