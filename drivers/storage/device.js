'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const updatePath = '/solar_api/v1/GetStorageRealtimeData.cgi?';
const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class StorageDevice extends Homey.Device {
    /**
     * onInit is called when the device is initialized.
     */
    async onInit() {
        this.log('StorageDevice has been initialized');

        this.polling = true;
        this.addListener('poll', this.pollDevice);
        // Enable device polling
        this.emit('poll');
    }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating StorageDevice ${this.getName()}`);
            this.updateStorage();
            await delay(this.getSetting('polling_interval'));
        }
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.log('StorageDevice has been added');
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
        this.log('StorageDevice settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name) {
        this.log('StorageDevice was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        this.log('StorageDevice has been deleted');
        this.polling = false;
    }

    updateStorage() {
        let settings = this.getSettings();
        const updateUrl = `http://${settings.ip}${updatePath}Scope=Device&DeviceId=${settings.DeviceId}`;
        console.log(updateUrl);

        fetch(updateUrl)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => this.updateValues(json.Body.Data.Controller))
            .catch(error => {
                console.log(`Error when updating StorageDevice ${this.getName()} on ${updateUrl}`);
            });
    }

    updateValues(data) {

        let voltage = typeof data.Voltage_DC == 'undefined' ? 0 : data.Voltage_DC;
        let current = typeof data.Current_DC == 'undefined' ? 0 : data.Current_DC;

        //Current maximum capacity
        this.setCapabilityValue('meter_power', typeof data.Capacity_Maximum == 'undefined' ? 0 : data.Capacity_Maximum / 1000);
        //Voltage DC
        this.setCapabilityValue('measure_voltage', voltage );
        //Voltage Current
        this.setCapabilityValue('measure_current', current);
        //temp ; default to 0 
        this.setCapabilityValue('measure_temperature', typeof data.Temperature_Cell == 'undefined' ? 0 : data.Temperature_Cell);
        //% of charge
        this.setCapabilityValue('measure_battery', typeof data.StateOfCharge_Relative == 'undefined' ? 0 : data.StateOfCharge_Relative);
        //power approximation
        this.setCapabilityValue('measure_power', - voltage * current);
    }
}

module.exports = StorageDevice;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
