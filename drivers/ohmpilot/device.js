'use strict';

const FroniusDevice = require('../../lib/device.js');

class OhmPilotDevice extends FroniusDevice {

    getUpdatePath() {
        return '/solar_api/v1/GetOhmPilotRealtimeData.cgi?';
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

module.exports = OhmPilotDevice ;
