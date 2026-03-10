import fetch from "node-fetch";
import FroniusDevice from "../../lib/device.js";

class PowerFlow extends FroniusDevice {
	/**
	* onInit is called when the device is initialized.
	*/
	async onInit() {
	   this.log("Device has been initialized");

	   if (!this.hasCapability("fronius_backup_mode")) {
		   console.log(
			   `Adding capability fronius_backup_mode to device ${this.getName()}`,
		   );
		   this.addCapability("fronius_backup_mode");
	   }

	   if (!this.hasCapability("fronius_autonomy")) {
		console.log(
			`Adding capability fronius_autonomy to device ${this.getName()}`,
		);
		this.addCapability("fronius_autonomy");
	}

	if (!this.hasCapability("fronius_self_consumption")) {
		console.log(
			`Adding capability fronius_self_consumption to device ${this.getName()}`,
		);
		this.addCapability("fronius_self_consumption");
	}

	   await super.onInit();
   }

	updateFroniusDevice() {
		const settings = this.getSettings();
		const updatePath = "/solar_api/v1/GetPowerFlowRealtimeData.fcgi";
		const updateUrl = `http://${settings.ip}${updatePath}`;
		console.log(updateUrl);

		fetch(updateUrl)
			.then(FroniusDevice.checkResponseStatus)
			.then((result) => result.json())
			.then((json) => this.updateValues(json.Body.Data.Site))
			.catch((_error) => {
				console.log(
					`Error when updating PowerFlow ${this.getName()} on ${updateUrl}`,
				);
			});
	}

	updateValues(data) {
		const pgrid =
			typeof data.P_Grid === "undefined" || data.P_Grid == null
				? 0
				: data.P_Grid;
		const pakku =
			typeof data.P_Akku === "undefined" || data.P_Akku == null
				? 0
				: data.P_Akku;

		this.setCapabilityValue(
			"measure_power.PV",
			typeof data.P_PV === "undefined" || data.P_PV == null ? 0 : data.P_PV,
		);
		this.setCapabilityValue(
			"measure_power.LOAD",
			typeof data.P_Load === "undefined" || data.P_Load == null
				? 0
				: data.P_Load,
		);
		this.setCapabilityValue("measure_power.GRID", pgrid);
		this.setCapabilityValue("measure_power.AKKU", pakku);

		const relAutonomy =
			typeof data.rel_Autonomy === "undefined" || data.rel_Autonomy == null
				? 0
				: data.rel_Autonomy;
		const relSelfConsumption =
			typeof data.rel_SelfConsumption === "undefined" ||
			data.rel_SelfConsumption == null
				? 0
				: data.rel_SelfConsumption;

		if (this.hasCapability("fronius_autonomy")) {
			this.setCapabilityValue("fronius_autonomy", relAutonomy);
		}

		if (this.hasCapability("fronius_self_consumption")) {
			this.setCapabilityValue(
				"fronius_self_consumption",
				relSelfConsumption,
			);
		}

		/* grid power + Akku power
      IDKW, homey adds power produced by PV in the energy tab (see for example https://github.com/DiedB/Homey-SolarPanels/issues/128)
      by using measure_power = grid power + akku power , the correct value should be displayed in energy tab assuming all PV power is used
      */
		this.setCapabilityValue("measure_power", pgrid + pakku);

		// BackupMode: true = house on backup, false = on grid (GEN24 with battery only)
		if (this.hasCapability("fronius_backup_mode")) {
			const backupMode =
				typeof data.BackupMode === "boolean" ? data.BackupMode : false;
			this.setCapabilityValue("fronius_backup_mode", backupMode).catch(
				this.error,
			);
		}
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		this.log("PowerFlow settings where changed");
		this.setEnergy({ cumulative: newSettings.cumulative });
	}
}

export default PowerFlow;
