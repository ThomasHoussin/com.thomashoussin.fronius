'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const updatePath = '/solar_api/v1/GetOhmPilotRealtimeData.cgi?';
const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class Inverter extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('OhmPilot has been initialized');

      this.polling = true;
      this.addListener('poll', this.pollDevice);
      // Enable device polling
      this.emit('poll');
  }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating OhmPilot ${this.getName()}`);
            this.updateInverter();
            await delay(this.getSetting('polling_interval'));
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('OhmPilot has been added');
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
      this.log('OhmPilot settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('OhmPilot was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('OhmPilot has been deleted');
      this.polling = false;
  }

    updateInverter() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${updatePath}Scope=Device&DeviceId=${settings.DeviceId}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data))
            .catch(error => {
                console.log(`Error when updating OhmPilot ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        //consumed energy in kWh ; default to 0
        this.setCapabilityValue('meter_power', typeof data.EnergyReal_WAC_Sum_Consumed == 'undefined' ? 0 : data.EnergyReal_WAC_Sum_Consumed / 1000);
        //actual power consumption ; default to 0 
        this.setCapabilityValue('measure_power', typeof data.PowerReal_PAC_Sum == 'undefined' ? 0 : data.PowerReal_PAC_Sum);
        //temp ; default to 0 
        this.setCapabilityValue('measure_temperature', typeof data.Temperature_Channel_1 == 'undefined' ? 0 : data.Temperature_Channel_1);
        //state
        /*# CodeOfState Values:
        # 0 ...up and running
        # 1 ...keep minimum temperature
        # 2 ...legionella protection
        # 3 ...critical fault
        # 4 ...fault
        # 5 ...boost mode */

        let state = typeof data.CodeOfState == 'undefined' ? 6 : data.CodeOfState;
        let stateString = 'unknown';
        switch (state) {
            case 0:
                stateString = 'up';
                break;
            case 1:
                stateString = 'keepmin';
                break;
            case 2:
                stateString = 'legionella';
                break;
            case 3:
                stateString = 'critical';
                break;
            case 4:
                stateString = 'fault';
                break;
            case 5:
                stateString = 'boost';
                break;
            default:
                console.log('Using default value for OhmPilot state');
        }
        this.setCapabilityValue('ohmpilotstate', stateString);
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
