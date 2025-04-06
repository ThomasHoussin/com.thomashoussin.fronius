'use strict';

const FroniusDevice = require('../../lib/device.js');

class Inverter extends FroniusDevice {

 /**
 * onInit is called when the device is initialized.
 */
    async onInit() {
        this.log('Device has been initialized');

        //v0.1.5 adds frequency capability in inverter
        //add this new capability if needed
        if (!this.hasCapability('measure_frequency')) {
            console.log(`Adding capability measure_frequency to device ${this.getName()}`);
            this.addCapability('measure_frequency');
        }

        //checking if DT is GEN24 or Tauro
        //remove non-supported capabilities if created with 
        if (this.getSetting('DT') == 1) {
            if (this.hasCapability('meter_power')) {
                console.log(`Removing capability meter_power from device ${this.getName()}`);
                this.removeCapability('meter_power');
            }
            if (this.hasCapability('meter_power.YEAR')) {
                console.log(`Removing capability meter_power.YEAR from device ${this.getName()}`);
                this.removeCapability('meter_power.YEAR');
            }
        }

        let mppt = this.getSetting('MPPTnumber');
        //ignore mppt value if DT is not Tauro or GEN24
        if (this.getSetting('DT') != 1) mppt = 1;

        for (let i = 2; i <= mppt; i++) {
            let capv = 'measure_voltage.DC' + i;
            let capi = "measure_current.DC" + i;
            if (!this.hasCapability(capv)) this.addCapability(capv);
            if (!this.hasCapability(capi)) this.addCapability(capi);
        }
        for (let i = mppt + 1 ; i <= 4; i++) {
            let capv = 'measure_voltage.DC' + i;
            let capi = "measure_current.DC" + i;
            if (this.hasCapability(capv)) this.removeCapability(capv);
            if (this.hasCapability(capi)) this.removeCapability(capi);
        }

        // Enable device polling
        this.polling = true;
        this.addListener('poll', this.pollDevice);
        this.emit('poll');
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.log('Inverter settings where changed');

        if (changedKeys.includes('MPPTnumber') || changedKeys.includes('DT')) {
            let mppt = newSettings.MPPTnumber;
            //ignore mppt value if DT is not Tauro or GEN24
            if (newSettings.DT != 1) mppt = 1;

            for (let i = 2; i <= mppt; i++) {
                let capv = 'measure_voltage.DC' + i;
                let capi = "measure_current.DC" + i;
                if (!this.hasCapability(capv)) this.addCapability(capv);
                if (!this.hasCapability(capi)) this.addCapability(capi);
            }
            for (let i = mppt + 1; i <= 4; i++) {
                let capv = 'measure_voltage.DC' + i;
                let capi = "measure_current.DC" + i;
                if (this.hasCapability(capv)) this.removeCapability(capv);
                if (this.hasCapability(capi)) this.removeCapability(capi);
            }
        }
    }

    getUpdatePath() {
        return '/solar_api/v1/GetInverterRealtimeData.cgi?';
    }

    getOptionalSuffix() {
        return '&DataCollection=CommonInverterData';
    }

    updateValues(data) {
        //AC Energy in kWh ; default to 0
        if (this.hasCapability('meter_power'))
            this.setCapabilityValue('meter_power', typeof data.DAY_ENERGY == 'undefined' ? 0 : data.DAY_ENERGY.Value / 1000).catch(this.error);
        //AC Energy in kWh ; default to 0
        if (this.hasCapability('meter_power.YEAR'))
            this.setCapabilityValue('meter_power.YEAR', typeof data.YEAR_ENERGY == 'undefined' ? 0 : data.YEAR_ENERGY.Value / 1000).catch(this.error);
        //AC Energy in kWh ; default to 0
        this.setCapabilityValue('meter_power.TOTAL', typeof data.TOTAL_ENERGY == 'undefined' ? 0 : data.TOTAL_ENERGY.Value / 1000).catch(this.error);
        //AC power ; default to 0 
        this.setCapabilityValue('measure_power', typeof data.PAC == 'undefined' ? 0 : data.PAC.Value).catch(this.error);
        //AC current ; default to 0 
        this.setCapabilityValue('measure_current.AC', typeof data.IAC == 'undefined' ? 0 : data.IAC.Value).catch(this.error);
        //AC voltage ; default to 0 
        this.setCapabilityValue('measure_voltage.AC', typeof data.UAC == 'undefined' ? 0 : data.UAC.Value).catch(this.error);
        //DC current ; default to 0 
        this.setCapabilityValue('measure_current.DC', typeof data.IDC == 'undefined' ? 0 : data.IDC.Value).catch(this.error);
        //DC voltage ; default to 0 
        this.setCapabilityValue('measure_voltage.DC', typeof data.UDC == 'undefined' ? 0 : data.UDC.Value).catch(this.error);
        for (let i = 2; i <= this.getSetting('MPPTnumber'); i++) {
            //DC current for MPPT tracker ; default to 0
            if (this.hasCapability('measure_current.DC' + i)) this.setCapabilityValue('measure_current.DC' + i, typeof data['IDC_' + i] == 'undefined' ? 0 : data['IDC_' + i].Value).catch(this.error);
            //DC voltage DC current for MPPT tracker; default to 0
            if (this.hasCapability('measure_voltage.DC' + i)) this.setCapabilityValue('measure_voltage.DC' + i, typeof data['UDC_' + i] == 'undefined' ? 0 : data['UDC_' + i].Value).catch(this.error);
        }
        //AC frequency ; default to 0
        this.setCapabilityValue('measure_frequency', typeof data.FAC == 'undefined' ? 0 : data.FAC.Value).catch(this.error);
    }
}

module.exports = Inverter ;
