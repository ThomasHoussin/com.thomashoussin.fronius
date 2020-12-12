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

    onPair(socket) {
        var devices;    
        let checkPath = this.getCheckPath();
        let froniusToDevice = this.getFroniusToDevice();

        socket.on('validate', function (data, callback) {
            console.log("Validate new connection settings");
            let ip = data.host;

            const validationUrl = `http://${ip}${checkPath}`;
            console.log(validationUrl);

            fetch(validationUrl)
                .then(checkResponseStatus)
                .then(result => result.json())
                .then(json => buildDevices(froniusToDevice, json.Body.Data, ip))
                .then(list => {
                    devices = list;
                    callback(false, 'ok');
                })
                .catch(error => {
                    callback(new Error(Homey.__('ip_error')));
                });
        });

        socket.on('list_devices', function (data, callback) {
            console.log('List devices started...');
        
            // emit when devices are still being searched
            //socket.emit('list_devices', callback);
            // fire the callback when searching is done
            callback(null, devices);

            // when no devices are found, return an empty array
            // callback( null, [] );

            // or fire a callback with Error to show that instead
            // callback( new Error('Something bad has occured!') );
        });
    }
}

module.exports = FroniusDriver;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        callback(new Error(Homey.__('ip_error')));
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