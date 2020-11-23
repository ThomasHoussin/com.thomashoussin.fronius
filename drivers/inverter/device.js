'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const updatePath = '/solar_api/v1/GetInverterRealtimeData.cgi?';
const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class Inverter extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('Inverter has been initialized');

      this.polling = true;
      this.addListener('poll', this.pollDevice);
      // Enable device polling
      this.emit('poll');
      //this.updateInverter();
  }

    async pollDevice() {
        while (this.polling) {
            console.log("updating");
            this.updateInverter();
            await delay(this.getSetting('polling_interval'));
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('Inverter has been added');
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
      this.log('Inverter settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('Inverter was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('Inverter has been deleted');
      this.polling = false;
  }

    updateInverter() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${updatePath}Scope=Device&DeviceId=${settings.DeviceId}&DataCollection=CommonInverterData`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data))
            .catch(error => {
                console.log(`Error when updating inverter ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        //AC Energy in kWh ; default to 0
        this.setCapabilityValue('meter_power', typeof data.DAY_ENERGY == 'undefined' ? 0 : data.DAY_ENERGY.Value / 1000);
        //AC Energy in kWh ; default to 0
        this.setCapabilityValue('meter_power.YEAR', typeof data.YEAR_ENERGY == 'undefined' ? 0 : data.YEAR_ENERGY.Value / 1000);
        //AC Energy in kWh ; default to 0
        this.setCapabilityValue('meter_power.TOTAL', typeof data.TOTAL_ENERGY == 'undefined' ? 0 : data.TOTAL_ENERGY.Value / 1000);
        //AC power ; default to 0 
        this.setCapabilityValue('measure_power', typeof data.PAC == 'undefined' ? 0 : data.PAC.Value);
    }
}

module.exports = Inverter ;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
