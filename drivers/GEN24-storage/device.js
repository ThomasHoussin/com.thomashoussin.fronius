'use strict';

const FroniusDevice = require('../../lib/device.js');
const fetch = require('node-fetch');

class GEN24storage extends FroniusDevice {
    updateFroniusDevice() {
        let settings = this.getSettings();

        const updatePath = '/solar_api/v1/GetPowerFlowRealtimeData.fcgi';
        const updateUrl = `http://${settings.ip}${updatePath}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(FroniusDevice.checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data.Inverters[settings.DeviceId]))
            .catch(error => {
                console.log(`Error when updating PowerFlow ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        this.setCapabilityValue('measure_battery', (typeof data.SOC == 'undefined' || data.P == null) ? 0 : data.SOC);
        this.setCapabilityValue('battery_mode', (typeof data.Battery_Mode == 'undefined' || data.P == null) ? "Unknown" : data.Battery_Mode);
    }
}

module.exports = GEN24storage ;

