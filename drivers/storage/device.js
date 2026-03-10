import FroniusDevice from "../../lib/device.js";

class StorageDevice extends FroniusDevice {
	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log("Device has been initialized");

		if (!this.hasCapability("battery_charging_state")) {
			console.log(
				`Adding capability battery_charging_state to device ${this.getName()}`,
			);
			this.addCapability("battery_charging_state");
		}

		// Ensure cumulative energy capabilities exist for storage devices
		const energyCapabilities = [
			"meter_power",
			"meter_power.charged",
			"meter_power.discharged",
		];
		for (const cap of energyCapabilities) {
			if (!this.hasCapability(cap)) {
				console.log(
					`Adding capability ${cap} to device ${this.getName()}`,
				);
				this.addCapability(cap);
			}
		}

		// Initialize cumulative energy counters from stored values (lifetime kWh)
		for (const key of energyCapabilities) {
			const storedValue = this.getStoreValue(key);
			const value = typeof storedValue === "number" && storedValue >= 0
				? storedValue
				: 0;
			this.setCapabilityValue(key, value).catch(this.error);
		}

		// Enable device polling
		this.polling = true;
		this.addListener("poll", this.pollDevice);
		this.emit("poll");
	}

	getUpdatePath() {
		return "/solar_api/v1/GetStorageRealtimeData.cgi?";
	}

	updateValues(data) {
		const voltage =
			typeof data.Controller.Voltage_DC === "undefined"
				? 0
				: data.Controller.Voltage_DC;
		const current =
			typeof data.Controller.Current_DC === "undefined"
				? 0
				: data.Controller.Current_DC;

		//Current maximum capacity - removed this is not what's expected in meter / homey app
		//this.setCapabilityValue('meter_power', typeof data.Controller.Capacity_Maximum == 'undefined' ? 0 : data.Controller.Capacity_Maximum / 1000);

		//Voltage DC
		this.setCapabilityValue("measure_voltage", voltage);
		// Charging state
		this.setCapabilityValue(
			"battery_charging_state",
			current > 0 ? "charging" : current < 0 ? "discharging" : "idle",
		);
		//Voltage Current
		this.setCapabilityValue("measure_current", current);
		//temp ; default to 0
		this.setCapabilityValue(
			"measure_temperature",
			typeof data.Controller.Temperature_Cell === "undefined"
				? 0
				: data.Controller.Temperature_Cell,
		);
		//% of charge
		this.setCapabilityValue(
			"measure_battery",
			typeof data.Controller.StateOfCharge_Relative === "undefined"
				? 0
				: data.Controller.StateOfCharge_Relative,
		);

		// power approximation (W)
		const power = voltage * current;
		this.setCapabilityValue("measure_power", power);

		// integrate power over polling interval to get cumulative energy in kWh
		let intervalSeconds = this.getSetting("polling_interval");
		if (typeof intervalSeconds !== "number" || intervalSeconds <= 0) {
			intervalSeconds = 60;
		}

		const absPower = Math.abs(power);
		const deltaKwhTotal = (absPower * intervalSeconds) / 3600 / 1000;
		const deltaKwhImported = power > 0 ? deltaKwhTotal : 0;
		const deltaKwhExported = power < 0 ? deltaKwhTotal : 0;

		const currentTotal =
			typeof this.getStoreValue("meter_power") === "number"
				? this.getStoreValue("meter_power")
				: 0;
		const currentImported =
			typeof this.getStoreValue("meter_power.charged") === "number"
				? this.getStoreValue("meter_power.charged")
				: 0;
		const currentExported =
			typeof this.getStoreValue("meter_power.discharged") === "number"
				? this.getStoreValue("meter_power.discharged")
				: 0;

		const newTotal = Math.max(0, currentTotal + deltaKwhTotal);
		const newImported = Math.max(0, currentImported + deltaKwhImported);
		const newExported = Math.max(0, currentExported + deltaKwhExported);

		this.setStoreValue("meter_power", newTotal).catch(this.error);
		this.setStoreValue("meter_power.charged", newImported).catch(this.error);
		this.setStoreValue("meter_power.discharged", newExported).catch(this.error);

		this.setCapabilityValue("meter_power", newTotal).catch(this.error);
		this.setCapabilityValue("meter_power.charged", newImported).catch(
			this.error,
		);
		this.setCapabilityValue("meter_power.discharged", newExported).catch(
			this.error,
		);
	}
}

export default StorageDevice;
