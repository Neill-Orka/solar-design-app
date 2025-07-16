# services/validation_engine.py
import math

# PLACEHOLDERS FOR TEMPERATURE CORRECTION FACTORS
TEMP_CORRECTION_COLD = 1.15 # Voc increases by 15% on a very cold day
TEMP_CORRECTION_HOT = 0.95 # Vmp decreases by 5% on a very hot day

def validate_string_voltage(panel_props, inverter_props, panels_per_string):
    # Check if the string voltage is within the inverter's DC input voltage range

    if not all(k in panel_props for k in ['voc']) or not all(k in inverter_props for k in ['max_dc_voltage']):
        return {"is_valid": False, "message": "Missing voc or max_dc_voltage properties"}
    
    max_string_voc = panel_props['voc'] * panels_per_string * TEMP_CORRECTION_COLD
    inverter_max_v = inverter_props['max_dc_voltage']

    if max_string_voc > inverter_max_v:
        message = f"Voltage ({max_string_voc:.0f}V) exceeds inverter limit of {inverter_max_v}V."
        return {"is_valid" : False, "message": message}
    
    return {"is_valid": True, "message": f"Max string voltage: {max_string_voc:.0f}V (OK)"}

def calculate_required_fuse_rating(panel_props, safety_factor=1.25):
    # Calculate the minimum required fuse rating based on panel properties
    if 'isc' not in panel_props:
        return None
    
    return panel_props['isc'] * safety_factor