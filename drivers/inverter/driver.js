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
            DT: json.DT
        },
        data: {
            id: json.UniqueID,
        },
        capabilities: [
            "measure_power",
            "measure_current.AC",
            "measure_current.DC",
            "measure_voltage.AC",
            "measure_voltage.DC",
            "measure_frequency",
            "meter_power.TOTAL"
        ],
    };

    if (device.settings.DT != 1) {
        device.capabilities.push('meter_power');
        device.capabilities.push('meter_power.YEAR');
    }

    console.log(device);
    return device;
}
