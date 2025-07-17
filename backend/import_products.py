import pandas as pd
import os
import numpy as np
import requests
import json

# The URL of your running Flask application
API_URL = 'http://localhost:5000'

def clean_value(value):
    """Handles various data types and cleans them for the database."""
    if pd.isna(value) or value is None or str(value).strip() == '':
        return None
    if isinstance(value, str):
        value = value.strip()
    try:
        if float(value) == int(float(value)):
            return int(float(value))
    except (ValueError, TypeError):
        pass
    try:
        return float(value)
    except (ValueError, TypeError):
        pass
    return str(value)

def clean_price(value):
    """Removes currency symbols and commas, then converts to float."""
    if pd.isna(value) or value is None:
        return None
    price_str = str(value).replace('R', '').replace(' ', '').replace(',', '')
    try:
        return float(price_str)
    except (ValueError, TypeError):
        return None

# The master map of all possible Excel columns to our database fields
COLUMN_MAP = {
    'Brand Name': 'brand',
    'Brandname': 'brand',
    'Description': 'model',
    'Power Rating (W)': 'power_w',
    'Power Rating (kVA)': 'rating_kva',
    'Usable Rating (kWh)': 'capacity_kwh',
    'Unit Cost': 'price',
    'Notes': 'notes',
    'Warranty (Y)': 'warranty_y',
    # --- Properties ---
    'Max Voc (V)': 'properties.voc',
    'Isc (A)': 'properties.isc',
    'Vmp': 'properties.vmp',
    'Imp (A)': 'properties.imp',
    'System Type': 'properties.system_type',
    'Number Of Phases': 'properties.phases',
    'Number of MPPT': 'properties.num_mppt',
    'Max Isc per MPPT (A)': 'properties.max_isc_per_mppt',
    'Max DC Input Voltage per MPPT (V)': 'properties.max_dc_voltage',
    'Min Operating Voltage Range (V)': 'properties.mppt_min_v',
    'Max Operating Voltage Range (V)': 'properties.mppt_max_v',
    'Nominal Voltage (V)': 'properties.nominal_voltage',
    'Nominal Rating (kWh)': 'properties.nominal_kwh',
    'Nominal Amperage (A)': 'properties.amp_rating',
    'Poles': 'properties.poles',
    'Interrupting Capacity (kA)': 'properties.interrupt_capacity_ka',
}

def process_dataframe_for_api(df, category):
    """Processes a DataFrame and returns a list of JSON payloads for the API."""
    payload_list = []
    for _, row in df.iterrows():
        payload = {'properties': {}}
        
        for excel_col, db_field in COLUMN_MAP.items():
            if excel_col in row and not pd.isna(row[excel_col]):
                value = clean_price(row[excel_col]) if db_field == 'price' else clean_value(row[excel_col])
                
                if value is None: continue

                if db_field.startswith('properties.'):
                    prop_key = db_field.split('.')[1]
                    payload['properties'][prop_key] = value
                else:
                    payload[db_field] = value
        
        payload['category'] = category
        payload_list.append(payload)
        
    return payload_list

def post_to_api(payload):
    """Sends a single product payload to the API."""
    try:
        response = requests.post(f"{API_URL}/api/products", json=payload)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        print(f"✅ Successfully added: {payload.get('brand')} {payload.get('model')}")
    except requests.exceptions.HTTPError as e:
        print(f"❌ Error adding {payload.get('brand')} {payload.get('model')}: {e.response.text}")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

if __name__ == "__main__":
    # The list of files to import and their corresponding category name
    FILES_TO_IMPORT = {
        'panels.csv': 'panel',
        'inverters.csv': 'inverter',
        'inverter_aux.csv': 'inverter_aux',
        'battery.csv': 'battery',
        'breaker.csv': 'breaker',
        'fuses.csv': 'fuse',
        'isolators.csv': 'isolator',
        'dc_cables.csv': 'dc_cable',
    }
    
    data_dir = 'product_data'
    all_payloads = []

    for filename, category in FILES_TO_IMPORT.items():
        filepath = os.path.join(data_dir, filename)
        print(f"\nProcessing file: {filename}...")
        
        try:
            df = pd.read_csv(filepath, encoding='latin1')
            payloads_from_file = process_dataframe_for_api(df, category)
            all_payloads.extend(payloads_from_file)
            print(f"✅ Parsed {len(payloads_from_file)} products.")
        except FileNotFoundError:
            print(f"⚠️  Skipping: File not found at {filepath}")
        except Exception as e:
            print(f"❌ Error processing file {filename}: {e}")

    # Post all payloads to the API
    if all_payloads:
        print(f"\n--- Sending {len(all_payloads)} total products to the API... ---")
        for payload in all_payloads:
            post_to_api(payload)
        print("\n--- ✅ Import complete. ---")
    else:
        print("\n--- No products to import. ---")