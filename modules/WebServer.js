const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

class WebServer {
    constructor(config) {
        this.port = config.web.port || 4000;
        this.bindAddress = config.web.bindAddress || "0.0.0.0";
        this.debug = config.web.debug || false;

        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server);

        this.connectedUsers = 0;

        this.app.set('views', path.join(__dirname, '../views'));
        this.app.set('view engine', 'ejs');

        this.app.use('/uploads', express.static('uploads'));
        this.app.use('/public', express.static('public'));

        this.app.get('/', (req, res) => {
            const groups = config.groups;

            res.render("index", { groups, connectedUsers: this.connectedUsers });
        });


        if (config.web.apx && config.web.apx.enabled) {
            this.app.get('/apxRadio/:chType?/:numOfRadios?', (req, res) => {
                const groups = config.groups;
                const chType = req.params.chType;
                const numOfRadios = req.params.numOfRadios;
                const allowLoad = config.web.apx.allowLoadCodeplug;

                let view;
                let codeplug;

                if (chType === 'o2') {
                    view = "apxO2";
                } else if (chType === 'apxE5') {
                    view = "apxE5";
                } else {
                    view = "apxE5";
                }

                if ((config.web.apx && config.web.apx.o2 && config.web.apx.o2.defaultCodeplugDir) && view === "apxO2") {
                    codeplug = this.loadFile(config.web.apx.o2.defaultCodeplugDir);

                    if (this.debug) {
                        console.log("O2 loaded: ", codeplug);
                    }
                } else if ((config.web.apx && config.web.apx.e5 && config.web.apx.e5.defaultCodeplugDir) && view === "apxE5") {
                    codeplug = this.loadFile(config.web.apx.e5.defaultCodeplugDir);

                    if (this.debug) {
                        console.log("E5 loaded: ", codeplug);
                    }
                }

                res.render(view, {groups, numOfRadios, defaultCodeplug: JSON.parse(codeplug), allowLoad: allowLoad});
            });
        }

        this.app.get('/api/recordings', (req, res) => {
            const { system, talkgroup, date } = req.query; // Filters from query params
            const baseDir = path.join(__dirname, '../uploads');

            try {
                let directories = [baseDir, system, talkgroup, date].filter(Boolean); // Remove falsy values
                let searchPath = path.join(...directories);

                fs.readdir(searchPath, (err, files) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Error reading directory');
                    }

                    let recordings = files.map(file => ({
                        filename: file,
                        path: `/uploads/${system}/${talkgroup}/${date}/${file}`,
                        talkgroup: talkgroup,
                        date: date,
                        system: system
                    }));

                    res.json(recordings);
                });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });

        this.io.on('connection', (socket) => {
            this.connectedUsers++;
            this.emitUserCount();

            if (this.debug) {
                console.log(`A user connected. Total connected users: ${this.connectedUsers}`);
            }

            socket.on('disconnect', () => {
                this.connectedUsers--;
                this.emitUserCount();

                if (this.debug) {
                    console.log(`A user disconnected. Total connected users: ${this.connectedUsers}`);
                }
            });
        });

        this.server.listen(this.port, () => {
            console.log(`Web server listening at http://localhost:${this.port}`);
        });
    }

    emitUserCount() {
        this.io.emit('userCount', this.connectedUsers);
    }

    loadFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        }
        catch (error) {
            console.error(`Failed to read default codeplug: ${filePath}`);
            return '';
        }
    }
}

module.exports = WebServer;