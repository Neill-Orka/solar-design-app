"""Populate initial tariff data

Revision ID: 85c5f148d4d9
Revises: 8dcc50f02623
Create Date: 2025-07-09 12:27:33.640443

"""
from alembic import op
import sqlalchemy as sa
import pandas as pd
import os

# revision identifiers, used by Alembic.
revision = '85c5f148d4d9'
down_revision = '8dcc50f02623'
branch_labels = None
depends_on = None

def upgrade():
    """
    This function is executed by 'flask db upgrade'.
    It reads the CSV files and populates the tariff tables, ensuring every
    rate dictionary has a consistent structure to prevent errors.
    """
    # Get the current database connection
    conn = op.get_bind()

    # Define table schemas for bulk inserting data
    tariffs_table = sa.table('tariffs',
        sa.column('id', sa.Integer), sa.column('name', sa.String), sa.column('power_user_type', sa.String),
        sa.column('tariff_category', sa.String), sa.column('code', sa.String), sa.column('matrix_code', sa.String),
        sa.column('structure', sa.String), sa.column('transmission_zone', sa.String), sa.column('supply_voltage', sa.String)
    )
    rates_table = sa.table('tariff_rates',
        sa.column('tariff_id', sa.Integer), sa.column('charge_name', sa.String), sa.column('charge_category', sa.String),
        sa.column('season', sa.String), sa.column('time_of_use', sa.String), sa.column('rate_unit', sa.String),
        sa.column('rate_value', sa.Numeric), sa.column('block_threshold_kwh', sa.Numeric)
    )

    # --- SPU Data Import Logic ---
    try:
        spu_filepath = os.path.join(os.path.dirname(__file__), '../../Data/SPU_2025.csv')
        df_spu = pd.read_csv(spu_filepath)
        df_spu.fillna(0, inplace=True)
        print("Processing SPU tariffs...")

        for _, row in df_spu.iterrows():
            tariff_data = {
                'name': row['Tariff'], 'power_user_type': 'SPU', 'tariff_category': row['Tariff Category'],
                'code': row['Code'], 'matrix_code': row['Matrix Code']
            }
            rates_to_insert = []
            
            # Logic for Flat, Tiered, or TOU structure
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
            
            result = conn.execute(tariffs_table.insert().values(tariff_data).returning(tariffs_table.c.id))
            tariff_id = result.fetchone()[0]

            other_charges_map = {'Service and Administration Charge [R/POD/day]': ('Service and Administration Charge', 'fixed', 'R/POD/day'), 'Network Capacity Charge [R/POD/day]': ('Network Capacity Charge', 'fixed', 'R/POD/day'), 'Ancillary Service Charge [c/kWh]': ('Ancillary Service Charge', 'energy', 'c/kWh'), 'Network Demand Charge [c/kWh]': ('Network Demand Charge', 'energy', 'c/kWh')}
            for col, (name, cat, unit) in other_charges_map.items():
                if row.get(col, 0) != 0:
                    rates_to_insert.append({'charge_name': name, 'charge_category': cat, 'rate_unit': unit, 'rate_value': row[col], 'season': 'all', 'time_of_use': 'all', 'block_threshold_kwh': None})
            
            for rate in rates_to_insert:
                rate['tariff_id'] = tariff_id
            
            if rates_to_insert:
                op.bulk_insert(rates_table, rates_to_insert)

    except Exception as e:
        print(f"Error processing SPU file: {e}")
        raise

    # --- LPU Data Import Logic ---
    try:
        lpu_filepath = os.path.join(os.path.dirname(__file__), '../../Data/LPU_2025.csv')
        df_lpu = pd.read_csv(lpu_filepath)
        df_lpu.fillna(0, inplace=True)
        print("Processing LPU tariffs...")

        for _, row in df_lpu.iterrows():
            tariff_data = {
                'name': row['Tariff'], 'power_user_type': 'LPU', 'tariff_category': row['Tariff Category'],
                'transmission_zone': row['Transmission Zone'], 'supply_voltage': row['Supply Voltage'],
                'code': row['Code'], 'matrix_code': row['Matrix Code'], 'structure': 'time_of_use'
            }
            result = conn.execute(tariffs_table.insert().values(tariff_data).returning(tariffs_table.c.id))
            tariff_id = result.fetchone()[0]

            rates_to_insert = []
            
            demand_map = {'High Demand [R/kVA/month]': ('Demand Charge', 'high', 'R/kVA/month'), 'Low Demand [R/kVA/month]': ('Demand Charge', 'low', 'R/kVA/month'), 'Transmission Network Charges [R/kVA/month]': ('Transmission Network Charges', 'all', 'R/kVA/month'), 'Network Access Charges [R/kVA/month]': ('Network Access Charges', 'all', 'R/kVA/month')}
            for col, (name, season, unit) in demand_map.items():
                if row.get(col, 0) != 0:
                    rates_to_insert.append({'charge_name': name, 'charge_category': 'demand', 'season': season, 'time_of_use': 'all', 'rate_unit': unit, 'rate_value': row[col], 'block_threshold_kwh': None})
            
            energy_map = {'High-Peak': ('high', 'peak'), 'High-Standard': ('high', 'standard'), 'High-Off Peak': ('high', 'off_peak'), 'Low-Peak': ('low', 'peak'), 'Low-Standard': ('low', 'standard'), 'Low-Off Peak': ('low', 'off_peak'), 'High Demand [c/kWh]': ('Demand Charge (Energy)', 'high'), 'Low Demand [c/kWh]': ('Demand Charge (Energy)', 'low')}
            for col, props in energy_map.items():
                if row.get(col, 0) != 0:
                    # Correctly handle tuples of different lengths
                    charge_name = props[0] if len(props) > 1 and isinstance(props[0], str) else 'Energy Charge'
                    season = props[1] if len(props) > 1 else props[0]
                    tou = props[2] if len(props) > 2 else 'all'
                    rates_to_insert.append({'charge_name': charge_name, 'charge_category': 'energy', 'season': season, 'time_of_use': tou, 'rate_unit': 'c/kWh', 'rate_value': row[col], 'block_threshold_kwh': None})

            for rate in rates_to_insert:
                rate['tariff_id'] = tariff_id
            
            if rates_to_insert:
                op.bulk_insert(rates_table, rates_to_insert)

    except Exception as e:
        print(f"Error processing LPU file: {e}")
        raise
        
    print("Data import migration finished successfully.")


def downgrade():
    """
    This function is executed by 'flask db downgrade'.
    It removes all the data that was added by this migration.
    """
    print("Removing initial tariff data...")
    # A simple way to delete is to remove all tariffs linked to a known supplier from the files.
    op.execute("DELETE FROM tariff_rates WHERE tariff_id IN (SELECT id FROM tariffs WHERE power_user_type IN ('SPU', 'LPU'));")
    op.execute("DELETE FROM tariffs WHERE power_user_type IN ('SPU', 'LPU');")
    print("Tariff data removed.")

