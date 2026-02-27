import FroniusDriver from "../../lib/driver.js";

class FroniusSmartmeter extends FroniusDriver {
	getCheckPath() {
		return "/solar_api/v1/GetMeterRealtimeData.cgi?Scope=System";
	}

	getFroniusToDevice() {
		return froniusToDevice;
	}
}

function froniusToDevice(json, ip, DeviceId) {
	const device = {
		name: json.Details.Model,
		settings: {
			ip: ip,
			DeviceId: parseInt(DeviceId, 10),
			threePhase: typeof json.Current_AC_Phase_3 === "number",
			gen24meterbug: typeof json.GRID_FREQUENCY_MEAN_F32 !== "undefined",
		},
		data: {
			id: json.Details.Serial,
		},
		capabilities: [
			"measure_power",
			"measure_current",
			"measure_voltage",
			"measure_frequency",
			"meter_power",
			"meter_power.injected",
		],
	};
	console.log(device);
	return device;
}

export default FroniusSmartmeter;
