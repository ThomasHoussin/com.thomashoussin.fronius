'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const checkPath = '/solar_api/v1/GetMeterRealtimeData.cgi?Scope=System';

class FroniusReporting extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
      this.log('FroniusReporting has been initialized');
  }

    onPair(session) {
        session.setHandler('validate', async function (data) {
            console.log("Validate new connection settings");
            let ip = data.host;

            const validationUrl = `http://${ip}${checkPath}`;
            console.log(validationUrl);

            return fetch(validationUrl)
                .then(checkResponseStatus)
                .then(result => result.json())
                .then(json => json.Body.Data)
                .then(data => {
                    for (var id in data) {
                        if (data.hasOwnProperty(id) && (data[id].Meter_Location_Current == 0 || data[id].Meter_Location_Current == 1)) {
                            //should be the primary meter
                            return parseInt(id,10);
                        }
                    };
                    throw new Error('no primary meter found');
                })
                .then(res => {
                    return res;
                })
                .catch(error => {
                    return error ;
                });
        });
    }
}

module.exports = FroniusReporting;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}