import os
import pandas as pd
import sqlalchemy as sa
from sqlalchemy import create_engine
from dotenv import load_dotenv

def import_tariffs():
    """
    Reads tariff data from CSV files and populates the tariffs and tariff_rates tables,
    overwriting any existing data.
    """
    load_dotenv()  # Load environment variables from a .env file

    # 1. --- Database Connection ---
    # Get your database connection string from the .env file
    database_uri = os.getenv("DATABASE_URI")
    if not database_uri:
        raise ValueError("DATABASE_URI not found in environment variables. Please set it in your .env file.")
    
    engine = create_engine(database_uri)

    # 2. --- Define Table Schemas ---
    # Define the structure of your tables using SQLAlchemy Core
    tariffs_table = sa.table('tariffs',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('power_user_type', sa.String),
        sa.column('tariff_category', sa.String),
        sa.column('code', sa.String),
        sa.column('matrix_code', sa.String),
        sa.column('structure', sa.String),
        # TODO: Add your new columns here, for example:
        # sa.column('new_column_name', sa.String),
    )

    tariff_rates_table = sa.table('tariff_rates',
        sa.column('id', sa.Integer),
        sa.column('tariff_id', sa.Integer),
        sa.column('charge_name', sa.String),
        sa.column('charge_category', sa.String),
        sa.column('season', sa.String),
        sa.column('time_of_use', sa.String),
        sa.column('rate_unit', sa.String),
        sa.column('rate_value', sa.Float),
        sa.column('block_threshold_kwh', sa.Integer),
    )

    # Use a transaction to ensure the operation is atomic (all or nothing)
    with engine.connect() as conn:
        with conn.begin() as transaction:
            try:
                print("Clearing existing tariff data...")
                # Clear existing data before import
                conn.execute(tariff_rates_table.delete())
                conn.execute(tariffs_table.delete())

                # 3. --- SPU Data Import Logic ---
                print("Processing SPU tariffs...")
                spu_filepath = os.path.join(os.path.dirname(__file__), 'Data/SPU_2025.csv')
                df_spu = pd.read_csv(spu_filepath)
                df_spu.fillna(0, inplace=True)

                for _, row in df_spu.iterrows():
                    tariff_data = {
                        'name': row['Tariff'],
                        'power_user_type': 'SPU',
                        'tariff_category': row['Tariff Category'],
                        'code': row['Code'],
                        'matrix_code': row['Matrix Code'],
                        # TODO: Add values for your new columns here, for example:
                        # 'new_column_name': row['New CSV Column Name'],
                    }
                    
                    rates_to_insert = []

                    # Determine tariff structure (Flat, Tiered, or TOU)
                    if row.get('Energy Charge [c/kWh]', 0) != 0:
                        tariff_data['structure'] = 'flat_rate'
                        rates_to_insert.append({'charge_name': 'Energy Charge', 'charge_category': 'energy', 'season': 'all', 'time_of_use': 'all', 'rate_unit': 'c/kWh', 'rate_value': row['Energy Charge [c/kWh]'], 'block_threshold_kwh': None})
                    elif row.get('Energy Charge Block 1 [c/kWh]', 0) != 0:
                        tariff_data['structure'] = 'tiered'
                        rates_to_insert.append({'charge_name': 'Energy Charge', 'charge_category': 'energy', 'season': 'all', 'time_of_use': 'all', 'rate_unit': 'c/kWh', 'rate_value': row['Energy Charge Block 1 [c/kWh]'], 'block_threshold_kwh': 600})
                        if row.get('Energy Charge Block 2 [c/kWh]', 0) != 0:
                            rates_to_insert.append({'charge_name': 'Energy Charge', 'charge_category': 'energy', 'season': 'all', 'time_of_use': 'all', 'rate_unit': 'c/kWh', 'rate_value': row['Energy Charge Block 2 [c/kWh]'], 'block_threshold_kwh': None})
                    else:
                        tariff_data['structure'] = 'time_of_use'
                        tou_map = {'High-Peak': ('high', 'peak'), 'High-Standard': ('high', 'standard'), 'High-Off Peak': ('high', 'off_peak'), 'Low-Peak': ('low', 'peak'), 'Low-Standard': ('low', 'standard'), 'Low-Off Peak': ('low', 'off_peak')}
                        for col, (season, tou) in tou_map.items():
                            if row.get(col, 0) != 0:
                                rates_to_insert.append({'charge_name': 'Energy Charge', 'charge_category': 'energy', 'season': season, 'time_of_use': tou, 'rate_unit': 'c/kWh', 'rate_value': row[col], 'block_threshold_kwh': None})

                    # Add other fixed charges for SPU
                    other_charges_map = {
                        'Service and Administration Charge [R/POD/day]': ('Service and Administration Charge', 'fixed', 'R/POD/day'),
                        'Network Capacity Charge [R/POD/day]': ('Network Capacity Charge', 'fixed', 'R/POD/day'),
                        'Ancillary Service Charge [c/kWh]': ('Ancillary Service Charge', 'energy', 'c/kWh'),
                        'Network Demand Charge [c/kWh]': ('Network Demand Charge', 'energy', 'c/kWh'),
                        'Electrification and rural subsidy [c/kWh]': ('Electrification and Rural Subsidy', 'energy', 'c/kWh'),
                        'Generation capacity charge [R/POD/day]': ('Generation Capacity Charge', 'fixed', 'R/POD/day'),
                        'Legacy charge [c/kWh]': ('Legacy Charge', 'energy', 'c/kWh'),
                    }
                    for col, (name, cat, unit) in other_charges_map.items():
                        if row.get(col, 0) != 0:
                            rates_to_insert.append({'charge_name': name, 'charge_category': cat, 'rate_unit': unit, 'rate_value': row[col], 'season': 'all', 'time_of_use': 'all', 'block_threshold_kwh': None})

                    # Insert the main tariff record and get its new ID
                    result = conn.execute(tariffs_table.insert().values(tariff_data).returning(tariffs_table.c.id))
                    tariff_id = result.fetchone()[0]

                    # Assign the new tariff_id to all its rates and bulk insert them
                    for rate in rates_to_insert:
                        rate['tariff_id'] = tariff_id
                    if rates_to_insert:
                        conn.execute(tariff_rates_table.insert(), rates_to_insert)

                # 4. --- LPU Data Import Logic ---
                print("Processing LPU tariffs...")
                lpu_filepath = os.path.join(os.path.dirname(__file__), 'Data/LPU_2025.csv')
                df_lpu = pd.read_csv(lpu_filepath)
                df_lpu.fillna(0, inplace=True)

                for _, row in df_lpu.iterrows():
                    tariff_data = {
                        'name': row['Tariff'],
                        'power_user_type': 'LPU',
                        'tariff_category': row['Tariff Category'],
                        'code': row['Code'],
                        'matrix_code': row['Matrix Code'],
                        'structure': 'time_of_use_demand' # LPU tariffs are demand-based
                        # TODO: Add values for your new columns here
                    }

                    rates_to_insert = []
                    
                    # LPU Demand Charges
                    demand_map = {
                        'High Demand [R/kVA/month]': ('Demand Charge', 'high', 'R/kVA/month'),
                        'Low Demand [R/kVA/month]': ('Demand Charge', 'low', 'R/kVA/month'),
                        'Transmission Network Charges [R/kVA/month]': ('Transmission Network Charges', 'all', 'R/kVA/month'),
                        'Network Access Charges [R/kVA/month]': ('Network Access Charges', 'all', 'R/kVA/month'),
                        'Generation Capacity Charge [R/kVA]': ('Generation Capacity Charge', 'all', 'R/kVA/month'),
                    }
                    for col, (name, season, unit) in demand_map.items():
                        if row.get(col, 0) != 0:
                            rates_to_insert.append({'charge_name': name, 'charge_category': 'demand', 'season': season, 'time_of_use': 'all', 'rate_unit': unit, 'rate_value': row[col], 'block_threshold_kwh': None})

                    # LPU Energy Charges
                    energy_map = {
                        'High-Peak': ('Energy Charge', 'high', 'peak'),
                        'High-Standard': ('Energy Charge', 'high', 'standard'),
                        'High-Off Peak': ('Energy Charge', 'high', 'off_peak'),
                        'Low-Peak': ('Energy Charge', 'low', 'peak'),
                        'Low-Standard': ('Energy Charge', 'low', 'standard'),
                        'Low-Off Peak': ('Energy Charge', 'low', 'off_peak')
                    }
                    for col, (name, season, tou) in energy_map.items():
                        if row.get(col, 0) != 0:
                            rates_to_insert.append({'charge_name': name, 'charge_category': 'energy', 'season': season, 'time_of_use': tou, 'rate_unit': 'c/kWh', 'rate_value': row[col], 'block_threshold_kwh': None})

                    # Insert the main tariff and get its ID
                    result = conn.execute(tariffs_table.insert().values(tariff_data).returning(tariffs_table.c.id))
                    tariff_id = result.fetchone()[0]

                    for rate in rates_to_insert:
                        rate['tariff_id'] = tariff_id
                    if rates_to_insert:
                        conn.execute(tariff_rates_table.insert(), rates_to_insert)
                
                # The 'with' block will automatically commit the transaction here if successful
                print("Tariff import completed successfully!")

            except Exception as e:
                # If any error occurs, the transaction is rolled back
                print(f"An error occurred: {e}")
                transaction.rollback()
                raise

# Make the script executable
if __name__ == '__main__':
    import_tariffs()