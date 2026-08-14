import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Smartmeter from "../../../drivers/smartmeter/device.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// The repair in onInit writes back what the manifest declares, so the tests read the same file
// instead of a copy that can drift away from it.
const manifest = JSON.parse(
	readFileSync(
		join(PROJECT_ROOT, "drivers/smartmeter/driver.compose.json"),
		"utf8",
	),
);

/**
 * Test wrapper for Smartmeter
 */
class TestSmartmeter extends Smartmeter {
	constructor() {
		super();
		this.driver = { manifest: structuredClone(manifest) };
		this._energy = null;
		this._capabilities = new Set([
			"measure_power",
			"measure_current",
			"measure_voltage",
			"measure_frequency",
			"meter_power",
			"meter_power.injected",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 0,
			threePhase: false,
			gen24meterbug: false,
			cumulative: true,
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
		return "Test Smartmeter";
	}
	log() {}
	error() {}
	getEnergy() {
		return this._energy;
	}
	setEnergy(energy) {
		this._energy = energy;
		return Promise.resolve();
	}
	updateFroniusDevice() {}
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

describe("Smartmeter", () => {
	let device;

	beforeEach(() => {
		device = new TestSmartmeter();
	});

	describe("getUpdatePath", () => {
		it("should return correct API path", () => {
			expect(device.getUpdatePath()).toBe(
				"/solar_api/v1/GetMeterRealtimeData.cgi?",
			);
		});
	});

	describe("onInit - 3-phase capability", () => {
		beforeEach(() => {
			device.pollDevice = vi.fn();
		});

		it("should add phase capabilities when threePhase=true", async () => {
			device._settings.threePhase = true;

			await device.onInit();

			expect(device.hasCapability("measure_current.phase1")).toBe(true);
			expect(device.hasCapability("measure_current.phase2")).toBe(true);
			expect(device.hasCapability("measure_current.phase3")).toBe(true);
		});

		it("should NOT add phase capabilities when threePhase=false", async () => {
			device._settings.threePhase = false;

			await device.onInit();

			expect(device.hasCapability("measure_current.phase1")).toBe(false);
			expect(device.hasCapability("measure_current.phase2")).toBe(false);
			expect(device.hasCapability("measure_current.phase3")).toBe(false);
		});

		it("should enable polling", async () => {
			await device.onInit();

			expect(device.polling).toBe(true);
		});
	});

	describe("onInit - energy configuration repair", () => {
		beforeEach(() => {
			device.pollDevice = vi.fn();
		});

		it("should restore the manifest configuration when the cumulative capabilities are missing", async () => {
			device._energy = { cumulative: true };

			await device.onInit();

			expect(device.getEnergy()).toEqual({
				...manifest.energy,
				cumulative: true,
			});
		});

		it("should restore with the cumulative setting of the device", async () => {
			device._energy = { cumulative: true };
			device._settings.cumulative = false;

			await device.onInit();

			expect(device.getEnergy()).toEqual({
				...manifest.energy,
				cumulative: false,
			});
		});

		it("should leave an intact configuration alone", async () => {
			device._energy = { ...manifest.energy };
			const setEnergySpy = vi.spyOn(device, "setEnergy");

			await device.onInit();

			expect(setEnergySpy).not.toHaveBeenCalled();
		});

		it("should leave a device without energy override alone", async () => {
			device._energy = null;
			const setEnergySpy = vi.spyOn(device, "setEnergy");

			await device.onInit();

			expect(setEnergySpy).not.toHaveBeenCalled();
		});

		it("should restore once and not on every start", async () => {
			device._energy = { cumulative: true };
			await device.onInit();
			const setEnergySpy = vi.spyOn(device, "setEnergy");

			await device.onInit();

			expect(setEnergySpy).not.toHaveBeenCalled();
		});

		it("should keep initializing when restoring fails", async () => {
			device._energy = { cumulative: true };
			vi.spyOn(device, "setEnergy").mockRejectedValue(new Error("offline"));

			await device.onInit();

			expect(device.polling).toBe(true);
		});

		it("should keep initializing when reading the energy object fails", async () => {
			vi.spyOn(device, "getEnergy").mockImplementation(() => {
				throw new Error("not supported");
			});

			await device.onInit();

			expect(device.polling).toBe(true);
		});
	});

	describe("onSettings - 3-phase toggle", () => {
		it("should add phase capabilities when enabling 3-phase", async () => {
			await device.onSettings({
				oldSettings: { threePhase: false },
				newSettings: { threePhase: true, cumulative: true },
				changedKeys: ["threePhase"],
			});

			expect(device.hasCapability("measure_current.phase1")).toBe(true);
			expect(device.hasCapability("measure_current.phase2")).toBe(true);
			expect(device.hasCapability("measure_current.phase3")).toBe(true);
		});

		it("should remove phase capabilities when disabling 3-phase", async () => {
			device._capabilities.add("measure_current.phase1");
			device._capabilities.add("measure_current.phase2");
			device._capabilities.add("measure_current.phase3");

			await device.onSettings({
				oldSettings: { threePhase: true },
				newSettings: { threePhase: false, cumulative: true },
				changedKeys: ["threePhase"],
			});

			expect(device.hasCapability("measure_current.phase1")).toBe(false);
			expect(device.hasCapability("measure_current.phase2")).toBe(false);
			expect(device.hasCapability("measure_current.phase3")).toBe(false);
		});
	});

	describe("updateValues - Normal Path (gen24meterbug=false)", () => {
		beforeEach(() => {
			device._settings.gen24meterbug = false;
		});

		it("should parse standard smartmeter response", () => {
			const data = {
				EnergyReal_WAC_Plus_Absolute: 5000000,
				EnergyReal_WAC_Minus_Absolute: 2000000,
				PowerReal_P_Sum: 1500,
				Current_AC_Sum: 6.5,
				Voltage_AC_Phase_Average: 230,
				Frequency_Phase_Average: 50.01,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(5000);
			expect(device.getCapabilityValue("meter_power.injected")).toBe(2000);
			expect(device.getCapabilityValue("measure_power")).toBe(1500);
			expect(device.getCapabilityValue("measure_current")).toBe(6.5);
			expect(device.getCapabilityValue("measure_voltage")).toBe(230);
			expect(device.getCapabilityValue("measure_frequency")).toBe(50.01);
		});

		it("should calculate current from 3-phase sum when Current_AC_Sum missing", () => {
			const data = {
				EnergyReal_WAC_Plus_Absolute: 5000000,
				EnergyReal_WAC_Minus_Absolute: 2000000,
				PowerReal_P_Sum: 1500,
				Current_AC_Phase_1: 2.0,
				Current_AC_Phase_2: 2.5,
				Current_AC_Phase_3: 2.0,
				Voltage_AC_Phase_Average: 230,
				Frequency_Phase_Average: 50.0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current")).toBe(6.5);
		});

		it("should use Voltage_AC_Phase_Average when available", () => {
			const data = {
				Voltage_AC_Phase_Average: 231,
				Voltage_AC_Phase_1: 228,
				Voltage_AC_Phase_2: 230,
				Voltage_AC_Phase_3: 232,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_voltage")).toBe(231);
		});

		it("should use Phase_1 voltage when 3-phase average fails (known bug in code)", () => {
			// NOTE: There's a bug in smartmeter/device.js where the condition for
			// 3-phase averaging is missing 'typeof' for phases 2 and 3:
			//   typeof data.Voltage_AC_Phase_1 === "number" &&
			//   data.Voltage_AC_Phase_2 === "number" &&  // missing typeof
			//   data.Voltage_AC_Phase_3 === "number"     // missing typeof
			// This causes the condition to always fail and fall through to Phase_1 fallback
			const data = {
				Voltage_AC_Phase_1: 228,
				Voltage_AC_Phase_2: 230,
				Voltage_AC_Phase_3: 232,
			};

			device.updateValues(data);

			// Currently returns Phase_1 due to the bug mentioned above
			expect(device.getCapabilityValue("measure_voltage")).toBe(228);
		});

		it("should use Phase_1 voltage as fallback", () => {
			const data = {
				Voltage_AC_Phase_1: 229,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_voltage")).toBe(229);
		});

		it("should default to 0 for undefined values", () => {
			const data = {};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("meter_power.injected")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("measure_current")).toBe(0);
			expect(device.getCapabilityValue("measure_voltage")).toBe(0);
			expect(device.getCapabilityValue("measure_frequency")).toBe(0);
		});
	});

	describe("updateValues - 3-Phase Capability", () => {
		beforeEach(() => {
			device._settings.threePhase = true;
			device._settings.gen24meterbug = false;
			device._capabilities.add("measure_current.phase1");
			device._capabilities.add("measure_current.phase2");
			device._capabilities.add("measure_current.phase3");
		});

		it("should set individual phase currents", () => {
			const data = {
				EnergyReal_WAC_Plus_Absolute: 5000000,
				EnergyReal_WAC_Minus_Absolute: 2000000,
				PowerReal_P_Sum: 1500,
				Current_AC_Phase_1: 2.0,
				Current_AC_Phase_2: 2.5,
				Current_AC_Phase_3: 2.0,
				Voltage_AC_Phase_Average: 230,
				Frequency_Phase_Average: 50.0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current.phase1")).toBe(2.0);
			expect(device.getCapabilityValue("measure_current.phase2")).toBe(2.5);
			expect(device.getCapabilityValue("measure_current.phase3")).toBe(2.0);
		});

		it("should not set phase current if data is missing", () => {
			const data = {
				Current_AC_Phase_1: 2.0,
				// phase2 and phase3 missing
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current.phase1")).toBe(2.0);
			expect(
				device.getCapabilityValue("measure_current.phase2"),
			).toBeUndefined();
			expect(
				device.getCapabilityValue("measure_current.phase3"),
			).toBeUndefined();
		});
	});

	describe("updateValues - GEN24 Workaround (gen24meterbug=true)", () => {
		beforeEach(() => {
			device._settings.gen24meterbug = true;
		});

		it("should use GEN24-specific field names", () => {
			const data = {
				SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64: 5000000,
				SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64: 2000000,
				SMARTMETER_POWERACTIVE_MEAN_SUM_F64: 1500,
				GRID_FREQUENCY_MEAN_F32: 50.02,
				SMARTMETER_VOLTAGE_MEAN_01_F64: 230,
				SMARTMETER_POWERACTIVE_MEAN_01_F64: 500,
				SMARTMETER_VOLTAGE_MEAN_02_F64: 231,
				SMARTMETER_POWERACTIVE_MEAN_02_F64: 500,
				SMARTMETER_VOLTAGE_MEAN_03_F64: 229,
				SMARTMETER_POWERACTIVE_MEAN_03_F64: 500,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(5000);
			expect(device.getCapabilityValue("meter_power.injected")).toBe(2000);
			expect(device.getCapabilityValue("measure_power")).toBe(1500);
			expect(device.getCapabilityValue("measure_frequency")).toBe(50.02);
		});

		it("should calculate current from power/voltage for each phase", () => {
			const data = {
				SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64: 5000000,
				SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64: 2000000,
				SMARTMETER_POWERACTIVE_MEAN_SUM_F64: 1500,
				GRID_FREQUENCY_MEAN_F32: 50.0,
				SMARTMETER_VOLTAGE_MEAN_01_F64: 230,
				SMARTMETER_POWERACTIVE_MEAN_01_F64: 460, // 2A
				SMARTMETER_VOLTAGE_MEAN_02_F64: 230,
				SMARTMETER_POWERACTIVE_MEAN_02_F64: 575, // 2.5A
				SMARTMETER_VOLTAGE_MEAN_03_F64: 230,
				SMARTMETER_POWERACTIVE_MEAN_03_F64: 460, // 2A
			};

			device.updateValues(data);

			// Total current = 2 + 2.5 + 2 = 6.5A
			expect(device.getCapabilityValue("measure_current")).toBeCloseTo(6.5, 1);
			// Average voltage = 230V
			expect(device.getCapabilityValue("measure_voltage")).toBe(230);
		});

		it("should handle single phase in GEN24 mode", () => {
			const data = {
				SMARTMETER_ENERGYACTIVE_ABSOLUT_PLUS_F64: 5000000,
				SMARTMETER_ENERGYACTIVE_ABSOLUT_MINUS_F64: 2000000,
				SMARTMETER_POWERACTIVE_MEAN_SUM_F64: 1500,
				GRID_FREQUENCY_MEAN_F32: 50.0,
				SMARTMETER_VOLTAGE_MEAN_01_F64: 230,
				SMARTMETER_POWERACTIVE_MEAN_01_F64: 460,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current")).toBe(2);
			expect(device.getCapabilityValue("measure_voltage")).toBe(230);
		});

		it("should default to 0 for undefined GEN24 values", () => {
			const data = {};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("meter_power.injected")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("measure_frequency")).toBe(0);
		});
	});

	describe("updateValues - edge cases", () => {
		it("should handle zero energy values", () => {
			const data = {
				EnergyReal_WAC_Plus_Absolute: 0,
				EnergyReal_WAC_Minus_Absolute: 0,
				PowerReal_P_Sum: 0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("meter_power.injected")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
		});

		it("should handle negative power (export)", () => {
			const data = {
				PowerReal_P_Sum: -2500,
				Current_AC_Sum: -10.8,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBe(-2500);
			expect(device.getCapabilityValue("measure_current")).toBe(-10.8);
		});

		it("should handle large energy values", () => {
			const data = {
				EnergyReal_WAC_Plus_Absolute: 100000000, // 100 MWh
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(100000);
		});
	});
});
