const SdrTrunkServer = require('./modules/SdrTrunkApi');
const WebServer = require('./modules/WebServer');
const configLoader = require('./modules/configLoader');

const config = configLoader.loadConfig('configs/config.yml');

const webServer = new WebServer(config);

new SdrTrunkServer(webServer.io, config);