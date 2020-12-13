'use strict';

const FroniusDevice = require('../../lib/device.js');
const fetch = require('node-fetch');

class PowerFlow extends FroniusDevice {
    updateFroniusDevice() {
        let settings = this.getSettings();
        const updatePath = '/solar_api/v1/GetPowerFlowRealtimeData.fcgi';
        const updateUrl = `http://${settings.ip}${updatePath}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(FroniusDevice.checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data.Site))
            .catch(error => {
                console.log(`Error when updating PowerFlow ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        let pgrid = (typeof data.P_Grid == 'undefined' || data.P_Grid == null) ? 0 : data.P_Grid;
        let pakku = (typeof data.P_Akku == 'undefined' || data.P_Akku == null) ? 0 : data.P_Akku;

        this.setCapabilityValue('measure_power.PV', (typeof data.P_PV == 'undefined' || data.P_PV == null) ? 0 : data.P_PV);
        this.setCapabilityValue('measure_power.LOAD', (typeof data.P_Load == 'undefined' || data.P_Load == null) ? 0 : data.P_Load);
        this.setCapabilityValue('measure_power.GRID', pgrid);
        this.setCapabilityValue('measure_power.AKKU', pakku);

      /* grid power + Akku power
      IDKW, homey adds power produced by PV in the energy tab (see for example https://github.com/DiedB/Homey-SolarPanels/issues/128)
      by using measure_power = grid power + akku power , the correct value should be displayed in energy tab assuming all PV power is used
      */
        this.setCapabilityValue('measure_power', pgrid + pakku);     
    }

    async onSettings(oldSettings, newSettings, changedKeys) {
        this.log('PowerFlow settings where changed');
        this.setEnergy({ cumulative: newSettings.cumulative });
    }
}

module.exports = PowerFlow ;

