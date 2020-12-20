'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class FroniusDevice extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('Device has been initialized');

      // Enable device polling
      this.polling = true;
      this.addListener('poll', this.pollDevice);
      this.emit('poll');
  }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating device ${this.getName()}`);
            this.updateFroniusDevice();
            await delay(this.getSetting('polling_interval'));
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings(oldSettings, newSettings, changedKeys) {
      this.log('Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('Device has been deleted');
      this.polling = false;
    }

    getUpdatePath() {
        throw new Error('todo: Implement into child class');
    }

    getOptionalSuffix() {
        return '';
    }

    updateFroniusDevice() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${this.getUpdatePath()}Scope=Device&DeviceId=${settings.DeviceId}${this.getOptionalSuffix()}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data))
            .catch(error => {
                console.log(`Error when updating device ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {
        //this function has to be definid in child clss
        console.log(`Error : call to generic class Driver FroniusDriver`);
        callback(new Error(Homey.__('prototype function called')));
    }
}

module.exports = FroniusDevice;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
