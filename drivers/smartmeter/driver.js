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
            threePhase: typeof data.Current_AC_Phase_3 == 'number',
            gen24meterbug: (typeof json.GRID_FREQUENCY_MEAN_F32 == 'undefined' ? false : true),
        },
        data: {
            id: json.Details.Serial,
        }
    };
    console.log(device);
    return device;
}
