const yargs = require('yargs');

const SdrTrunkServer = require('./modules/SdrTrunkApi');
const WebServer = require('./modules/WebServer');
const configLoader = require('./modules/configLoader');
const UdpReceiver = require("./modules/UdpReceiver");
const path = require("path");

const argv = yargs

    .option('c', {
        alias: 'config',
        describe: 'Path to config file',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

// Template for config object
let config = {
    web: {},
    sdrtrunk: {},
    discord: null,
    systems: []
};

if (argv.config) {
    const config = configLoader.loadConfig(argv.config);
    const baseUploadPath = path.join(__dirname, 'uploads');

    const webServer = new WebServer(config);

    if ((!config.sdrtrunk || !config.sdrtrunk.enabled) && (!config.udp || !config.udp.enabled)) {
        console.log('SDRTrunk or UDP not enabled or no config found for them; Must have at least one API for this to be useful');
        process.exit(1);
    }

    new SdrTrunkServer(webServer.io, config, baseUploadPath);
    new UdpReceiver(webServer.io, config, baseUploadPath);
} else {
    console.error('No config file specified');
    process.exit(1);
}