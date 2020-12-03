'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const cron = require('node-cron');

const updateArchivePath = '/solar_api/v1/GetArchiveData.cgi';

const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class Performance extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('Performance has been initialized');

      //get inverters list
      let ip = this.getSetting('ip');

      const updateUrl = `http://${ip}/solar_api/v1/GetInverterInfo.cgi`;
      await fetch(updateUrl)
          .then(checkResponseStatus)
          .then(result => result.json())
          .then(json => Object.keys(json.Body.Data))
          .then(inverters => {
              this.inverters = inverters;
              console.log(inverters);
          })
          .catch(error => {
              console.log('Error fetching inverters list');
          });

      this.polling = true;
      this.addListener('poll', this.pollDevice);
      this.addListener('everyday', this.everyday);
      this.addListener('everymonth', this.everymonth);
      this.addListener('updateCapabilities', this.updateCapabilities);

      //everyday except 1st day of the mont
      this.dailycron = cron.schedule('0 0 2-31 * *', () => {
          this.emit('everyday');
      });

      //every month
      this.monthlycron = cron.schedule('0 0 1 * *', () => {
          this.emit('everymonth');
      });

      // Enable device polling
      this.emit('poll');
  }

    async pollDevice() {
        while (this.polling) {
            console.log(`Updating Performance ${this.getName()}`);
            this.updateData();
            await delay(this.getSetting('polling_interval'));
        }
    }

    async everyday() {
        console.log(`Running everyday task for ${this.getName()}`);
        this.setStoreValue("meter_power.toGrid.month", this.getStoreValue("meter_power.toGrid.month") + this.getStoreValue("meter_power.toGrid.today"))
            .then(this.setStoreValue("meter_power.toGrid.today", 0));
        this.setStoreValue("meter_power.fromGrid.month", this.getStoreValue("meter_power.fromGrid.month") + this.getStoreValue("meter_power.fromGrid.today"))
            .then(this.setStoreValue("meter_power.fromGrid.today", 0));
        this.setStoreValue("meter_power.produced.month", this.getStoreValue("meter_power.produced.month") + this.getStoreValue("meter_power.produced.today"))
            .then(this.setStoreValue("meter_power.produced.today", 0));
  
    }

    async everymonth() {
        console.log(`Running everymonth task for ${this.getName()}`);
        await this.everyday();
        await this.setStoreValue("meter_power.fromGrid.previousmonth", this.getStoreValue("meter_power.toGrid.month"));

        this.setStoreValue("meter_power.toGrid.month", 0);
        this.setStoreValue("meter_power.fromGrid.month", 0);
        this.setStoreValue("meter_power.produced.month", 0);
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('Performance has been added');
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
      this.log('Performance settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('Performance was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('Performance has been deleted');
      this.polling = false;
      this.dailycron.destroy();
      this.monthlycron.destroy();
  }

    updateData() {
        let settings = this.getSettings();

        let producedPower = -1;
        let fromGridPower = -1;
        let toGridPower = -1;

        let today = new Date();
        let yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const end = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
        const begin = `${yesterday.getDate()}.${yesterday.getMonth() + 1}.${yesterday.getFullYear()}`;

        let invertersString = '';
        for (let inv in this.inverters) {
            invertersString += `DeviceId=${this.inverters[inv]}&`;
        }

        const updateUrlInv = `http://${settings.ip}${updateArchivePath}?Scope=Device&DeviceClass=Inverter&${invertersString}Channel=EnergyReal_WAC_Sum_Produced&StartDate=${begin}&EndDate=${end}&SeriesType=DailySum`;
        console.log(updateUrlInv);

        fetch(updateUrlInv)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => Object.values(json.Body.Data))
            .then(array => {
                let total = 0;
                for (let val in array) {
                    console.log(array[val].Data.EnergyReal_WAC_Sum_Produced);
                    total += ((typeof array[val].Data.EnergyReal_WAC_Sum_Produced == 'undefined' || array[val].Data.EnergyReal_WAC_Sum_Produced == null) ? 0 : array[val].Data.EnergyReal_WAC_Sum_Produced.Values['86400'] / 1000);
                }
                return total;
            })
            .then(power => {
                this.setStoreValue("meter_power.produced.today", power)
                    .then(value => this.emit('updateCapabilities'))
                    .catch(error => {
                        console.log(`Error when saving value produced`);
                    });
            })
            .catch(error => {
                console.log(`Error when updating EnergyReal_WAC_Sum_Produced in data ${this.getName()} on ${updateUrlInv}`);
            });
        
        const updateUrlMeter = `http://${settings.ip}${updateArchivePath}?Scope=Device&DeviceClass=meter&DeviceId=${settings.DeviceId}&Channel=EnergyReal_WAC_Plus_Absolute&Channel=EnergyReal_WAC_Minus_Absolute&StartDate=${begin}&EndDate=${end}&SeriesType=DailySum`;
        console.log(updateUrlMeter);

        fetch(updateUrlMeter)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => Object.values(json.Body.Data)[0].Data)
            .then(data => {
                toGridPower = (typeof data.EnergyReal_WAC_Minus_Absolute == 'undefined' || data.EnergyReal_WAC_Minus_Absolute == null) ? 0 : data.EnergyReal_WAC_Minus_Absolute.Values['86400'] / 1000;
                fromGridPower = (typeof data.EnergyReal_WAC_Plus_Absolute == 'undefined' || data.EnergyReal_WAC_Plus_Absolute == null) ? 0 : data.EnergyReal_WAC_Plus_Absolute.Values['86400'] / 1000;

                this.setStoreValue("meter_power.fromGrid.today", fromGridPower)
                    .then(value => this.setStoreValue("meter_power.toGrid.today", toGridPower))
                    .then(value => this.emit('updateCapabilities'))
                    .catch(error => {
                        console.log(`Error when saving value fromgrid / togrid`);
                    });
            })
            .catch(error => {
                console.log(`Error when updating from Grid / to grid power in data ${this.getName()} on ${updateUrlMeter}`);
            });


    }

    async updateCapabilities() {
        let settings = this.getSettings();
        let toGridPower = this.getStoreValue("meter_power.toGrid.today");
        let fromGridPower = this.getStoreValue("meter_power.fromGrid.today");
        let producedPower = this.getStoreValue("meter_power.produced.today");

        this.setCapabilityValue('meter_power.toGrid', toGridPower);
        this.setCapabilityValue('meter_power.fromGrid', fromGridPower);
        this.setCapabilityValue('meter_power.produced', producedPower);
        this.setCapabilityValue('spending.day', fromGridPower * settings.purchaseprice);
        this.setCapabilityValue('savings.day', toGridPower * settings.sellprice + (producedPower - toGridPower) * settings.purchaseprice);

        let toGridPowerMonth = this.getStoreValue("meter_power.toGrid.month");
        let fromGridPowerMonth = this.getStoreValue("meter_power.fromGrid.month");
        let producedPowerMonth = this.getStoreValue("meter_power.produced.month");
        this.setCapabilityValue('spending.month', fromGridPowerMonth * settings.purchaseprice);
        this.setCapabilityValue('savings.month', toGridPowerMonth * settings.sellprice + (producedPowerMonth - toGridPowerMonth) * settings.purchaseprice);

        let fromGridPowerPreviousMonth = this.getStoreValue("meter_power.fromGrid.previousmonth");
        this.setCapabilityValue('spending.previousmonth', fromGridPowerPreviousMonth * settings.purchaseprice );
    }
}

module.exports = Performance ;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
