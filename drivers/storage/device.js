'use strict';

const FroniusDevice = require('../../lib/device.js');

class StorageDevice extends FroniusDevice {

    getUpdatePath() {
        return '/solar_api/v1/GetStorageRealtimeData.cgi?';
    }

    updateValues(data) {
        let voltage = typeof data.Controller.Voltage_DC == 'undefined' ? 0 : data.Controller.Voltage_DC;
        let current = typeof data.Controller.Current_DC == 'undefined' ? 0 : data.Controller.Current_DC;

        //Current maximum capacity
        this.setCapabilityValue('meter_power', typeof data.Controller.Capacity_Maximum == 'undefined' ? 0 : data.Controller.Capacity_Maximum / 1000);
        //Voltage DC
        this.setCapabilityValue('measure_voltage', voltage );
        //Voltage Current
        this.setCapabilityValue('measure_current', current);
        //temp ; default to 0 
        this.setCapabilityValue('measure_temperature', typeof data.Controller.Temperature_Cell == 'undefined' ? 0 : data.Controller.Temperature_Cell);
        //% of charge
        this.setCapabilityValue('measure_battery', typeof data.Controller.StateOfCharge_Relative == 'undefined' ? 0 : data.Controller.StateOfCharge_Relative);
        //power approximation
        this.setCapabilityValue('measure_power', - voltage * current);
    }
}

module.exports = StorageDevice;

