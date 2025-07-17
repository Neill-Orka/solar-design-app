import pandas as pd
import os
import numpy as np
from app import app, db
from models import ProductTest

# --- The clean_value and clean_price functions are unchanged ---
def clean_value(value):
    if pd.isna(value) or value is None or str(value).strip() == '': return None
    if isinstance(value, str): value = value.strip()
    try:
        if float(value) == int(float(value)): return int(float(value))
    except (ValueError, TypeError): pass
    try:
        return float(value)
    except (ValueError, TypeError): pass
    return str(value)

def clean_price(value):
    if pd.isna(value) or value is None: return None
    price_str = str(value).replace('R', '').replace(' ', '').replace(',', '')
    try:
        return float(price_str)
    except (ValueError, TypeError): return None

# This single mapping now defines all possible columns.
# The script will only use the columns it finds in each specific CSV file.
COLUMN_MAP = {
    'Brand Name': 'brand',
    'Brandname': 'brand', # Handles variation in header
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

def process_dataframe(df, category):
    """Processes an entire DataFrame for a given category."""
    new_products = []
    for _, row in df.iterrows():
        payload = {'properties': {}}
        
        # This loop now robustly handles missing columns
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
        new_products.append(ProductTest(**payload))
        
    return new_products

if __name__ == "__main__":
    # Define the list of files to import and their corresponding category name
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
    all_new_products = []

    with app.app_context():
        try:
            ProductTest.query.delete()
            print("Cleared existing data from products_test table.")

            for filename, category in FILES_TO_IMPORT.items():
                filepath = os.path.join(data_dir, filename)
                print(f"\nProcessing file: {filename}...")
                
                try:
                    df = pd.read_csv(filepath, encoding='latin1')
                    products_from_file = process_dataframe(df, category)
                    all_new_products.extend(products_from_file)
                    print(f"✅ Staged {len(products_from_file)} products.")
                except FileNotFoundError:
                    print(f"⚠️  Skipping: File not found at {filepath}")
                    continue
                except Exception as e:
                    print(f"❌ Error processing file {filename}: {e}")

            # Commit all staged products to the database in one transaction
            if all_new_products:
                db.session.add_all(all_new_products)
                db.session.commit()
                print(f"\n--- ✅ Import complete. {len(all_new_products)} total products committed. ---")
            else:
                print("\n--- No products were imported. ---")

        except Exception as e:
            db.session.rollback()
            print(f"\n--- ❌ A database error occurred. Rolled back changes. Error: {e} ---")
            import traceback
            traceback.print_exc()