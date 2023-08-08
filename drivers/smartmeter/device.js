'use strict';

const FroniusDevice = require('../../lib/device.js');

class Smartmeter extends FroniusDevice {

    async onInit() {
        this.log('Smartmeter has been initialized');

        //checking if adding 3-phase capability is needed
        if (this.getSetting('threePhase')) {
            if (!this.hasCapability('measure_current.phase1')) {
                console.log(`Adding capability measure_current.phase1 to device ${this.getName()}`);
                this.addCapability('measure_current.phase1');
            }

            if (!this.hasCapability('measure_current.phase2')) {
                console.log(`Adding capability measure_current.phase2 to device ${this.getName()}`);
                this.addCapability('measure_current.phase2');
            }

            if (!this.hasCapability('measure_current.phase3')) {
                console.log(`Adding capability measure_current.phase3 to device ${this.getName()}`);
                this.addCapability('measure_current.phase3');
            }
        }

        // Enable device polling
        this.polling = true;
        this.addListener('poll', this.pollDevice);
        this.emit('poll');
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.log('Smartmeter settings where changed');

        //v0.1.3 introduced 3-phase capability
        //we check if this capability is needed and add it if necessary
        console.log(newSettings.threePhase);

        if (newSettings.threePhase) {
            if (!this.hasCapability('measure_current.phase1')) {
                console.log(`Adding capability measure_current.phase1 to device ${this.getName()}`);
                this.addCapability('measure_current.phase1');
            }

            if (!this.hasCapability('measure_current.phase2')) {
                console.log(`Adding capability measure_current.phase2 to device ${this.getName()}`);
                this.addCapability('measure_current.phase2');
            }

            if (!this.hasCapability('measure_current.phase3')) {
                console.log(`Adding capability measure_current.phase3 to device ${this.getName()}`);
                this.addCapability('measure_current.phase3');
            }
        }
        else {
            if (this.hasCapability('measure_current.phase1')) {
                console.log(`Removing capability measure_current.phase1 to device ${this.getName()}`);
                this.removeCapability('measure_current.phase1');
            }

            if (this.hasCapability('measure_current.phase2')) {
                console.log(`Removing capability measure_current.phase2 to device ${this.getName()}`);
                this.removeCapability('measure_current.phase2');
            }

            if (this.hasCapability('measure_current.phase3')) {
                console.log(`Removing capability measure_current.phase3 to device ${this.getName()}`);
                this.removeCapability('measure_current.phase3');
            }
        }

        this.setEnergy({ cumulative: newSettings.cumulative })
            .then(this.updateFroniusDevice());
    }

    getUpdatePath() {
        return '/solar_api/v1/GetMeterRealtimeData.cgi?';
    }

    updateValues(data) {
        if (!this.getSetting('gen24meterbug')) {
            //Consumed Energy in kWh ; default to 0 ; should be given by EnergyReal_WAC_Plus_Absolute
            this.setCapabilityValue('meter_power', typeof data.EnergyReal_WAC_Plus_Absolute == 'undefined' ? 0 : data.EnergyReal_WAC_Plus_Absolute / 1000);
            //Injected energy ; EnergyReal_WAC_Minus_Absolute
            this.setCapabilityValue('meter_power.injected', typeof data.EnergyReal_WAC_Minus_Absolute == 'undefined' ? 0 : data.EnergyReal_WAC_Minus_Absolute / 1000);

            //power, in W ; default to 0 
            this.setCapabilityValue('measure_power', typeof data.PowerReal_P_Sum == 'undefined' ? 0 : data.PowerReal_P_Sum);

            //Current, in A ; default to 0 
            let current = 0;
            if (typeof data.Current_AC_Sum == 'number') current = data.Current_AC_Sum;
            else if (typeof data.Current_AC_Phase_1 == 'number' && typeof data.Current_AC_Phase_2 == 'number' && typeof data.Current_AC_Phase_3 == 'number') current = data.Current_AC_Phase_1 + data.Current_AC_Phase_2 + data.Current_AC_Phase_3;
            this.setCapabilityValue('measure_current', current);

            if (this.hasCapability('measure_current.phase1')) {
                if (typeof data.Current_AC_Phase_1 == 'number') this.setCapabilityValue('measure_current.phase1', data.Current_AC_Phase_1);
            }

            if (this.hasCapability('measure_current.phase2')) {
                if (typeof data.Current_AC_Phase_2 == 'number') this.setCapabilityValue('measure_current.phase2', data.Current_AC_Phase_2);
            }

            if (this.hasCapability('measure_current.phase3')) {
                if (typeof data.Current_AC_Phase_3 == 'number') this.setCapabilityValue('measure_current.phase3', data.Current_AC_Phase_3);
            }

            //Voltage, in V ; default to 0 
            let voltage = 0;
            if (typeof data.Voltage_AC_Phase_Average == 'number') voltage = data.Voltage_AC_Phase_Average;
            else if (typeof data.Voltage_AC_Phase_1 == 'number' && data.Voltage_AC_Phase_2 == 'number' && data.Voltage_AC_Phase_3 == 'number') voltage = (data.Voltage_AC_Phase_1 + data.Voltage_AC_Phase_2 + data.Voltage_AC_Phase_3) / 3;
            else if (typeof data.Voltage_AC_Phase_1 == 'number') voltage = data.Voltage_AC_Phase_1;
            this.setCapabilityValue('measure_voltage', voltage);

            //Phase frequency, in Hz ; default to 0
            this.setCapabilityValue('measure_frequency', typeof data.Frequency_Phase_Average == 'undefined' ? 0 : data.Frequency_Phase_Average);
        } else {
            //workaround for strange field values in some GEN24 firmware

            //Consumed Energy in kWh ; default to 0 ; should be given by EnergyReal_WAC_Plus_Absolute
            this.setCapabilityValue('meter_power', typeof data.SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64 == 'undefined' ? 0 : data.SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64 / 1000);
            //Injected energy ; EnergyReal_WAC_Minus_Absolute
            this.setCapabilityValue('meter_power.injected', typeof data.SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64 == 'undefined' ? 0 : data.SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64 / 1000);

            //power, in W ; default to 0 
            this.setCapabilityValue('measure_power', typeof data.SMARTMETER_POWERACTIVE_MEAN_SUM_F64 == 'undefined' ? 0 : data.SMARTMETER_POWERACTIVE_MEAN_SUM_F64);

            //Phase frequency, in Hz ; default to 0
            this.setCapabilityValue('measure_frequency', typeof data.GRID_FREQUENCY_MEAN_F32 == 'undefined' ? 0 : data.GRID_FREQUENCY_MEAN_F32);

            //loop to compute three-phase and missing values
            let current_total = 0;
            let voltage_total = 0;
            let phase_number = 0; 
            for (let i = 1; i <= 3; i++) {
                if (typeof data[`SMARTMETER_VOLTAGE_MEAN_0${i}_F64`] == 'undefined') continue;

                phase_number++;
                let power = data[`SMARTMETER_POWERACTIVE_MEAN_0${i}_F64`];
                let voltage = data[`SMARTMETER_VOLTAGE_MEAN_0${i}_F64`];
                let current = power / voltage;
                voltage_total += voltage;
                current_total += current;
            }
            let voltage_mean = voltage_total / phase_number;

            this.setCapabilityValue('measure_current', current_total);
            this.setCapabilityValue('measure_voltage', voltage_mean);
            }    
    }

}

module.exports = Smartmeter ;
