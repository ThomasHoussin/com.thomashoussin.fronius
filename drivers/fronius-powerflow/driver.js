'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

const checkPath = '/solar_api/v1/GetPowerFlowRealtimeData.fcgi';

class FroniusPowerFlow extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
      this.log('FroniusPowerFlow has been initialized');
  }

    onPair(session) {
        session.setHandler('validate', async function (data) {
            console.log("Validate new connection settings");
            let ip = data.host;

            const validationUrl = `http://${ip}${checkPath}`;
            console.log(validationUrl);

            return fetch(validationUrl)
                .then(checkResponseStatus)
                .then(res => {
                    return 'ok';
                })
                .catch(error => {
                    return error;
                });
        });
    }
}

module.exports = FroniusPowerFlow;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}