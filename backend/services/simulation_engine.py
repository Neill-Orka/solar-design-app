# services/simulation_engine.py
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
from pvlib.iotools import get_pvgis_tmy
import pandas as pd
import numpy as np
from models import EnergyData
import logging
import os


def simulate_system_inner(project_id, panel_kw, battery_kwh, system_type, inverter_kva, allow_export):
    try:
        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return {"error": "No energy data found for project"}
        
        print(f"Number of EnergyData records found: {len(records)}")

        latitude, longitude = -26.71085739284715, 27.081064165934936  # Johannesburg area

        demand_kw = [r.demand_kw for r in records]
        timestamps = [r.timestamp for r in records]

        times = pd.to_datetime(timestamps).tz_localize('Africa/Johannesburg')

        # APPROACH 1: Using generation profile from CSV
        profile_df = pd.read_csv('utils/generation_profile.csv', header=None)
        percentages = profile_df.iloc[:, 0].tolist()

        # add logging to inspect the data
        logging.info(f"Loaded generation profile with {len(percentages)} entries")
        logging.debug(f"first 10 percentages: {percentages[:10]}")
        logging.debug(f"last 10 percentages: {percentages[-10:]}")
        logging.info(f"Average percentage: {sum(percentages) / len(percentages):.2f}%")
        if any(perc < 0 or perc > 100 for perc in percentages):
            logging.warning("Generation profile contains percentages outside 0-100% range")
        if any(pd.isna(perc) for perc in percentages):
            logging.warning("Generation profile contains NaN values")
        print(f"Loaded generation profile with {len(percentages)} entries")


        # Check if profile length matches the number of records
        if len(percentages) != len(records):
            return {"error": "Generation profile length does not match number of records"}
        
        # Convert percentages to generation values
        peak_generation_kw = panel_kw # peak capacity from project
        generation_kw = pd.Series([(perc / 100) * peak_generation_kw * 0.9 for perc in percentages])

        # APPROACH 2: Using PVGIS TMY data (commented out for now)

        # # Fetch TMY data from PVGIS (European database with global coverage)
        # weather_data, _, _, _ = get_pvgis_tmy(latitude, longitude, outputformat='csv', 
        #                                      userhorizon=True, startyear=2005, endyear=2020)
        
        # # Ensure index is datetime and can be accessed properly
        # weather_data.index = pd.to_datetime(weather_data.index)
        
        # # Map the TMY data to our timestamps
        # times = pd.to_datetime([r.timestamp for r in records]).tz_localize('Africa/Johannesburg')
        
        # # Create a weather DataFrame matching our timestamps
        # columns_needed = ['ghi', 'dni', 'dhi', 'temp_air', 'wind_speed']
        # weather_subset = pd.DataFrame(index=times, columns=columns_needed)
        
        # # Map PVGIS column names to pvlib expected names
        # mapping = {
        #     'G(h)': 'ghi',      # Global horizontal irradiance (W/m2)
        #     'Gb(n)': 'dni',     # Direct normal irradiance (W/m2)
        #     'Gd(h)': 'dhi',     # Diffuse horizontal irradiance (W/m2)
        #     'T2m': 'temp_air',  # 2m air temperature (°C)
        #     'WS10m': 'wind_speed'  # 10m wind speed (m/s)
        # }
        
        # # Create a copy with renamed columns for easier access
        # renamed_weather = weather_data.rename(columns=mapping)
        
        # # Match weather data to our timestamps using month, day, hour
        # for i, timestamp in enumerate(times):
        #     # Extract time components manually from timestamp object
        #     month = timestamp.month
        #     day = timestamp.day
        #     hour = timestamp.hour
        #     minute = 30 if timestamp.minute >= 30 else 0
            
        #     # Find matching weather data
        #     matches = renamed_weather[
        #         (renamed_weather.index.month == month) &
        #         (renamed_weather.index.day == day) &
        #         (renamed_weather.index.hour == hour) &
        #         (renamed_weather.index.minute == minute)
        #     ]
            
        #     # If we found a match, use it
        #     if not matches.empty:
        #         for col in columns_needed:
        #             if col in renamed_weather.columns:
        #                 weather_subset.loc[timestamp, col] = matches.iloc[0].get(col, 0)
        #     else:
        #         # Fill with zeros if no match found
        #         for col in columns_needed:
        #             weather_subset.loc[timestamp, col] = 0
        
        # # Fill any NaN values with zeros
        # weather_subset = weather_subset.fillna(0)
        
        # # Ensure weather_subset index has timezone
        # weather_subset.index = pd.DatetimeIndex(weather_subset.index)
        
        # site = Location(latitude, longitude, tz='Africa/Johannesburg')
        
        # temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']
        # system = PVSystem(
        #     surface_tilt=15,
        #     surface_azimuth=14,  # 0=N, 90=E, 180=S, 270=W
        #     module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
        #     inverter_parameters={'pdc0': inverter_kva * 1000},
        #     temperature_model_parameters=temperature_params,
        #     racking_model='open_rack',
        #     module_type='glass_glass'
        # )
        
        # # Use ModelChain with weather data instead of clearsky
        # mc = ModelChain(system, site, aoi_model='no_loss', spectral_model='no_loss', losses_model='no_loss')
        # mc.run_model(clearsky)

        # if mc.results.ac is not None:
        #     generation_kw = mc.results.ac.fillna(0) / 1000  # kW
        # else:
        #     generation_kw = pd.Series([0] * len(records))
        # demand_kw = [r.demand_kw for r in records]

        battery_max = (battery_kwh or 0) * 1000
        battery_soc = 0
        soc_trace, import_from_grid, export_to_grid = [], [], []

        for i in range(len(demand_kw)):
            gen = generation_kw.iloc[i] if hasattr(generation_kw, 'iloc') else generation_kw[i]
            demand = demand_kw[i]
            time_diff = (times[i] - times[i-1]).total_seconds() / 3600 if i > 0 else 0.5  # in 30 min intervals

            net = gen - demand
            
            if system_type in ['hybrid', 'off-grid'] and battery_max > 0:
                battery_soc += net * 1000 * time_diff
                battery_soc = max(0, min(battery_soc, battery_max))
            else:
                battery_soc = 0

            soc_trace.append(round(battery_soc / battery_max * 100, 2) if battery_max > 0 else 0)

            if allow_export:
                actual_gen = min(gen, inverter_kva) # limited by inverter size
                export_kw = max(0, actual_gen - demand)
                pv_used = actual_gen
            else:
                actual_gen = min(gen, inverter_kva, demand)
                export_kw = 0
                pv_used = actual_gen

            net = pv_used - demand

            import_kw = max(0, -net) if system_type != 'off-grid' else 0

            import_from_grid.append(import_kw)
            export_to_grid.append(export_kw)

        # Create result dictionary with both actual generation and potential generation
        generation_list = []
        potential_generation_list = []

        for i in range(len(demand_kw)):
            gen = generation_kw.iloc[i] if hasattr(generation_kw, 'iloc') else generation_kw[i]

            # Potential generation is limited by inverter size
            potential = min(gen, inverter_kva)
            potential_generation_list.append(round(potential, 2))

            # Actual generation is limited by inverter size and demand
            if system_type in ['hybrid', 'off-grid'] or allow_export:
                actual = min(gen, inverter_kva)
            else:
                actual = min(gen, inverter_kva, demand_kw[i])
            generation_list.append(round(actual, 2))

        return {
            "timestamps": [r.timestamp.isoformat() for r in records],
            "demand": demand_kw,
            "generation": list(pd.Series([min(generation_kw.iloc[i], inverter_kva) if (system_type in ['hybrid', 'off-grid'] or allow_export) 
                                          else min(generation_kw.iloc[i], inverter_kva, demand_kw[i])
                                          for i in range(len(demand_kw))]).round(2)),
            # uncapped potential generation (limited by inverter size)
            "potential_generation": list(pd.Series([min(generation_kw.iloc[i], inverter_kva) for i in range(len(demand_kw))]).round(2)),
            "battery_soc": soc_trace,
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid
        }

    except Exception as e:
        return {"error": str(e)}

current_dir = os.path.dirname(os.path.abspath(__file__))
# Assumes your folder structure is: project_root/services/simulation_engine.py
project_root = os.path.abspath(os.path.join(current_dir, '..'))
csv_path = os.path.join(project_root, 'utils', 'generation_profile.csv')
try:
    GENERATION_PROFILE_DF = pd.read_csv(csv_path, header=None)
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
        
        panel_degrading_factor = 0.9
        real_panel_kw = panel_degrading_factor * panel_kw

        # inverter limiting
        raw_pv_generation_kw = pd.Series([(perc / 100) * real_panel_kw * 0.9 for perc in percentages])
        potential_generation_kw = pd.Series([min(gen, inverter_kva) for gen in raw_pv_generation_kw])

        battery_capacity_kwh = battery_kwh or 0
        battery_soc_kwh = battery_capacity_kwh
        import_from_grid, battery_soc_trace = [], []
        time_interval_hours = 0.5

        usable_generation_kw = []
        potential_gen_kw = []

        for i in range(len(demand_kw)):
            gen_kwh, demand_kwh = potential_generation_kw.iloc[i] * time_interval_hours, demand_kw[i] * time_interval_hours

            current_usable_gen_kwh = 0
            if system_type == "Grid-Tied":
                current_usable_gen_kwh = min(gen_kwh, demand_kwh)
            else:
                current_usable_gen_kwh = gen_kwh

            usable_generation_kw.append(current_usable_gen_kwh / time_interval_hours)

            potential_gen_kw.append(gen_kwh / time_interval_hours)

            energy_from_pv_to_load = min(gen_kwh, demand_kwh)
            remaining_load_kwh, excess_gen_kwh = demand_kwh - energy_from_pv_to_load, gen_kwh - energy_from_pv_to_load
            
            if excess_gen_kwh > 0 and system_type in ['Hybrid', 'Off-Grid']:
                charge_amount = min(excess_gen_kwh, battery_capacity_kwh - battery_soc_kwh)
                battery_soc_kwh += charge_amount
            
            # Any remaining excess generation is now clipped (discarded)
            
            if remaining_load_kwh > 0 and system_type in ['Hybrid', 'Off-Grid']:
                min_soc_limit_kwh = 0.0
                if system_type == 'Hybrid':
                    min_soc_limit_kwh = battery_capacity_kwh * 0.2 # 20% limit

                available_discharge_kwh = max(0, battery_soc_kwh - min_soc_limit_kwh)
                discharge_amount = min(remaining_load_kwh, available_discharge_kwh)
                battery_soc_kwh -= discharge_amount
                remaining_load_kwh -= discharge_amount
            
            import_kwh = remaining_load_kwh if remaining_load_kwh > 0 and system_type != 'Off-Grid' else 0
            
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
            "potential_generation": [round(val, 2) for val in potential_gen_kw]
        }
    except Exception as e: return {"error": str(e)}