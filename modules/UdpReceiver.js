const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const P25CallData = require('../models/P25CallData');
const UdpSender = require("./UdpSender");

class UdpReceiver {
    constructor(io, config, baseUploadPath) {
        this.io = io;
        this.config = config;
        this.baseUploadPath = baseUploadPath;
        this.udpPort = config.udp.port || 5000;
        this.hangtime = config.udp.receive.hangtime || 5000;
        this.debug = config.udp.receive.debug;

        this.server = dgram.createSocket('udp4');

        this.lastPacketTimestamp = 0;

        if (config.udp.send && config.udp.send.enabled) {
            this.sender = new UdpSender(config.udp.send.dstAddress, config.udp.send.port, config.udp.send.debug);
        }

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
        const currentTime = Date.now();
        const timeSinceLastPacket = currentTime - this.lastPacketTimestamp;
        let call;

        if (timeSinceLastPacket > this.hangtime) {
            // Fake p25 call
            call = new P25CallData({
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
            this.lastPacketTimestamp = currentTime;
        }

        if (!msg) {
            console.log('Invalid call or message');
            return;
        }

        if (this.sender) {
            this.sender.send(msg);
        }

        this.io.emit('new_call', { audio: msg, call: call, type: "WAV_STREAM" });
    }
}

module.exports = UdpReceiver;