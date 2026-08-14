import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import fetch from "node-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PowerFlow from "../../../drivers/fronius-powerflow/device.js";
import { createMockFetch } from "../../mocks/fetch.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

// onSettings writes back what the manifest declares, so the tests read the same file
// instead of a copy that can drift away from it.
const manifest = JSON.parse(
	readFileSync(
		join(PROJECT_ROOT, "drivers/fronius-powerflow/driver.compose.json"),
		"utf8",
	),
);

/**
 * Test wrapper for PowerFlow
 */
class TestPowerFlow extends PowerFlow {
	constructor() {
		super();
		this.driver = { manifest: structuredClone(manifest) };
		this._capabilities = new Set([
			"measure_power",
			"measure_power.PV",
			"measure_power.LOAD",
			"measure_power.GRID",
			"measure_power.AKKU",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
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
		return "Test PowerFlow";
	}
	log() {}
	error() {}
	setEnergy() {
		return Promise.resolve();
	}
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

describe("PowerFlow", () => {
	let device;

	beforeEach(() => {
		device = new TestPowerFlow();
		vi.clearAllMocks();
	});

	describe("updateFroniusDevice", () => {
		it("should construct correct URL without DeviceId", async () => {
			const mockResponse = {
				Body: {
					Data: {
						Site: {
							P_PV: 5000,
							P_Load: -3000,
							P_Grid: -2000,
							P_Akku: 0,
						},
					},
				},
			};
			fetch.mockImplementation(createMockFetch(mockResponse));

			device.updateFroniusDevice();

			await vi.waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					"http://192.168.1.100/solar_api/v1/GetPowerFlowRealtimeData.fcgi",
				);
			});
		});

		it("should call updateValues with Site data", async () => {
			const siteData = {
				P_PV: 5000,
				P_Load: -3000,
				P_Grid: -2000,
				P_Akku: 0,
			};
			const mockResponse = {
				Body: {
					Data: {
						Site: siteData,
					},
				},
			};
			fetch.mockImplementation(createMockFetch(mockResponse));

			device.updateFroniusDevice();

			await vi.waitFor(() => {
				expect(device.getCapabilityValue("measure_power.PV")).toBe(5000);
			});
		});

		it("should handle fetch errors gracefully", async () => {
			fetch.mockImplementation(() =>
				Promise.reject(new Error("Network error")),
			);

			// Should not throw
			expect(() => device.updateFroniusDevice()).not.toThrow();
		});
	});

	describe("updateValues", () => {
		it("should correctly set all capability values", () => {
			const data = {
				P_PV: 5000,
				P_Load: -3000,
				P_Grid: -2000,
				P_Akku: 500,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(5000);
			expect(device.getCapabilityValue("measure_power.LOAD")).toBe(-3000);
			expect(device.getCapabilityValue("measure_power.GRID")).toBe(-2000);
			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(500);
		});

		it("should calculate measure_power as grid + battery", () => {
			const data = {
				P_PV: 5000,
				P_Load: -3000,
				P_Grid: -2000,
				P_Akku: 500,
			};

			device.updateValues(data);

			// measure_power = P_Grid + P_Akku = -2000 + 500 = -1500
			expect(device.getCapabilityValue("measure_power")).toBe(-1500);
		});

		it("should handle undefined values with default 0", () => {
			const data = {};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(0);
			expect(device.getCapabilityValue("measure_power.LOAD")).toBe(0);
			expect(device.getCapabilityValue("measure_power.GRID")).toBe(0);
			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
		});

		it("should handle null values with default 0", () => {
			const data = {
				P_PV: null,
				P_Load: null,
				P_Grid: null,
				P_Akku: null,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(0);
			expect(device.getCapabilityValue("measure_power.LOAD")).toBe(0);
			expect(device.getCapabilityValue("measure_power.GRID")).toBe(0);
			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
		});

		it("should handle mixed null and valid values", () => {
			const data = {
				P_PV: 5000,
				P_Load: null,
				P_Grid: -2000,
				P_Akku: undefined,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(5000);
			expect(device.getCapabilityValue("measure_power.LOAD")).toBe(0);
			expect(device.getCapabilityValue("measure_power.GRID")).toBe(-2000);
			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(-2000);
		});
	});

	describe("updateValues - realistic scenarios", () => {
		it("should handle solar production with export", () => {
			// Producing 5kW, using 2kW, exporting 3kW
			const data = {
				P_PV: 5000,
				P_Load: -2000,
				P_Grid: -3000, // Negative = export
				P_Akku: 0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(5000);
			expect(device.getCapabilityValue("measure_power.GRID")).toBe(-3000);
			expect(device.getCapabilityValue("measure_power")).toBe(-3000);
		});

		it("should handle solar production with battery charging", () => {
			// Producing 5kW, using 2kW, charging battery with 2kW, exporting 1kW
			const data = {
				P_PV: 5000,
				P_Load: -2000,
				P_Grid: -1000,
				P_Akku: 2000, // Positive = charging
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(2000);
			expect(device.getCapabilityValue("measure_power")).toBe(1000);
		});

		it("should handle battery discharging", () => {
			// No solar, using 2kW from battery, importing 1kW
			const data = {
				P_PV: 0,
				P_Load: -3000,
				P_Grid: 1000, // Positive = import
				P_Akku: -2000, // Negative = discharging
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.AKKU")).toBe(-2000);
			expect(device.getCapabilityValue("measure_power")).toBe(-1000);
		});

		it("should handle nighttime import only", () => {
			// No solar, using 2kW from grid
			const data = {
				P_PV: 0,
				P_Load: -2000,
				P_Grid: 2000,
				P_Akku: 0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power.PV")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(2000);
		});
	});

	describe("onSettings", () => {
		it("should call setEnergy with cumulative setting", async () => {
			const setEnergySpy = vi.spyOn(device, "setEnergy");

			await device.onSettings({
				oldSettings: { cumulative: false },
				newSettings: { cumulative: true },
				changedKeys: ["cumulative"],
			});

			expect(setEnergySpy).toHaveBeenCalledWith({
				...manifest.energy,
				cumulative: true,
			});
		});

		it("should keep the capabilities declared in the manifest", async () => {
			device.driver.manifest.energy = {
				cumulative: true,
				cumulativeImportedCapability: "meter_power",
				cumulativeExportedCapability: "meter_power.injected",
			};
			const setEnergySpy = vi.spyOn(device, "setEnergy");

			await device.onSettings({
				oldSettings: { cumulative: true },
				newSettings: { cumulative: false },
				changedKeys: ["cumulative"],
			});

			expect(setEnergySpy).toHaveBeenCalledWith({
				cumulative: false,
				cumulativeImportedCapability: "meter_power",
				cumulativeExportedCapability: "meter_power.injected",
			});
		});
	});
});
