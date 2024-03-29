# Fronius

Adds support for Fronius inverter. 

# Drivers
After installing the app, several possibilities are available : 
* Inverter : shows for every inverter PV power, daily/yearly/total Production, AC/DC current and AC/DC voltage. PV power is reported in energy tab
* Smartmeter : shows current, voltage, frequency, power and energy (produced/injected) for every smartmeter
* Ohmpilot : reports consumption and temperature for Ohmpilot consumption regulator 
* Storage : reports battery capacity, charged capacity, current and voltage
* PowerFlow : shows for the site PV, Grid, Load and Akku power. Load is reported in energy tab. 
* Reporting : using datamanager archive, adds a reporting app that shows costs, savings, self-consumption rate, etc.

## Donations
Feel free to donate to  support the project !
[<img src="https://www.paypalobjects.com/en_GB/i/btn/btn_donate_SM.gif">](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=RVBS24SPLU922&currency_code=EUR)

# Version History
### 0.1.12:
    Additional check when updating smartmeter values (3-phase)
### 0.1.11:
	Add a check to add 3phase capability if needed in smartmeter
### 0.1.10:
    Fixed data with 3-phase when creating device (ex : smartmeter)
### 0.1.9: 
    Fixed empty data bug w uuid
### 0.1.7: 
    Fixed typo in ohmpilot capability
### 0.1.6: 
    Added decimal for frequency
### 0.1.5: 
    Added frequency in inverter
### 0.1.4:
    Added custom label for 3phase
### 0.1.3:
	- Added 3-phase current in smartmeter
### 0.1.2:
	- Updated app image (athom request)
### 0.1.1:
	- Add a GEN24 storage with basic informations
### 0.1.0:
	- Update to SDKv3
### 0.0.13: 
    - Fixed bug for 3-phase SmartMeter
### 0.0.12: 
    - Fixed bug at beginning of the month in device Reporting
### v0.0.11
	- Code factoring
### v0.0.10
	- Workaround for issue #2, smartmeter on GEN24
### v0.0.9
	- Add storage and ohmpilot - basic support
### v0.0.8
	- Update driver name
### v0.0.7 
	- Add reporting app (reports costs, savings, self-consumption rate, etc.), new icons
### v0.0.6
	- Add settings for cumulative 
### v0.0.5
	- New Smart Meter driver
### v0.0.4
	- Update drivers images, fixed README.txt
### v0.0.3
	- Small changes for app publishing
### v0.0.2
	- Basic support for Inverter and Power Flow