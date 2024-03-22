const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

class WebServer {
    constructor() {
        this.port = 4000;

        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server);

        this.app.set('views', path.join(__dirname, '../views'));
        this.app.set('view engine', 'ejs');

        this.app.use('/uploads', express.static('uploads'));
        this.app.use('/public', express.static('public'));

        this.app.get('/', (req, res) => {
            res.render("index");
        });

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
            socket.on('disconnect', () => {
                /* stub */
            });
        });

        this.server.listen(this.port, () => {
            console.log(`Web server listening at http://localhost:${this.port}`);
        });
    }
}

module.exports = WebServer;