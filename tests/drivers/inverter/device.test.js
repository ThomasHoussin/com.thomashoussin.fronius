import { beforeEach, describe, expect, it, vi } from "vitest";
import Inverter from "../../../drivers/inverter/device.js";

/**
 * Test wrapper for Inverter
 */
class TestInverter extends Inverter {
	constructor() {
		super();
		this._capabilities = new Set([
			"measure_power",
			"meter_power",
			"meter_power.YEAR",
			"meter_power.TOTAL",
			"measure_current.AC",
			"measure_current.DC",
			"measure_voltage.AC",
			"measure_voltage.DC",
			"measure_frequency",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 1,
			DT: 0, // Classic inverter by default
			MPPTnumber: 1,
			polling_interval: 300,
		};
		this._listeners = new Map();
		this.polling = false;
	}

	// Mock Homey.Device methods
	hasCapability(cap) {
		return this._capabilities.has(cap);
	}
	addCapability(cap) {
		this._capabilities.add(cap);
		return Promise.resolve();
	}
	removeCapability(cap) {
		this._capabilities.delete(cap);
		return Promise.resolve();
	}
	setCapabilityValue(cap, value) {
		this._capabilityValues.set(cap, value);
		return Promise.resolve();
	}
	getCapabilityValue(cap) {
		return this._capabilityValues.get(cap);
	}
	getSetting(key) {
		return this._settings[key];
	}
	getSettings() {
		return this._settings;
	}
	getName() {
		return "Test Inverter";
	}
	log() {}
	error() {}
	addListener(event, handler) {
		if (!this._listeners.has(event)) {
			this._listeners.set(event, []);
		}
		this._listeners.get(event).push(handler);
	}
	emit(event, ...args) {
		const handlers = this._listeners.get(event) || [];
		for (const h of handlers) {
			h.call(this, ...args);
		}
	}
}

describe("Inverter", () => {
	let device;

	beforeEach(() => {
		device = new TestInverter();
	});

	describe("getUpdatePath", () => {
		it("should return correct API path", () => {
			expect(device.getUpdatePath()).toBe(
				"/solar_api/v1/GetInverterRealtimeData.cgi?",
			);
		});
	});

	describe("getOptionalSuffix", () => {
		it("should return CommonInverterData suffix", () => {
			expect(device.getOptionalSuffix()).toBe(
				"&DataCollection=CommonInverterData",
			);
		});
	});

	describe("onInit - Classic Inverter (DT=0)", () => {
		beforeEach(() => {
			device._settings.DT = 0;
			device._settings.MPPTnumber = 1;
			device.pollDevice = vi.fn();
		});

		it("should add measure_frequency if missing", async () => {
			device._capabilities.delete("measure_frequency");

			await device.onInit();

			expect(device.hasCapability("measure_frequency")).toBe(true);
		});

		it("should keep meter_power for classic inverter", async () => {
			await device.onInit();

			expect(device.hasCapability("meter_power")).toBe(true);
			expect(device.hasCapability("meter_power.YEAR")).toBe(true);
		});

		it("should NOT add MPPT capabilities for single tracker", async () => {
			await device.onInit();

			expect(device.hasCapability("measure_voltage.DC2")).toBe(false);
			expect(device.hasCapability("measure_current.DC2")).toBe(false);
		});

		it("should ignore MPPTnumber > 1 for classic inverter", async () => {
			device._settings.MPPTnumber = 4;

			await device.onInit();

			// Should still not add MPPT capabilities because DT=0
			expect(device.hasCapability("measure_voltage.DC2")).toBe(false);
			expect(device.hasCapability("measure_current.DC2")).toBe(false);
		});

		it("should enable polling", async () => {
			await device.onInit();

			expect(device.polling).toBe(true);
		});
	});

	describe("onInit - GEN24 Inverter (DT=1)", () => {
		beforeEach(() => {
			device._settings.DT = 1;
			device.pollDevice = vi.fn();
		});

		it("should remove meter_power capability", async () => {
			await device.onInit();

			expect(device.hasCapability("meter_power")).toBe(false);
		});

		it("should remove meter_power.YEAR capability", async () => {
			await device.onInit();

			expect(device.hasCapability("meter_power.YEAR")).toBe(false);
		});

		it("should add MPPT 2 capabilities for MPPTnumber=2", async () => {
			device._settings.MPPTnumber = 2;

			await device.onInit();

			expect(device.hasCapability("measure_voltage.DC2")).toBe(true);
			expect(device.hasCapability("measure_current.DC2")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(false);
			expect(device.hasCapability("measure_current.DC3")).toBe(false);
		});

		it("should add MPPT 2-3 capabilities for MPPTnumber=3", async () => {
			device._settings.MPPTnumber = 3;

			await device.onInit();

			expect(device.hasCapability("measure_voltage.DC2")).toBe(true);
			expect(device.hasCapability("measure_current.DC2")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(true);
			expect(device.hasCapability("measure_current.DC3")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC4")).toBe(false);
		});

		it("should add MPPT 2-4 capabilities for MPPTnumber=4", async () => {
			device._settings.MPPTnumber = 4;

			await device.onInit();

			expect(device.hasCapability("measure_voltage.DC2")).toBe(true);
			expect(device.hasCapability("measure_current.DC2")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(true);
			expect(device.hasCapability("measure_current.DC3")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC4")).toBe(true);
			expect(device.hasCapability("measure_current.DC4")).toBe(true);
		});

		it("should remove unused MPPT capabilities", async () => {
			// Pre-add all MPPT capabilities
			device._capabilities.add("measure_voltage.DC2");
			device._capabilities.add("measure_current.DC2");
			device._capabilities.add("measure_voltage.DC3");
			device._capabilities.add("measure_current.DC3");
			device._capabilities.add("measure_voltage.DC4");
			device._capabilities.add("measure_current.DC4");

			device._settings.MPPTnumber = 2;

			await device.onInit();

			expect(device.hasCapability("measure_voltage.DC2")).toBe(true);
			expect(device.hasCapability("measure_current.DC2")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(false);
			expect(device.hasCapability("measure_current.DC3")).toBe(false);
			expect(device.hasCapability("measure_voltage.DC4")).toBe(false);
			expect(device.hasCapability("measure_current.DC4")).toBe(false);
		});
	});

	describe("onSettings - MPPT changes", () => {
		it("should add MPPT capabilities when increasing MPPTnumber", async () => {
			device._settings.DT = 1;

			await device.onSettings({
				oldSettings: { MPPTnumber: 1, DT: 1 },
				newSettings: { MPPTnumber: 3, DT: 1 },
				changedKeys: ["MPPTnumber"],
			});

			expect(device.hasCapability("measure_voltage.DC2")).toBe(true);
			expect(device.hasCapability("measure_current.DC2")).toBe(true);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(true);
			expect(device.hasCapability("measure_current.DC3")).toBe(true);
		});

		it("should remove MPPT capabilities when decreasing MPPTnumber", async () => {
			device._settings.DT = 1;
			device._capabilities.add("measure_voltage.DC2");
			device._capabilities.add("measure_current.DC2");
			device._capabilities.add("measure_voltage.DC3");
			device._capabilities.add("measure_current.DC3");

			await device.onSettings({
				oldSettings: { MPPTnumber: 3, DT: 1 },
				newSettings: { MPPTnumber: 1, DT: 1 },
				changedKeys: ["MPPTnumber"],
			});

			expect(device.hasCapability("measure_voltage.DC2")).toBe(false);
			expect(device.hasCapability("measure_current.DC2")).toBe(false);
			expect(device.hasCapability("measure_voltage.DC3")).toBe(false);
			expect(device.hasCapability("measure_current.DC3")).toBe(false);
		});

		it("should remove MPPT capabilities when DT changes to Classic (0)", async () => {
			device._capabilities.add("measure_voltage.DC2");
			device._capabilities.add("measure_current.DC2");

			await device.onSettings({
				oldSettings: { MPPTnumber: 2, DT: 1 },
				newSettings: { MPPTnumber: 2, DT: 0 },
				changedKeys: ["DT"],
			});

			expect(device.hasCapability("measure_voltage.DC2")).toBe(false);
			expect(device.hasCapability("measure_current.DC2")).toBe(false);
		});

		it("should not change capabilities when unrelated settings change", async () => {
			const initialCaps = new Set(device._capabilities);

			await device.onSettings({
				oldSettings: { polling_interval: 300 },
				newSettings: { polling_interval: 600 },
				changedKeys: ["polling_interval"],
			});

			expect(device._capabilities).toEqual(initialCaps);
		});
	});

	describe("updateValues - Classic Inverter", () => {
		it("should correctly parse all fields from API response", () => {
			const data = {
				DAY_ENERGY: { Value: 15000 },
				YEAR_ENERGY: { Value: 5000000 },
				TOTAL_ENERGY: { Value: 25000000 },
				PAC: { Value: 2500 },
				IAC: { Value: 10.8 },
				UAC: { Value: 230 },
				IDC: { Value: 8.5 },
				UDC: { Value: 320 },
				FAC: { Value: 50.02 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(15);
			expect(device.getCapabilityValue("meter_power.YEAR")).toBe(5000);
			expect(device.getCapabilityValue("meter_power.TOTAL")).toBe(25000);
			// PV power = UDC * IDC = 320 * 8.5 = 2720
			expect(device.getCapabilityValue("measure_power")).toBe(2720);
			expect(device.getCapabilityValue("measure_current.AC")).toBe(10.8);
			expect(device.getCapabilityValue("measure_voltage.AC")).toBe(230);
			expect(device.getCapabilityValue("measure_current.DC")).toBe(8.5);
			expect(device.getCapabilityValue("measure_voltage.DC")).toBe(320);
			expect(device.getCapabilityValue("measure_frequency")).toBe(50.02);
		});

		it("should fall back to PAC when DC data is missing", () => {
			const data = {
				DAY_ENERGY: { Value: 15000 },
				YEAR_ENERGY: { Value: 5000000 },
				TOTAL_ENERGY: { Value: 25000000 },
				PAC: { Value: 2500 },
				IAC: { Value: 10.8 },
				UAC: { Value: 230 },
				FAC: { Value: 50.02 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBe(2500);
		});

		it("should default to 0 for undefined fields", () => {
			const data = {};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("meter_power.YEAR")).toBe(0);
			expect(device.getCapabilityValue("meter_power.TOTAL")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("measure_current.AC")).toBe(0);
			expect(device.getCapabilityValue("measure_voltage.AC")).toBe(0);
			expect(device.getCapabilityValue("measure_current.DC")).toBe(0);
			expect(device.getCapabilityValue("measure_voltage.DC")).toBe(0);
			expect(device.getCapabilityValue("measure_frequency")).toBe(0);
		});
	});

	describe("updateValues - GEN24 with Multiple MPPT", () => {
		beforeEach(() => {
			device._settings.DT = 1;
			device._settings.MPPTnumber = 2;
			device._capabilities.add("measure_voltage.DC2");
			device._capabilities.add("measure_current.DC2");
			device._capabilities.delete("meter_power");
			device._capabilities.delete("meter_power.YEAR");
		});

		it("should parse MPPT-specific DC values", () => {
			const data = {
				TOTAL_ENERGY: { Value: 25000000 },
				PAC: { Value: 5000 },
				IAC: { Value: 21.7 },
				UAC: { Value: 230 },
				IDC: { Value: 8.0 },
				UDC: { Value: 350 },
				IDC_2: { Value: 7.5 },
				UDC_2: { Value: 345 },
				FAC: { Value: 50.0 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current.DC")).toBe(8.0);
			expect(device.getCapabilityValue("measure_voltage.DC")).toBe(350);
			expect(device.getCapabilityValue("measure_current.DC2")).toBe(7.5);
			expect(device.getCapabilityValue("measure_voltage.DC2")).toBe(345);
			// PV power = sum(UDC_i * IDC_i) = 350*8.0 + 345*7.5 = 5387.5
			expect(device.getCapabilityValue("measure_power")).toBe(5387.5);
		});

		it("should default MPPT values to 0 when undefined", () => {
			const data = {
				PAC: { Value: 5000 },
				IAC: { Value: 21.7 },
				UAC: { Value: 230 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current.DC2")).toBe(0);
			expect(device.getCapabilityValue("measure_voltage.DC2")).toBe(0);
		});

		it("should fall back to PAC when all DC data is missing", () => {
			const data = {
				PAC: { Value: 5000 },
				IAC: { Value: 21.7 },
				UAC: { Value: 230 },
				FAC: { Value: 50.0 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBe(5000);
		});

		it("should not try to set meter_power when capability is removed", () => {
			const data = {
				DAY_ENERGY: { Value: 15000 },
				YEAR_ENERGY: { Value: 5000000 },
				TOTAL_ENERGY: { Value: 25000000 },
				PAC: { Value: 2500 },
			};

			// Should not throw
			expect(() => device.updateValues(data)).not.toThrow();

			// meter_power should not be set (capability doesn't exist)
			expect(device.getCapabilityValue("meter_power")).toBeUndefined();
		});
	});

	describe("updateValues - 4 MPPT trackers", () => {
		beforeEach(() => {
			device._settings.DT = 1;
			device._settings.MPPTnumber = 4;
			device._capabilities.add("measure_voltage.DC2");
			device._capabilities.add("measure_current.DC2");
			device._capabilities.add("measure_voltage.DC3");
			device._capabilities.add("measure_current.DC3");
			device._capabilities.add("measure_voltage.DC4");
			device._capabilities.add("measure_current.DC4");
		});

		it("should parse all 4 MPPT tracker values", () => {
			const data = {
				IDC: { Value: 8.0 },
				UDC: { Value: 350 },
				IDC_2: { Value: 7.5 },
				UDC_2: { Value: 345 },
				IDC_3: { Value: 7.0 },
				UDC_3: { Value: 340 },
				IDC_4: { Value: 6.5 },
				UDC_4: { Value: 335 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current.DC")).toBe(8.0);
			expect(device.getCapabilityValue("measure_voltage.DC")).toBe(350);
			expect(device.getCapabilityValue("measure_current.DC2")).toBe(7.5);
			expect(device.getCapabilityValue("measure_voltage.DC2")).toBe(345);
			expect(device.getCapabilityValue("measure_current.DC3")).toBe(7.0);
			expect(device.getCapabilityValue("measure_voltage.DC3")).toBe(340);
			expect(device.getCapabilityValue("measure_current.DC4")).toBe(6.5);
			expect(device.getCapabilityValue("measure_voltage.DC4")).toBe(335);
		});
	});

	describe("updateValues - edge cases", () => {
		it("should handle zero values", () => {
			const data = {
				DAY_ENERGY: { Value: 0 },
				PAC: { Value: 0 },
				IAC: { Value: 0 },
				UAC: { Value: 0 },
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
		});

		it("should handle very large energy values", () => {
			const data = {
				TOTAL_ENERGY: { Value: 100000000000 }, // 100 GWh
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power.TOTAL")).toBe(100000000);
		});
	});
});
