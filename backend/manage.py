import pandas as pd
import click
from flask.cli import with_appcontext
from app import app, db  # Assuming your Flask app instance is in app.py
from models import Tariffs, TariffRates # Import our new models

def process_spu_file(filepath):
    """
    Reads the cleaned SPU CSV file and populates the database,
    applying the correct logic for flat, TOU, and tiered rates.
    """
    try:
        df = pd.read_csv(filepath)
        # Replace NaN values with 0 to make checks easier, but handle original zeros correctly.
        df.fillna(0, inplace=True)
    except FileNotFoundError:
        print(f"Error: The file was not found at {filepath}")
        return

    for _, row in df.iterrows():
        # --- Create the main Tariff object ---
        # The structure is determined by the logic below
        new_tariff = Tariffs(
            name=row['Tariff'],
            power_user_type='SPU',
            tariff_category=row['Tariff Category'],
            code=row['Code'],
            matrix_code=row['Matrix Code']
        )
        
        # --- Business Rule 1: Check for a Flat Rate first ---
        flat_rate_energy = row.get('Energy Charge [c/kWh]')
        if flat_rate_energy and flat_rate_energy != 0:
            new_tariff.structure = 'flat_rate'
            db.session.add(new_tariff)
            db.session.flush() # Get the ID for the new tariff

            # Create the single energy rate for this flat tariff
            db.session.add(TariffRates(
                tariff_id=new_tariff.id,
                charge_name='Energy Charge',
                charge_category='energy',
                season='all',
                time_of_use='all',
                rate_unit='c/kWh',
                rate_value=flat_rate_energy
            ))

        # --- Business Rule 2: Handle Tiered or TOU rates if not a Flat Rate ---
        else:
            # Check for Tiered structure
            block_1_rate = row.get('Energy Charge Block 1 [c/kWh]')
            if block_1_rate and block_1_rate != 0:
                new_tariff.structure = 'tiered'
                db.session.add(new_tariff)
                db.session.flush()
                
                # Add Block 1 Rate (ASSUMPTION: Threshold is 600 kWh)
                db.session.add(TariffRates(tariff_id=new_tariff.id, charge_name='Energy Charge', charge_category='energy', rate_unit='c/kWh', rate_value=block_1_rate, block_threshold_kwh=600))
                
                # Add Block 2 Rate if it exists
                block_2_rate = row.get('Energy Charge Block 2 [c/kWh]')
                if block_2_rate and block_2_rate != 0:
                    db.session.add(TariffRates(tariff_id=new_tariff.id, charge_name='Energy Charge', charge_category='energy', rate_unit='c/kWh', rate_value=block_2_rate))

            # Fallback to TOU structure
            else:
                new_tariff.structure = 'time_of_use'
                db.session.add(new_tariff)
                db.session.flush()
                
                # Add all applicable TOU rates, checking for non-zero values
                tou_rates = {
                    ('high', 'peak'): row.get('High-Peak'), ('high', 'standard'): row.get('High-Standard'), ('high', 'off_peak'): row.get('High-Off Peak'),
                    ('low', 'peak'): row.get('Low-Peak'), ('low', 'standard'): row.get('Low-Standard'), ('low', 'off_peak'): row.get('Low-Off Peak')
                }
                for (season, tou), rate in tou_rates.items():
                    if rate and rate != 0:
                        db.session.add(TariffRates(tariff_id=new_tariff.id, charge_name='Energy Charge', charge_category='energy', season=season, time_of_use=tou, rate_unit='c/kWh', rate_value=rate))

        # --- Add all other fixed and ancillary charges (for all tariff structures) ---
        # Using .get(column, 0) safely handles missing columns, and we check for non-zero.
        other_charges = {
            ('Service and Administration Charge', 'fixed', 'R/POD/day'): row.get('Service and Administration Charge [R/POD/day]', 0),
            ('Network Capacity Charge', 'fixed', 'R/POD/day'): row.get('Network Capacity Charge [R/POD/day]', 0),
            ('Ancillary Service Charge', 'energy', 'c/kWh'): row.get('Ancillary Service Charge [c/kWh]', 0),
            ('Network Demand Charge', 'energy', 'c/kWh'): row.get('Network Demand Charge [c/kWh]', 0)
        }

        for (name, category, unit), rate in other_charges.items():
            if rate and rate != 0:
                db.session.add(TariffRates(tariff_id=new_tariff.id, charge_name=name, charge_category=category, rate_unit=unit, rate_value=rate))

    print(f"Processed {len(df)} SPU tariffs from {filepath}")


# --- Helper function to process the LPU data ---
def process_lpu_file(filepath):
    """
    Reads the cleaned LPU CSV file and populates the database.
    It correctly handles the multiple, specific demand and TOU energy charges.
    """
    try:
        df = pd.read_csv(filepath)
        # Replace NaN/blank values with 0 to make checks easier
        df.fillna(0, inplace=True)
    except FileNotFoundError:
        print(f"Error: The file was not found at {filepath}")
        return

    for _, row in df.iterrows():
        # --- 1. Create the main Tariff object for the entire row ---
        new_tariff = Tariffs(
            name=row['Tariff'],
            power_user_type='LPU',
            tariff_category=row['Tariff Category'],
            transmission_zone=row['Transmission Zone'],
            supply_voltage=row['Supply Voltage'],
            code=row['Code'],
            matrix_code=row['Matrix Code'],
            structure='time_of_use' # LPU tariffs are all Time-of-Use
        )
        db.session.add(new_tariff)
        db.session.flush() # Flush to get the ID for the new_tariff before creating rates

        # --- 2. Process all Demand/Fixed charges ---
        # A list defines all possible demand/fixed charge columns and their properties
        demand_charges = [
            {'col': 'High Demand [R/kVA/m]', 'name': 'Demand Charge', 'season': 'high', 'unit': 'R/kVA/m'},
            {'col': 'Low Demand [R/kVA/m]', 'name': 'Demand Charge', 'season': 'low', 'unit': 'R/kVA/m'},
            {'col': 'Transmission Network Charges [R/kVA/m]', 'name': 'Transmission Network Charges', 'season': 'all', 'unit': 'R/kVA/m'},
            {'col': 'Network Access Charges [R/kVA/m]', 'name': 'Network Access Charges', 'season': 'all', 'unit': 'R/kVA/m'}
        ]

        for charge in demand_charges:
            rate_value = row.get(charge['col'])
            if rate_value and rate_value != 0:
                db.session.add(TariffRates(
                    tariff_id=new_tariff.id,
                    charge_name=charge['name'],
                    charge_category='demand',
                    season=charge['season'],
                    rate_unit=charge['unit'],
                    rate_value=rate_value
                ))

        # --- 3. Process all Energy charges (TOU and other) ---
        # A list defines all possible energy-based charges
        energy_charges = [
            # Standard TOU charges
            {'col': 'High-Peak [c/kWh]', 'season': 'high', 'tou': 'peak'},
            {'col': 'High-Standard [c/kWh]', 'season': 'high', 'tou': 'standard'},
            {'col': 'High-Off Peak [c/kWh]', 'season': 'high', 'tou': 'off_peak'},
            {'col': 'Low-Peak [c/kWh]', 'season': 'low', 'tou': 'peak'},
            {'col': 'Low-Standard [c/kWh]', 'season': 'low', 'tou': 'standard'},
            {'col': 'Low-Off Peak [c/kWh]', 'season': 'low', 'tou': 'off_peak'},
            # Other energy-based demand charges
            {'col': 'High Demand [c/kWh]', 'name': 'Demand Charge (Energy)', 'season': 'high', 'tou': 'all'},
            {'col': 'Low Demand [c/kWh]', 'name': 'Demand Charge (Energy)', 'season': 'low', 'tou': 'all'}
        ]

        for charge in energy_charges:
            rate_value = row.get(charge['col'])
            if rate_value and rate_value != 0:
                db.session.add(TariffRates(
                    tariff_id=new_tariff.id,
                    charge_name=charge.get('name', 'Energy Charge'), # Default to 'Energy Charge' for TOU
                    charge_category='energy',
                    season=charge['season'],
                    time_of_use=charge.get('tou', 'all'),
                    rate_unit='c/kWh',
                    rate_value=rate_value
                ))

    print(f"Processed {len(df)} LPU tariffs from {filepath}")


# --- The CLI Command Definition ---
@app.cli.command("import-tariffs")
@click.argument("spu_filepath")
@click.argument("lpu_filepath")
def import_tariffs(spu_filepath, lpu_filepath):
    """
    Imports tariff data from SPU and LPU CSV files into the database.
    Deletes all existing tariff data before importing.
    """
    try:
        print("Deleting existing tariff data...")
        db.session.query(TariffRates).delete()
        db.session.query(Tariffs).delete()
        
        print("Importing SPU tariffs...")
        process_spu_file(spu_filepath)
        
        print("Importing LPU tariffs...")
        process_lpu_file(lpu_filepath)
        
        db.session.commit()
        print("Successfully imported all tariffs!")
    except Exception as e:
        db.session.rollback()
        print(f"An error occurred: {e}")
        print("Rolled back database changes.")