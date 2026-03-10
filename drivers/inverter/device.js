import FroniusDevice from "../../lib/device.js";

/** StatusCode mapping from Fronius Solar API 4.6.5 */
const STATUS_CODE_MAP = {
	0: "Startup",
	1: "Startup",
	2: "Startup",
	3: "Startup",
	4: "Startup",
	5: "Startup",
	6: "Startup",
	7: "Running",
	8: "Standby",
	9: "Bootloading",
	10: "Error",
	11: "Idle",
	12: "Ready",
	13: "Sleeping",
	255: "Unknown",
};

function parseStatusCode(code) {
	if (code === undefined || code === null) return "Unknown";
	if (typeof code === "string") return code;
	return STATUS_CODE_MAP[code] ?? "Unknown";
}

function parseErrorCode(code) {
	if (code === undefined || code === null || code === 0) return "No error";
	return `Error ${code}`;
}

class Inverter extends FroniusDevice {
	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log("Device has been initialized");

		//v0.1.5 adds frequency capability in inverter
		//add this new capability if needed
		if (!this.hasCapability("measure_frequency")) {
			console.log(
				`Adding capability measure_frequency to device ${this.getName()}`,
			);
			this.addCapability("measure_frequency");
		}

		if (!this.hasCapability("fronius_inverter_state")) {
			console.log(
				`Adding capability fronius_inverter_state to device ${this.getName()}`,
			);
			this.addCapability("fronius_inverter_state");
		}
		
		if (!this.hasCapability("fronius_error_code")) {
			console.log(
				`Adding capability fronius_error_code to device ${this.getName()}`,
			);
			this.addCapability("fronius_error_code");
		}

		//checking if DT is GEN24 or Tauro
		//remove non-supported capabilities if created with
		if (this.getSetting("DT") === 1) {
			if (this.hasCapability("meter_power")) {
				console.log(
					`Removing capability meter_power from device ${this.getName()}`,
				);
				this.removeCapability("meter_power");
			}
			if (this.hasCapability("meter_power.YEAR")) {
				console.log(
					`Removing capability meter_power.YEAR from device ${this.getName()}`,
				);
				this.removeCapability("meter_power.YEAR");
			}
		}

		let mppt = this.getSetting("MPPTnumber");
		//ignore mppt value if DT is not Tauro or GEN24
		if (this.getSetting("DT") !== 1) mppt = 1;

		for (let i = 2; i <= mppt; i++) {
			const capv = `measure_voltage.DC${i}`;
			const capi = `measure_current.DC${i}`;
			if (!this.hasCapability(capv)) this.addCapability(capv);
			if (!this.hasCapability(capi)) this.addCapability(capi);
		}
		for (let i = mppt + 1; i <= 4; i++) {
			const capv = `measure_voltage.DC${i}`;
			const capi = `measure_current.DC${i}`;
			if (this.hasCapability(capv)) this.removeCapability(capv);
			if (this.hasCapability(capi)) this.removeCapability(capi);
		}

		// Enable device polling
		this.polling = true;
		this.addListener("poll", this.pollDevice);
		this.emit("poll");
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		this.log("Inverter settings where changed");

		if (changedKeys.includes("MPPTnumber") || changedKeys.includes("DT")) {
			let mppt = newSettings.MPPTnumber;
			//ignore mppt value if DT is not Tauro or GEN24
			if (newSettings.DT !== 1) mppt = 1;

			for (let i = 2; i <= mppt; i++) {
				const capv = `measure_voltage.DC${i}`;
				const capi = `measure_current.DC${i}`;
				if (!this.hasCapability(capv)) this.addCapability(capv);
				if (!this.hasCapability(capi)) this.addCapability(capi);
			}
			for (let i = mppt + 1; i <= 4; i++) {
				const capv = `measure_voltage.DC${i}`;
				const capi = `measure_current.DC${i}`;
				if (this.hasCapability(capv)) this.removeCapability(capv);
				if (this.hasCapability(capi)) this.removeCapability(capi);
			}
		}
	}

	getUpdatePath() {
		return "/solar_api/v1/GetInverterRealtimeData.cgi?";
	}

	getOptionalSuffix() {
		return "&DataCollection=CommonInverterData";
	}

	updateValues(data) {
		//AC Energy in kWh ; default to 0
		if (this.hasCapability("meter_power"))
			this.setCapabilityValue(
				"meter_power",
				typeof data.DAY_ENERGY === "undefined"
					? 0
					: data.DAY_ENERGY.Value / 1000,
			).catch(this.error);
		//AC Energy in kWh ; default to 0
		if (this.hasCapability("meter_power.YEAR"))
			this.setCapabilityValue(
				"meter_power.YEAR",
				typeof data.YEAR_ENERGY === "undefined"
					? 0
					: data.YEAR_ENERGY.Value / 1000,
			).catch(this.error);
		//AC Energy in kWh ; default to 0
		this.setCapabilityValue(
			"meter_power.TOTAL",
			typeof data.TOTAL_ENERGY === "undefined"
				? 0
				: data.TOTAL_ENERGY.Value / 1000,
		).catch(this.error);
		//AC power ; default to 0
		this.setCapabilityValue(
			"measure_power",
			typeof data.PAC === "undefined" ? 0 : data.PAC.Value,
		).catch(this.error);
		//AC current ; default to 0
		this.setCapabilityValue(
			"measure_current.AC",
			typeof data.IAC === "undefined" ? 0 : data.IAC.Value,
		).catch(this.error);
		//AC voltage ; default to 0
		this.setCapabilityValue(
			"measure_voltage.AC",
			typeof data.UAC === "undefined" ? 0 : data.UAC.Value,
		).catch(this.error);
		//DC current ; default to 0
		this.setCapabilityValue(
			"measure_current.DC",
			typeof data.IDC === "undefined" ? 0 : data.IDC.Value,
		).catch(this.error);
		//DC voltage ; default to 0
		this.setCapabilityValue(
			"measure_voltage.DC",
			typeof data.UDC === "undefined" ? 0 : data.UDC.Value,
		).catch(this.error);
		for (let i = 2; i <= this.getSetting("MPPTnumber"); i++) {
			//DC current for MPPT tracker ; default to 0
			if (this.hasCapability(`measure_current.DC${i}`))
				this.setCapabilityValue(
					`measure_current.DC${i}`,
					typeof data[`IDC_${i}`] === "undefined" ? 0 : data[`IDC_${i}`].Value,
				).catch(this.error);
			//DC voltage DC current for MPPT tracker; default to 0
			if (this.hasCapability(`measure_voltage.DC${i}`))
				this.setCapabilityValue(
					`measure_voltage.DC${i}`,
					typeof data[`UDC_${i}`] === "undefined" ? 0 : data[`UDC_${i}`].Value,
				).catch(this.error);
		}
		//AC frequency ; default to 0
		this.setCapabilityValue(
			"measure_frequency",
			typeof data.FAC === "undefined" ? 0 : data.FAC.Value,
		).catch(this.error);
		//DeviceStatus: human-readable inverter state and error
		const status = data.DeviceStatus;
		if (status && this.hasCapability("fronius_inverter_state")) {
			const stateText =
				typeof status.InverterState === "string"
					? status.InverterState
					: parseStatusCode(status.StatusCode);
			this.setCapabilityValue("fronius_inverter_state", stateText).catch(
				this.error,
			);
		}
		if (status && this.hasCapability("fronius_error_code")) {
			const errorText = parseErrorCode(status.ErrorCode);
			this.setCapabilityValue("fronius_error_code", errorText).catch(
				this.error,
			);
		}
	}
}

export default Inverter;
