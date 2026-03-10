import { beforeEach, describe, expect, it, vi } from "vitest";
import StorageDevice from "../../../drivers/storage/device.js";

/**
 * Test wrapper for StorageDevice
 */
class TestStorageDevice extends StorageDevice {
	constructor() {
		super();
		this._capabilities = new Set([
			"measure_voltage",
			"measure_current",
			"measure_temperature",
			"measure_battery",
			"measure_power",
			"battery_charging_state",
			"meter_power",
			"meter_power.charged",
			"meter_power.discharged",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 0,
			polling_interval: 300,
		};
		this._listeners = new Map();
		this._store = new Map();
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
		return "Test Storage";
	}
	getStoreValue(key) {
		return this._store.get(key);
	}
	setStoreValue(key, value) {
		this._store.set(key, value);
		return Promise.resolve();
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

describe("StorageDevice", () => {
	let device;

	beforeEach(() => {
		device = new TestStorageDevice();
	});

	describe("getUpdatePath", () => {
		it("should return correct API path", () => {
			expect(device.getUpdatePath()).toBe(
				"/solar_api/v1/GetStorageRealtimeData.cgi?",
			);
		});
	});

	describe("onInit - capability migration", () => {
		it("should add battery_charging_state if missing", async () => {
			device._capabilities.delete("battery_charging_state");
			device.pollDevice = vi.fn();

			await device.onInit();

			expect(device.hasCapability("battery_charging_state")).toBe(true);
		});

		it("should keep battery_charging_state if already present", async () => {
			device._capabilities.add("battery_charging_state");
			device.pollDevice = vi.fn();

			await device.onInit();

			expect(device.hasCapability("battery_charging_state")).toBe(true);
		});

		it("should ensure cumulative energy capabilities exist and initialize from store", async () => {
			device._capabilities.delete("meter_power");
			device._capabilities.delete("meter_power.charged");
			device._capabilities.delete("meter_power.discharged");
			device._store.set("meter_power", 1.5);
			device._store.set("meter_power.charged", 1.0);
			device._store.set("meter_power.discharged", 0.5);
			device.pollDevice = vi.fn();

			await device.onInit();

			expect(device.hasCapability("meter_power")).toBe(true);
			expect(device.hasCapability("meter_power.charged")).toBe(true);
			expect(device.hasCapability("meter_power.discharged")).toBe(true);
			expect(device.getCapabilityValue("meter_power")).toBe(1.5);
			expect(device.getCapabilityValue("meter_power.charged")).toBe(1.0);
			expect(device.getCapabilityValue("meter_power.discharged")).toBe(0.5);
		});

		it("should enable polling", async () => {
			device.pollDevice = vi.fn();

			await device.onInit();

			expect(device.polling).toBe(true);
		});
	});

	describe("updateValues - charging state", () => {
		it("should set charging state when current is positive", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.2,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("battery_charging_state")).toBe(
				"charging",
			);
		});

		it("should set discharging state when current is negative", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: -3.0,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 50,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("battery_charging_state")).toBe(
				"discharging",
			);
		});

		it("should set idle state when current is zero", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 0,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 100,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("battery_charging_state")).toBe("idle");
		});
	});

	describe("updateValues - measurements", () => {
		it("should correctly set all capability values", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.2,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_voltage")).toBe(48.5);
			expect(device.getCapabilityValue("measure_current")).toBe(5.2);
			expect(device.getCapabilityValue("measure_temperature")).toBe(25);
			expect(device.getCapabilityValue("measure_battery")).toBe(75);
		});

		it("should calculate power as voltage * current", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.2,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBeCloseTo(252.2, 1);
		});

		it("should handle negative current in power calculation", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: -3.0,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 50,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBeCloseTo(-145.5, 1);
		});
	});

	describe("updateValues - undefined handling", () => {
		it("should default to 0 for undefined voltage", () => {
			const data = {
				Controller: {
					Current_DC: 5.0,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_voltage")).toBe(0);
		});

		it("should default to 0 for undefined current", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_current")).toBe(0);
			expect(device.getCapabilityValue("battery_charging_state")).toBe("idle");
		});

		it("should default to 0 for undefined temperature", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.0,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_temperature")).toBe(0);
		});

		it("should default to 0 for undefined state of charge", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.0,
					Temperature_Cell: 25,
				},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_battery")).toBe(0);
		});

		it("should handle all undefined values", () => {
			const data = {
				Controller: {},
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_voltage")).toBe(0);
			expect(device.getCapabilityValue("measure_current")).toBe(0);
			expect(device.getCapabilityValue("measure_temperature")).toBe(0);
			expect(device.getCapabilityValue("measure_battery")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("battery_charging_state")).toBe("idle");
		});
	});

	describe("updateValues - cumulative energy", () => {
		it("should accumulate imported, exported and total energy for positive power", () => {
			// 48.5 V * 5.2 A = 252.2 W, interval 300 s => ~0.0210 kWh per call
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: 5.2,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 75,
				},
			};

			device.updateValues(data);
			device.updateValues(data);

			const total = device.getCapabilityValue("meter_power");
			const imported = device.getCapabilityValue("meter_power.charged");
			const exported = device.getCapabilityValue("meter_power.discharged");

			const expectedDeltaPerCall = (252.2 * 300) / 3600 / 1000;

			expect(total).toBeCloseTo(2 * expectedDeltaPerCall, 5);
			expect(imported).toBeCloseTo(2 * expectedDeltaPerCall, 5);
			expect(exported).toBeCloseTo(0, 5);
		});

		it("should accumulate exported and total energy for negative power", () => {
			const data = {
				Controller: {
					Voltage_DC: 48.5,
					Current_DC: -3.0,
					Temperature_Cell: 25,
					StateOfCharge_Relative: 50,
				},
			};

			device.updateValues(data);
			device.updateValues(data);

			const total = device.getCapabilityValue("meter_power");
			const imported = device.getCapabilityValue("meter_power.charged");
			const exported = device.getCapabilityValue("meter_power.discharged");

			// 48.5 * 3.0 = 145.5 W
			const expectedDeltaPerCall = (145.5 * 300) / 3600 / 1000;

			expect(total).toBeCloseTo(2 * expectedDeltaPerCall, 5);
			expect(exported).toBeCloseTo(2 * expectedDeltaPerCall, 5);
			expect(imported).toBeCloseTo(0, 5);
		});
	});
});
