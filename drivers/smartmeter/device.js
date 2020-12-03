'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const updatePath = '/solar_api/v1/GetMeterRealtimeData.cgi?';
const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class Smartmeter extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('Smartmeter has been initialized');

      this.polling = true;
      this.addListener('poll', this.pollDevice);
      // Enable device polling
      this.emit('poll');
      //this.updateInverter();
  }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating Smartmeter ${this.getName()}`);
            this.updateMeter();
            await delay(this.getSetting('polling_interval'));
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('Smartmeter has been added');
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
      this.log('Smartmeter settings where changed');
      this.setEnergy({ cumulative: newSettings.cumulative });
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('Smartmeter was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('Smartmeter has been deleted');
      this.polling = false;
  }

    updateMeter() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${updatePath}Scope=Device&DeviceId=${settings.DeviceId}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data))
            .catch(error => {
                console.log(`Error when updating Smartmeter ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        //Consumed Energy in kWh ; default to 0 ; should be given by EnergyReal_WAC_Plus_Absolute
        this.setCapabilityValue('meter_power', typeof data.EnergyReal_WAC_Plus_Absolute == 'undefined' ? 0 : data.EnergyReal_WAC_Plus_Absolute / 1000);
        //Injected energy ; EnergyReal_WAC_Minus_Absolute
        this.setCapabilityValue('meter_power.injected', typeof data.EnergyReal_WAC_Minus_Absolute == 'undefined' ? 0 : data.EnergyReal_WAC_Minus_Absolute / 1000);

        //power, in W ; default to 0 
        this.setCapabilityValue('measure_power', typeof data.PowerReal_P_Sum == 'undefined' ? 0 : data.PowerReal_P_Sum);

        //Current, in A ; default to 0 
        let current = 0; 
        if (typeof data.Current_AC_Sum == 'number') current = data.Current_AC_Sum;
        else if (typeof data.Current_AC_Phase_1 == 'number' && typeof data.Current_AC_Phase_2 == 'number' && typeof data.Current_AC_Phase_3 == 'number') current = data.Current_AC_Phase_1 + data.Current_AC_Phase_2 + Current_AC_Phase_3;
        this.setCapabilityValue('measure_current', current);

        //Voltage, in V ; default to 0 
        let voltage = 0;
        if (typeof data.Voltage_AC_Phase_Average == 'number') voltage = data.Voltage_AC_Phase_Average;
        else if (typeof data.Voltage_AC_Phase_1 == 'number' && data.Voltage_AC_Phase_2 == 'number' && data.Voltage_AC_Phase_3 == 'number') voltage = (data.Voltage_AC_Phase_1 + data.Voltage_AC_Phase_2 + data.Voltage_AC_Phase_3) / 3;
        else if (typeof data.Voltage_AC_Phase_1 == 'number') voltage = data.Voltage_AC_Phase_1;
        this.setCapabilityValue('measure_voltage', voltage);

        //Phase frequency, in Hz ; default to 0
        this.setCapabilityValue('measure_frequency', typeof data.Frequency_Phase_Average == 'undefined' ? 0 : data.Frequency_Phase_Average);
    }
}

module.exports = Smartmeter ;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
