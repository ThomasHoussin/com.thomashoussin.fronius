'use strict';

const FroniusDriver = require('../../lib/driver.js');

class OhmpilotDriver extends FroniusDriver {
    getCheckPath() {
        return '/solar_api/v1/GetOhmPilotRealtimeData.cgi?Scope=System';
    }

    getFroniusToDevice() {
        return froniusToDevice;
    }
}

module.exports = OhmpilotDriver;

function froniusToDevice(json, ip, DeviceId) {
    let device = {
        name: `${json.Details.Model}-${json.Details.Serial}`,
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
