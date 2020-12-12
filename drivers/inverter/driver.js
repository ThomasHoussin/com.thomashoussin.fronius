'use strict';

const he = require('he');
const FroniusDriver = require('../../lib/driver.js');

class Fronius extends FroniusDriver {
    getCheckPath() {
        return '/solar_api/v1/GetInverterInfo.cgi';
    }

    getFroniusToDevice() {
        return froniusToDevice;
    }
}

module.exports = Fronius;

function froniusToDevice(json, ip, DeviceId) {
    let device = {
        name: he.decode(json.CustomName),
        settings: {
            ip: ip,
            DeviceId: parseInt(DeviceId, 10),
            PVPower: json.PVPower,
        },
        data: {
            id: json.UniqueID,
        }
    };
    console.log(device);
    return device;
}
