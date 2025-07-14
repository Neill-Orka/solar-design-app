import pvlib
import pandas as pd

print("Fetching component databases from PVLib...")

cec_modules = pvlib.pvsystem.retrieve_sam('CECMod')
cec_inverters = pvlib.pvsystem.retrieve_sam('CECInverter')

print("Databases fetched successfully. Exporting to files...")

cec_modules.to_csv('module_database.csv')
cec_inverters.to_csv('inverter_database.csv')

print("✅ Export complete!")
print("Files 'module_database.csv' and 'inverter_database.csv' are now saved.")