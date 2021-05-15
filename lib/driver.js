'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

class FroniusDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('Fronius has been initialized');
    }

    getCheckPath() {
        throw new Error('todo: Implement into child class');
    }

    getFroniusToDevice() {
        throw new Error('todo: Implement into child class');
    }

    onPair(session) {
        var devices;    
        let checkPath = this.getCheckPath();
        let froniusToDevice = this.getFroniusToDevice();

        session.setHandler('validate', async function (data) {
            console.log("Validate new connection settings");
            let ip = data.host;

            const validationUrl = `http://${ip}${checkPath}`;
            console.log(validationUrl);

            return fetch(validationUrl)
                .then(checkResponseStatus)
                .then(result => result.json())
                .then(json => buildDevices(froniusToDevice, json.Body.Data, ip))
                .then(list => {
                    devices = list;
                    return 'ok';
                })
                .catch(error => {
                    console.log(error);
                    return error;
                });
        });

        session.setHandler('list_devices', async function (data) {
            console.log('List devices started...');

            return devices;
        });
    }
}

module.exports = FroniusDriver;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}

function buildDevices(froniusToDevice, json, ip) {
    var devices = [];
    for (var id in json) {
        if (json.hasOwnProperty(id)) {
            devices.push(froniusToDevice(json[id], ip, id));
        }
    };
    return devices;
}