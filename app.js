const yargs = require('yargs');

const SdrTrunkServer = require('./modules/SdrTrunkApi');
const WebServer = require('./modules/WebServer');
const configLoader = require('./modules/configLoader');

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

    const webServer = new WebServer(config);

    new SdrTrunkServer(webServer.io, config);
} else {
    console.error('No config file specified');
    process.exit(1);
}