'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const updatePath = '/solar_api/v1/GetPowerFlowRealtimeData.fcgi';
const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class PowerFlow extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('PowerFlow has been initialized');

      this.polling = true;
      this.addListener('poll', this.pollDevice);
      // Enable device polling
      this.emit('poll');
  }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating powerflow ${this.getName()}`);
            this.updatePowerFlow();
            await delay(this.getSetting('polling_interval'));
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('PowerFlow has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
      this.log('PowerFlow settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('PowerFlow was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('PowerFlow has been deleted');
      this.polling = false;
  }

    updatePowerFlow() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${updatePath}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
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
}

module.exports = PowerFlow ;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
