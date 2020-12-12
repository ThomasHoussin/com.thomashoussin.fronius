'use strict';

var FroniusDriver = require('../../lib/driver.js');

class FroniusSmartmeter extends FroniusDriver {
    getCheckPath() {
        return '/solar_api/v1/GetMeterRealtimeData.cgi?Scope=System';
    }

    getFroniusToDevice() {
        return froniusToDevice ;
    }
}

module.exports = FroniusSmartmeter;

function froniusToDevice(json, ip, DeviceId) {
    let device = {
        name: json.Details.Model,
        settings: {
            ip: ip,
            DeviceId: parseInt(DeviceId, 10),
        },
        data: {
            id: json.Details.Serial,
        }
    };
    console.log(device);
    return device;
}
