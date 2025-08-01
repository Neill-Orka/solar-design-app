# services/simulation_engine.py
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
from pvlib.iotools import get_pvgis_tmy
import pandas as pd
import numpy as np
from models import EnergyData, Projects
import math
import os


def simulate_system_inner(project_id, panel_kw, battery_kwh, system_type, inverter_kva, allow_export, tilt, azimuth, use_pvgis=False, profile_name='Midrand Azth:east-west Tilt:5'):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return {"error": "Project not found"}
        
        if not project.latitude or not project.longitude:
            return {"error": "Project location (latitude/longitude) is required for simulation"}

        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return {"error": "No energy data found for project"}

        latitude, longitude = project.latitude, project.longitude
        
        sim_year = records[0].timestamp.year
        full_30min_index = pd.date_range(start=f'{sim_year}-01-01', end=f'{sim_year}-12-31 23:59', freq='30min', tz='Africa/Johannesburg')

        generation_kw_series = None
        
        if use_pvgis:
            if not project.latitude or not project.longitude:
                return {"error": "Project location (latitude/longitude) is required for PVGIS simulation"}

            weather_data, _, _, _ = get_pvgis_tmy(latitude, longitude, outputformat='csv', timeout=90)

            if not isinstance(weather_data, pd.DataFrame):
                raise TypeError("Failed to fetch weather data as a pandas DataFrame.")
        
            weather_data = weather_data.tz_convert('Africa/Johannesburg')

            weather_data['month'] = weather_data.index.month
            weather_data['day'] = weather_data.index.day
            weather_data['hour'] = weather_data.index.hour
            weather_data.sort_values(by=['month', 'day', 'hour'], inplace=True)
            weather_data.drop(columns=['month', 'day', 'hour'], inplace=True)

            new_hourly_index = pd.date_range(start=f"{sim_year}-01-01", periods=8760, freq='h', tz='Africa/Johannesburg')
            weather_data.set_index(new_hourly_index, inplace=True)

            # Resample to 30 minutes and interpolate to create smooth transitions
            full_30min_index = pd.date_range(start=f"{sim_year}-01-01", end=f"{sim_year}-12-31 23:30", freq='30min', tz='Africa/Johannesburg')

            weather_data_30min = weather_data.reindex(full_30min_index).interpolate(method='linear')

            # Create a ModelChain for a more accurate simulation
            site = Location(latitude, longitude, tz='Africa/Johannesburg')
            temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']

            panel_degrading_factor = 1
            degraded_panel_kw = panel_kw * panel_degrading_factor
            PANEL_WATTAGE_W = 565 # JA SOLAR 72S30-565/GR
            num_panels = math.ceil((degraded_panel_kw * 1000) / PANEL_WATTAGE_W)

            ### THIS IS FOR CEC MODEL BUT IT NEEDS MORE PARAMETERS THAT WE DO NOT HAVE
            # # PV Parameters (module paramaters) from datasheet for JA Solar JAM72S30-565/GR
            # module_parameters = {
            #     'V_mp_ref': 42.42, # Maximum Power Voltage (V)
            #     'I_mp_ref': 13.32, # Maximum Power Current (A)
            #     'V_oc_ref': 50.28, # Open Circuit Voltage (V)
            #     'I_sc_ref': 14.21, # Short Circuit Current (A)

            #     'alpha_sc': (0.045 / 100) * 14.21, # Temperature coefficient of short-circuit current (A/°C)
            #     'beta_voc': (-0.275 / 100) * 50.28, # Temperature coefficient of open-circuit voltage (V/°C)

            #     'gamma_pmp': -0.350 / 100, # Temperature coefficient of maximum power (Pmax) (%/°C)
            #     'cells_in_series': 144, # Number of cells in series
            #     'temp_ref': 25, # Reference temperature for STC
            # }

            pvwatts_module_parameters = {
                # Total DC power of the array at reference conditions
                'pdc0': degraded_panel_kw * 1000,  # Convert kW to W
                'gamma_pdc': -0.350 / 100,  # Temperature coefficient of DC power (%/°C)
            }

            # Define the PV system components
            system = PVSystem(
                surface_tilt=tilt,
                surface_azimuth=azimuth,  
                module_parameters=pvwatts_module_parameters,  # kW to W
                inverter_parameters={'pdc0': inverter_kva * 1000}, # kVA to W
                temperature_model_parameters=temperature_params,
                # modules_per_string=num_panels, ONLY IF USING CEC MODEL
                # strings_per_inverter=1
            )
            mc = ModelChain(system, site, aoi_model="no_loss")

            # Run the model against the weather data
            mc.run_model(weather_data_30min)

            # export pvlib generation profile
            try:
                # Handle both Series and DataFrame for dc results
                raw_dc_kw = None
                if isinstance(mc.results.dc, pd.DataFrame) and 'p_mp' in mc.results.dc:
                    raw_dc_kw = mc.results.dc['p_mp'].fillna(0) / 1000
                elif isinstance(mc.results.dc, pd.Series):
                    raw_dc_kw = mc.results.dc.fillna(0) / 1000

                if raw_dc_kw is not None and degraded_panel_kw > 0:
                    # calculate yield (kwh/kwp)
                    specific_yield_profile = (raw_dc_kw / degraded_panel_kw) * 100

                    # define export path
                    export_dir = "C:/Users/OrkaSolarEngineer/Documents/DesignWebApp/Load Profiles/PVlib Generation Profiles"
                    os.makedirs(export_dir, exist_ok=True)

                    sanitized_location = project.location.replace(' ', '_').replace(',', '')
                    file_name = f'{sanitized_location}_gen_profile_{project_id}_azimuth_{azimuth}_tilt_{tilt}.csv'
                    export_path = os.path.join(export_dir, file_name)


                    # save profile
                    specific_yield_profile.to_csv(export_path, index=False, header=False)
                    print(f"SUCCESS: Unconstrained PVGIS generation profile exported to: {export_path}")

            except Exception as export_exc:
                print(f'ERROR: Failed to export: {export_exc}')

            print("--- PVLIB RAW OUTPUT ---")
            if mc.results is not None and mc.results.ac is not None:
                print("Head of raw generation data (in watts):")
                print(mc.results.ac.iloc[:20])
                print(f"Number of entries in mc.results.ac: {len(mc.results.ac)}")
                print(f"Number of entries in demand dataframe: {len(records)}")
                print("\nStatistical summary of raw generation data:")
                print(mc.results.ac.describe())
            else:
                print("mc.results.ac is None. No data was generated by pvlib")
            print("---------------------------------------")

            # Get the AC generation results (in Watts) and convert to kW
            if mc.results is None or mc.results.ac is None:
                raise ValueError("PVLib ModelChain did not produce AC generation results.")
            
            generation_kw_series = mc.results.ac.fillna(0) / 1000  # Convert Watts to kW
            
        else:
            if GENERATION_PROFILE_DF.empty:
                return {"error": "Generation profile CSV could not be loaded on server startup."}
            
            if profile_name not in GENERATION_PROFILE_DF.columns:
                return {"error": f"Profile '{profile_name}' not found in generation profile data."}
            
            panel_degrading_factor = 1
            real_panel_kw = panel_degrading_factor * panel_kw
            degraded_panel_kw = real_panel_kw
            percentages = GENERATION_PROFILE_DF[profile_name].tolist()

            if len(percentages) != len(full_30min_index):
                return {"error": f"Profile length mismatch. Expected {len(full_30min_index)} entries, got {len(percentages)}."}
            
            raw_generation = [(perc / 100) * real_panel_kw for perc in percentages]
            generation_kw_series = pd.Series(raw_generation, index=full_30min_index)

            
        generation_kw_series.name = 'generation_kw'
        
        # Now, align the generated series with the actual record timestamps
        demand_values = [r.demand_kw for r in records]
        demand_kw_series = pd.Series(demand_values, index=full_30min_index, name='demand_kw')
        
        sim_df = pd.DataFrame(demand_kw_series).join(generation_kw_series).fillna(0)

        # --- 2. Run the detailed energy flow simulation ---
        demand_kw = sim_df['demand_kw'].tolist()
        generation_kw = sim_df['generation_kw'].tolist()
        
        # The "potential" generation is what the panels could make, limited by the inverter
        potential_generation_kw = pd.Series([min(gen, inverter_kva) for gen in generation_kw])

        battery_capacity_kwh = battery_kwh or 0
        battery_soc_kwh = battery_capacity_kwh
        import_from_grid, battery_soc_trace, export_to_grid = [], [], []
        time_interval_hours = 0.5

        usable_generation_kw = []
        
        for i in range(len(demand_kw)):
            gen_kwh = potential_generation_kw.iloc[i] * time_interval_hours
            demand_kwh_interval = demand_kw[i] * time_interval_hours

            # Energy flow logic (same as the robust quick_simulation)
            energy_from_pv_to_load = min(gen_kwh, demand_kwh_interval)
            remaining_load_kwh = demand_kwh_interval - energy_from_pv_to_load
            excess_gen_kwh = gen_kwh - energy_from_pv_to_load

            energy_from_pv_to_battery = 0
            if excess_gen_kwh > 0 and system_type in ['hybrid', 'off-grid']:
                charge_amount = min(excess_gen_kwh, battery_capacity_kwh - battery_soc_kwh)
                battery_soc_kwh += charge_amount
                energy_from_pv_to_battery = charge_amount
            
            export_kwh = 0
            if excess_gen_kwh - energy_from_pv_to_battery > 0 and allow_export:
                export_kwh = excess_gen_kwh - energy_from_pv_to_battery

            current_usable_gen_kwh = energy_from_pv_to_load + energy_from_pv_to_battery + export_kwh

            if remaining_load_kwh > 0 and system_type in ['hybrid', 'off-grid']:
                min_soc_limit_kwh = battery_capacity_kwh * 0.2 if system_type == 'hybrid' else 0.0
                available_discharge_kwh = max(0, battery_soc_kwh - min_soc_limit_kwh)
                discharge_amount = min(remaining_load_kwh, available_discharge_kwh)
                battery_soc_kwh -= discharge_amount
                remaining_load_kwh -= discharge_amount

            import_kwh = remaining_load_kwh if system_type != 'off-grid' else 0

            usable_generation_kw.append(current_usable_gen_kwh / time_interval_hours)
            import_from_grid.append(import_kwh / time_interval_hours)
            export_to_grid.append(export_kwh / time_interval_hours)
            battery_soc_trace.append((battery_soc_kwh / battery_capacity_kwh * 100) if battery_capacity_kwh > 0 else 0)

        return {
            "timestamps": [r.timestamp.isoformat() for r in records],
            "demand": demand_kw,
            "generation": [round(val, 2) for val in usable_generation_kw],
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid,
            "battery_soc": [round(val, 2) for val in battery_soc_trace],
            "panel_kw": degraded_panel_kw,
            "potential_generation": [round(val, 2) for val in potential_generation_kw]
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    

current_dir = os.path.dirname(os.path.abspath(__file__))
# Assumes your folder structure is: project_root/services/simulation_engine.py
project_root = os.path.abspath(os.path.join(current_dir, '..'))
csv_path = os.path.join(project_root, 'utils', 'generation_profile.csv')
try:
    GENERATION_PROFILE_DF = pd.read_csv(csv_path)
    print(f"--- SUCCESS: Loaded generation profile from: {csv_path} ---")
except FileNotFoundError:
    print(f"--- FATAL STARTUP ERROR: Could not find 'generation_profile.csv'. Searched at path: {csv_path} ---")
    GENERATION_PROFILE_DF = pd.DataFrame()

def run_quick_simulation(scaled_load_profile, panel_kw, battery_kwh, system_type, inverter_kva):
    try:
        if GENERATION_PROFILE_DF.empty:
            return {"error": "Generation profile CSV could not be loaded on server startup."}

        demand_kw = [dp['demand_kw'] for dp in scaled_load_profile]
        timestamps = [dp['timestamp'] for dp in scaled_load_profile]
        percentages = GENERATION_PROFILE_DF.iloc[:, 0].tolist()

        if len(percentages) != len(demand_kw): return {"error": f"Profile length mismatch."}
        
        panel_degrading_factor = 1
        real_panel_kw = panel_degrading_factor * panel_kw

        # inverter limiting
        raw_pv_generation_kw = pd.Series([(perc / 100) * real_panel_kw for perc in percentages])
        potential_generation_kw = pd.Series([min(gen, inverter_kva) for gen in raw_pv_generation_kw])

        battery_capacity_kwh = battery_kwh or 0
        battery_soc_kwh = battery_capacity_kwh
        import_from_grid, battery_soc_trace = [], []
        time_interval_hours = 0.5

        usable_generation_kw = []
        potential_gen_kw_for_return = []

        for i in range(len(demand_kw)):
            gen_kwh = potential_generation_kw.iloc[i] * time_interval_hours
            demand_kwh = demand_kw[i] * time_interval_hours

            # 1. PV first meets load directly
            energy_from_pv_to_load = min(gen_kwh, demand_kwh)

            # 2. Calculate remaining load and excess generation
            remaining_load_kwh = demand_kwh - energy_from_pv_to_load
            excess_gen_kwh = gen_kwh - energy_from_pv_to_load

            # 3. Excess generation charges the battery (Hybrid/Off-Grid)
            energy_from_pv_to_battery = 0
            if excess_gen_kwh > 0 and system_type in ['Hybrid', 'Off-Grid']:
                # Amount we can charge is limited by excess PV and available battery capacity
                charge_amount = min(excess_gen_kwh, battery_capacity_kwh - battery_soc_kwh)
                battery_soc_kwh += charge_amount
                energy_from_pv_to_battery = charge_amount

            # 4. Calculate the total usable generation
            # This is what went to the load plus what went to the battery
            current_usable_gen_kwh = energy_from_pv_to_load + energy_from_pv_to_battery

            # 5. If load remains, discharge battery (Hybrid/Off-Grid)
            if remaining_load_kwh > 0 and system_type in ['Hybrid', 'Off-Grid']:
                min_soc_limit_kwh = 0.0
                if system_type == 'Hybrid':
                    min_soc_limit_kwh = battery_capacity_kwh * 0.2 # 20% limit

                available_discharge_kwh = max(0, battery_soc_kwh - min_soc_limit_kwh)
                discharge_amount = min(remaining_load_kwh, available_discharge_kwh)
                battery_soc_kwh -= discharge_amount
                remaining_load_kwh -= discharge_amount

            # 6. Remaining load is imported from grid (if not Off-Grid)
            import_kwh = remaining_load_kwh if remaining_load_kwh > 0 and system_type != 'Off-Grid' else 0

            # 7. Append results and convert back to kW
            usable_generation_kw.append(current_usable_gen_kwh / time_interval_hours)
            potential_gen_kw_for_return.append(gen_kwh / time_interval_hours)
            import_from_grid.append(import_kwh / time_interval_hours)
            battery_soc_trace.append((battery_soc_kwh / battery_capacity_kwh * 100) if battery_capacity_kwh > 0 else 0)
        
        return {
            "timestamps": timestamps,
            "demand": demand_kw,
            "generation": [round(val, 2) for val in usable_generation_kw],
            "import_from_grid": import_from_grid,
            "export_to_grid": [0] * len(demand_kw), # Always return a list of zeros for consistency
            "battery_soc": [round(val, 2) for val in battery_soc_trace],
            "panel_kw": real_panel_kw,
            "potential_generation": [round(val, 2) for val in potential_gen_kw_for_return]
        }
    except Exception as e: return {"error": str(e)}