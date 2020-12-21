'use strict';

const FroniusDevice = require('../../lib/device.js');

class Inverter extends FroniusDevice {

    getUpdatePath() {
        return '/solar_api/v1/GetInverterRealtimeData.cgi?';
    }

    getOptionalSuffix() {
        return '&DataCollection=CommonInverterData';
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
        //AC current ; default to 0 
        this.setCapabilityValue('measure_current.AC', typeof data.IAC == 'undefined' ? 0 : data.IAC.Value);
        //AC voltage ; default to 0 
        this.setCapabilityValue('measure_voltage.AC', typeof data.UAC == 'undefined' ? 0 : data.UAC.Value);
        //DC current ; default to 0 
        this.setCapabilityValue('measure_current.DC', typeof data.IDC == 'undefined' ? 0 : data.IDC.Value);
        //DC voltage ; default to 0 
        this.setCapabilityValue('measure_voltage.DC', typeof data.UDC == 'undefined' ? 0 : data.UDC.Value);
    }
}

module.exports = Inverter ;
