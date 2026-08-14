import Homey from "homey";
import fetch from "node-fetch";

const delay = (s) => new Promise((resolve) => setTimeout(resolve, 1000 * s));

class FroniusDevice extends Homey.Device {
	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log("Device has been initialized");

		// Enable device polling
		this.polling = true;
		this.addListener("poll", this.pollDevice);
		this.emit("poll");
	}

	async pollDevice() {
		while (this.polling) {
			console.log(`Updating device ${this.getName()}`);
			this.updateFroniusDevice();
			await delay(this.getSetting("polling_interval"));
		}
	}

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 */
	async onAdded() {
		this.log("Device has been added");
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
		this.log("Device settings where changed");
	}

	/**
	 * Applies the energy object of the driver manifest, with the cumulative setting of the device.
	 * Device.setEnergy() replaces the complete energy configuration and the manifest is disregarded
	 * from that call on, so every property the manifest declares has to be passed along with the
	 * cumulative flag. See https://apps.developer.homey.app/the-basics/devices/energy
	 * @param {boolean} cumulative The cumulative setting of the device
	 * @returns {Promise<void>}
	 */
	async setEnergyFromManifest(cumulative) {
		const manifestEnergy = this.driver.manifest.energy;
		if (!manifestEnergy) return;

		const energy = { ...manifestEnergy };
		if (typeof cumulative === "boolean") energy.cumulative = cumulative;

		await this.setEnergy(energy);
	}

	/**
	 * onRenamed is called when the user updates the device's name.
	 * This method can be used this to synchronise the name to the device.
	 * @param {string} name The new name
	 */
	async onRenamed(_name) {
		this.log("Device was renamed");
	}

	/**
	 * onDeleted is called when the user deleted the device.
	 */
	async onDeleted() {
		this.log("Device has been deleted");
		this.polling = false;
	}

	getUpdatePath() {
		throw new Error("todo: Implement into child class");
	}

	getOptionalSuffix() {
		return "";
	}

	updateFroniusDevice() {
		const settings = this.getSettings();
		const updateUrl = `http://${settings.ip}${this.getUpdatePath()}Scope=Device&DeviceId=${settings.DeviceId}${this.getOptionalSuffix()}`;
		console.log(updateUrl);

		fetch(updateUrl)
			.then(checkResponseStatus)
			.then((result) => result.json())
			.then((json) => {
				if (!json || !json.Body || !json.Body.Data) {
					console.log(
						`Données invalides reçues pour le device ${this.getName()}`,
					);
					return;
				}
				const data = json.Body.Data;
				if (Object.keys(data).length === 0) {
					console.log(`Données vides reçues pour le device ${this.getName()}`);
					return;
				}
				this.updateValues(data);
			})
			.catch((_error) => {
				console.log(
					`Error when updating device ${this.getName()} on ${updateUrl}`,
				);
			});
	}

	updateValues(_data) {
		//this function has to be definid in child clss
		console.log(`Error : call to generic class Driver FroniusDriver`);
		callback(new Error(Homey.__("prototype function called")));
	}
}

function checkResponseStatus(res) {
	if (res.ok) {
		return res;
	} else {
		console.log(`Wrong response status : ${res.status} (${res.statusText})`);
		throw new Error(
			`Wrong response status : ${res.status} (${res.statusText})`,
		);
	}
}

export default FroniusDevice;
