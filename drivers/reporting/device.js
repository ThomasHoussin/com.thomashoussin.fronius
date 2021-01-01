'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const cron = require('node-cron');

const updateArchivePath = '/solar_api/v1/GetArchiveData.cgi';

const delay = s => new Promise(resolve => setTimeout(resolve, 1000 * s));

class Reporting extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('Reporting has been initialized');

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
      this.registerCapabilityListener('button.recoverHistory', async () => {
          this.recoverHistory() ;
          return;
      });
      this.registerCapabilityListener('button.resetHistory', async () => {
          // Maintenance action button was pressed, return a promise
          this.resetHistory();
          return;
      });

      //everyday except 1st day of the month
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
            console.log(`Updating Reporting ${this.getName()}`);
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
        await this.setStoreValue("meter_power.fromGrid.previousmonth", this.getStoreValue("meter_power.fromGrid.month") + this.getStoreValue("meter_power.fromGrid.today"));
        this.setStoreValue("meter_power.toGrid.today", 0);
        this.setStoreValue("meter_power.produced.today", 0);
        this.setStoreValue("meter_power.fromGrid.today", 0);
        this.setStoreValue("meter_power.toGrid.month", 0);
        this.setStoreValue("meter_power.fromGrid.month", 0);
        this.setStoreValue("meter_power.produced.month", 0);
    }

    async resetHistory() {
        await this.setStoreValue("meter_power.toGrid.month", 0);
        await this.setStoreValue("meter_power.fromGrid.month", 0);
        await this.setStoreValue("meter_power.produced.month", 0);
        await this.setStoreValue("meter_power.fromgrid.previousmonth", 0);
        this.emit('updateCapabilities');
    }

    async getArchiveProduced(beginDate, endDate) {
        let producedPower = 0;

        const begin = `${beginDate.getDate()}.${beginDate.getMonth() + 1}.${beginDate.getFullYear()}`;
        const end = `${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()}`;

        let invertersString = '';
        for (let inv in this.inverters) {
            invertersString += `DeviceId=${this.inverters[inv]}&`;
        }

        const updateUrlInv = `http://${this.getSetting('ip')}${updateArchivePath}?Scope=Device&DeviceClass=Inverter&${invertersString}Channel=EnergyReal_WAC_Sum_Produced&StartDate=${begin}&EndDate=${end}&SeriesType=DailySum`;
        console.log(updateUrlInv);

        return fetch(updateUrlInv)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => Object.values(json.Body.Data))
            .then(array => {
                for (let val in array) {
                    //total += ((typeof array[val].Data.EnergyReal_WAC_Sum_Produced == 'undefined' || array[val].Data.EnergyReal_WAC_Sum_Produced == null) ? 0 : array[val].Data.EnergyReal_WAC_Sum_Produced.Values['86400'] / 1000);
                    if ((typeof array[val].Data.EnergyReal_WAC_Sum_Produced != 'undefined' && array[val].Data.EnergyReal_WAC_Sum_Produced != null)) {
                        for (let realData of Object.values(array[val].Data.EnergyReal_WAC_Sum_Produced.Values)) {
                            producedPower += realData / 1000;
                        }
                    }
                }
                return producedPower;
            })
            .catch(error => {
                console.log(`Error when recovering EnergyReal_WAC_Sum_Produced in data ${this.getName()} on ${updateUrlInv}`);
            });
    }

    async getArchiveMeter(beginDate, endDate) {
        let fromGridPower = 0;
        let toGridPower = 0;

        let numday = (endDate.getTime() - beginDate.getTime()) / (3600 * 24 * 1000);
        //Fronius does not support more than 15 days 
        if (numday > 15) {
            let middleDate = new Date(endDate.getTime() - 15 * 24 * 3600 * 1000);
            let middleDateM = new Date(endDate.getTime() - 14 * 24 * 3600 * 1000);            
            let obj = this.getArchiveMeter(beginDate, middleDate);
            let obj2 = this.getArchiveMeter(middleDateM, endDate);
            //réécrire avec Promise.all
            return Promise.all([obj, obj2])
                .then(values => {
                    return { toGridPower: values[0].toGridPower + values[1].toGridPower, fromGridPower: values[0].fromGridPower + values[1].fromGridPower };
                })
        }

        const begin = `${beginDate.getDate()}.${beginDate.getMonth() + 1}.${beginDate.getFullYear()}`;
        const end = `${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()}`;

        const updateUrlMeter = `http://${this.getSetting('ip')}${updateArchivePath}?Scope=Device&DeviceClass=meter&DeviceId=${this.getSetting('DeviceId')}&Channel=EnergyReal_WAC_Plus_Absolute&Channel=EnergyReal_WAC_Minus_Absolute&StartDate=${begin}&EndDate=${end}&SeriesType=DailySum`;
        console.log(updateUrlMeter);

        return fetch(updateUrlMeter)
            .then(checkResponseStatus)
            .then(result => result.json())
            .then(json => Object.values(json.Body.Data)[0].Data)
            .then(data => {
                if (typeof data.EnergyReal_WAC_Minus_Absolute != 'undefined' && data.EnergyReal_WAC_Minus_Absolute != null) {
                    for (let val of Object.values(data.EnergyReal_WAC_Minus_Absolute.Values)) {
                        toGridPower += val / 1000;
                    }
                }

                if (typeof data.EnergyReal_WAC_Plus_Absolute != 'undefined' && data.EnergyReal_WAC_Plus_Absolute != null) {
                    for (let val of Object.values(data.EnergyReal_WAC_Plus_Absolute.Values)) {
                        fromGridPower += val / 1000;
                    }
                }
                return { toGridPower: toGridPower, fromGridPower: fromGridPower };
            })
            .catch(error => {
                console.log(`Error when recovering from Grid / to grid power in data ${this.getName()} on ${updateUrlMeter}`);
            });
    }

    async recoverHistory() {
        await this.resetHistory();

        let today = new Date();
        let yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        let firstDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
        let firstDayPreviousMonth, lastDayPreviousMonth ;

        if (today.getDate() == 1) {
            //first day of the month
            firstDayPreviousMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
            lastDayPreviousMonth = yesterday;
        }
        else {
            firstDayPreviousMonth = new Date(yesterday.getFullYear(), yesterday.getMonth() - 1, 1);
            lastDayPreviousMonth = new Date(yesterday.getFullYear(), yesterday.getMonth(), 0);
        }

        //if we are the first day of the month, history for current month is 0
        if (today.getDate() != 1) {
            //produced power for current month
            this.getArchiveProduced(firstDay, yesterday)
                .then(power => {
                    this.setStoreValue("meter_power.produced.month", power)
                        .then(value => this.emit('updateCapabilities'))
                        .catch(error => {
                            console.log(`Error when saving value produced : ${error}`);
                        });
                })
                .catch(error => {
                    console.log(`Error in recoverHistory for production : ${error}`);
                });

            //fromgrid / togrid power for current month
            this.getArchiveMeter(firstDay, yesterday)
                .then(obj => {
                    this.setStoreValue("meter_power.fromGrid.month", obj.fromGridPower)
                        .then(value => this.setStoreValue("meter_power.toGrid.month", obj.toGridPower))
                        .then(value => this.emit('updateCapabilities'))
                        .catch(error => {
                            console.log(`Error when saving value fromgrid / togrid  : ${error}`);
                        });
                })
                .catch(error => {
                    console.log(`Error in recoverHistory for meter : ${error}`);
                });
        }
        
        //from grid for previous month
        this.getArchiveMeter(firstDayPreviousMonth, lastDayPreviousMonth)
            .then(obj => {
                console.log(obj);
                this.setStoreValue("meter_power.fromGrid.previousmonth", obj.fromGridPower)
                    .then(value => this.emit('updateCapabilities'))
                    .catch(error => {
                        console.log(`Error when saving value for previous month  : ${error}`);
                    });
            })
            .catch(error => {
                console.log(`Error in recoverHistory for meter  : ${error}`);
            });
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('Reporting has been added');
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
      this.log('Reporting settings where changed');
      this.emit('updateCapabilities');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
      this.log('Reporting was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
      this.log('Reporting has been deleted');
      this.polling = false;
      this.dailycron.destroy();
      this.monthlycron.destroy();
  }

    async updateData() {
        let today = new Date();
               
        this.getArchiveProduced(today, today)
            .then(power => {
                this.setStoreValue("meter_power.produced.today", power)
                    .then(value => this.emit('updateCapabilities'))
                    .catch(error => {
                        console.log(`Error when saving value produced : ${error}`);
                    });
            })
            .then(() => this.emit('updateCapabilities'))
            .catch(error => {
                console.log(`Error in recoverHistory for production : ${error}`);
            });

        this.getArchiveMeter(today, today)
            .then(obj => {
                console.log(obj);
                this.setStoreValue("meter_power.fromGrid.today", obj.fromGridPower)
                    .then(value => this.setStoreValue("meter_power.toGrid.today", obj.toGridPower))
                    .then(value => this.emit('updateCapabilities'))
                    .catch(error => {
                        console.log(`Error when saving value fromgrid / togrid : ${error}`);
                    });
            })
            .then(() => this.emit('updateCapabilities'))
            .catch(error => {
                console.log(`Error in updateData : ${error}`);
            });
    }

    async updateCapabilities() {
        let settings = this.getSettings();
        let toGridPower = this.getStoreValue("meter_power.toGrid.today");
        let fromGridPower = this.getStoreValue("meter_power.fromGrid.today");
        let producedPower = this.getStoreValue("meter_power.produced.today");
        let toGridPowerMonth = this.getStoreValue("meter_power.toGrid.month");
        let fromGridPowerMonth = this.getStoreValue("meter_power.fromGrid.month");
        let producedPowerMonth = this.getStoreValue("meter_power.produced.month");

        this.setCapabilityValue('meter_power.toGrid', toGridPower);
        this.setCapabilityValue('meter_power.fromGrid', fromGridPower);
        this.setCapabilityValue('meter_power.produced', producedPower);
        this.setCapabilityValue('selfconsumption', (producedPower - toGridPower) / producedPower * 100) ;
        this.setCapabilityValue('selfconsumption.month', (producedPowerMonth - toGridPowerMonth) / producedPowerMonth * 100) ;

        this.setCapabilityValue('spending.day', fromGridPower * settings.purchaseprice);
        this.setCapabilityValue('savings.day', toGridPower * settings.sellprice + (producedPower - toGridPower) * settings.purchaseprice);

        this.setCapabilityValue('spending.month', fromGridPowerMonth * settings.purchaseprice + fromGridPower * settings.purchaseprice);
        this.setCapabilityValue('savings.month', toGridPowerMonth * settings.sellprice + (producedPowerMonth - toGridPowerMonth) * settings.purchaseprice +
                                                    toGridPower * settings.sellprice + (producedPower - toGridPower) * settings.purchaseprice);
        let fromGridPowerPreviousMonth = this.getStoreValue("meter_power.fromGrid.previousmonth");
        this.setCapabilityValue('spending.previousmonth', fromGridPowerPreviousMonth * settings.purchaseprice );
    }
}

module.exports = Reporting ;

function checkResponseStatus(res) {
    if (res.ok) {
        return res
    } else {
        console.log(`Wrong response status : ${res.status} (${res.statusText})`);
        throw new Error(`Wrong response status : ${res.status} (${res.statusText})`);
    }
}
