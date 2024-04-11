const dgram = require('dgram');

class UdpSender {
    constructor(dstAddress, port, debug) {
        this.dstAddress = dstAddress;
        this.port = port;
        this.debug = debug;

        this.udp = dgram.createSocket('udp4');
    }

    send(data) {
        if (!this.udp) {
            console.error('UDP socket is not open');
            return;
        }

        if (!data) {
            console.error('No data to send');
            return;
        }

        this.udp.send(data, this.port, this.dstAddress, (err) => {
            if (err) {
                console.error('Error sending UDP packet:', err);
            }
            if (this.debug) {
                console.log('UDP packet sent');
            }
        });
    }
}

module.exports = UdpSender;