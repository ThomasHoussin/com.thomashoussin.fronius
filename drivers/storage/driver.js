'use strict';

const FroniusDriver = require('../../lib/driver.js');

class StorageDriver extends FroniusDriver {
    getCheckPath() {
        return '/solar_api/v1/GetStorageRealtimeData.cgi?Scope=System';
    }

    getFroniusToDevice() {
        return froniusToDevice;
    }
}

module.exports = StorageDriver;

function froniusToDevice(json, ip, DeviceId) {
    let device = {
        name: `${json.Controller.Details.Model}-${json.Controller.Details.Serial}`,
        settings: {
            ip: ip,
            DeviceId: parseInt(DeviceId, 10),
        },
        data: {
            id: json.Controller.Details.Serial,
        }
    };
    console.log(device);
    return device;
}
