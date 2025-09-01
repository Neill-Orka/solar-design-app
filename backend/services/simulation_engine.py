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

FUEL_TABLE = [
    {'size_kw': 0.00, 'lph': {0.25: 0.0, 0.50: 0.0, 0.75: 0.0, 1.00: 0.0}},
    {'size_kw': 20.00, 'lph': {0.25: 2.3, 0.50: 3.4, 0.75: 4.9, 1.00: 6.1}},
    {'size_kw': 30.00, 'lph': {0.25: 4.9, 0.50: 6.8, 0.75: 9.1, 1.00: 10.0}},
    {'size_kw': 40.00, 'lph': {0.25: 6.1, 0.50: 8.7, 0.75: 12.0, 1.00: 15.0}},
    {'size_kw': 50.00, 'lph': {0.25: 6.45, 0.50: 9.8, 0.75: 13.15, 1.00: 16.85}},
    {'size_kw': 60.00, 'lph': {0.25: 6.8, 0.50: 10.9, 0.75: 14.3, 1.00: 18.7}},
    {'size_kw': 75.00, 'lph': {0.25: 9.1, 0.50: 12.8, 0.75: 17.4, 1.00: 23.0}},
    {'size_kw': 100.00, 'lph': {0.25: 9.8, 0.50: 15.5, 0.75: 21.9, 1.00: 28.0}},
    {'size_kw': 125.00, 'lph': {0.25: 11.7, 0.50: 18.9, 0.75: 26.8, 1.00: 34.4}},
    {'size_kw': 135.00, 'lph': {0.25: 12.4, 0.50: 20.4, 0.75: 28.7, 1.00: 37.0}},
    {'size_kw': 150.00, 'lph': {0.25: 13.6, 0.50: 22.3, 0.75: 31.7, 1.00: 41.2}},
    {'size_kw': 175.00, 'lph': {0.25: 15.5, 0.50: 25.7, 0.75: 36.7, 1.00: 48.0}},
    {'size_kw': 200.00, 'lph': {0.25: 17.7, 0.50: 29.1, 0.75: 41.6, 1.00: 54.5}},
    {'size_kw': 230.00, 'lph': {0.25: 20.0, 0.50: 33.3, 0.75: 47.3, 1.00: 62.8}},
    {'size_kw': 250.00, 'lph': {0.25: 21.5, 0.50: 35.9, 0.75: 51.4, 1.00: 68.1}},
    {'size_kw': 300.00, 'lph': {0.25: 25.7, 0.50: 42.7, 0.75: 60.9, 1.00: 81.3}},
    {'size_kw': 350.00, 'lph': {0.25: 29.9, 0.50: 49.5, 0.75: 70.7, 1.00: 95.0}},
    {'size_kw': 400.00, 'lph': {0.25: 33.6, 0.50: 56.4, 0.75: 80.6, 1.00: 108.2}},
    {'size_kw': 500.00, 'lph': {0.25: 41.6, 0.50: 70.0, 0.75: 99.9, 1.00: 135.1}},
    {'size_kw': 600.00, 'lph': {0.25: 49.9, 0.50: 83.2, 0.75: 119.2, 1.00: 182.4}},
    {'size_kw': 750.00, 'lph': {0.25: 61.7, 0.50: 103.7, 0.75: 148.7, 1.00: 202.1}},
    {'size_kw': 1000.00, 'lph': {0.25: 81.7, 0.50: 137.7, 0.75: 197.2, 1.00: 269.1}},
    {'size_kw': 1250.00, 'lph': {0.25: 101.8, 0.50: 171.4, 0.75: 246.0, 1.00: 336.1}},
    {'size_kw': 1500.00, 'lph': {0.25: 121.8, 0.50: 205.5, 0.75: 294.5, 1.00: 403.1}},
    {'size_kw': 1750.00, 'lph': {0.25: 141.9, 0.50: 137.0, 0.75: 343.3, 1.00: 470.1}},
    {'size_kw': 2000.00, 'lph': {0.25: 162.0, 0.50: 273.3, 0.75: 391.7, 1.00: 537.1}}
]

FUEL_TABLE_SIZES = [row['size_kw'] for row in FUEL_TABLE]


def get_fuel_consumption(generator_size_kw, load_factor):
    """
    Get fuel consumption (L/h) for a given generator size and load factor.
    Uses interpolation for sizes between table entries.
    """
    if generator_size_kw <= 0:
        return 0.0
    
    # Find the closest sizes in the fuel table
    if generator_size_kw <= FUEL_TABLE_SIZES[0]:
        # Smaller than smallest size
        fuel_data = FUEL_TABLE[0]
    elif generator_size_kw >= FUEL_TABLE_SIZES[-1]:
        # Larger than largest size
        fuel_data = FUEL_TABLE[-1]
    else:
        # Interpolate between two sizes
        lower_idx = 0
        for i, size in enumerate(FUEL_TABLE_SIZES):
            if size <= generator_size_kw:
                lower_idx = i
            else:
                break
        
        upper_idx = min(lower_idx + 1, len(FUEL_TABLE) - 1)
        lower_size = FUEL_TABLE_SIZES[lower_idx]
        upper_size = FUEL_TABLE_SIZES[upper_idx]
        
        if lower_size == upper_size:
            fuel_data = FUEL_TABLE[lower_idx]
        else:
            # Linear interpolation between fuel consumption rates
            factor = (generator_size_kw - lower_size) / (upper_size - lower_size)
            lower_data = FUEL_TABLE[lower_idx]['lph']
            upper_data = FUEL_TABLE[upper_idx]['lph']
            
            interpolated_lph = {}
            for load_pct in [0.25, 0.50, 0.75, 1.00]:
                interpolated_lph[load_pct] = (
                    lower_data[load_pct] + factor * (upper_data[load_pct] - lower_data[load_pct])
                )
            
            fuel_data = {'size_kw': generator_size_kw, 'lph': interpolated_lph}
    
    # Now interpolate fuel consumption based on load factor
    lph_data = fuel_data['lph']
    
    if load_factor <= 0.25:
        return lph_data[0.25]
    elif load_factor <= 0.50:
        factor = (load_factor - 0.25) / 0.25
        return lph_data[0.25] + factor * (lph_data[0.50] - lph_data[0.25])
    elif load_factor <= 0.75:
        factor = (load_factor - 0.50) / 0.25
        return lph_data[0.50] + factor * (lph_data[0.75] - lph_data[0.50])
    elif load_factor <= 1.00:
        factor = (load_factor - 0.75) / 0.25
        return lph_data[0.75] + factor * (lph_data[1.00] - lph_data[0.75])
    else:
        # Over 100% load - extrapolate
        return lph_data[1.00] * load_factor


class GeneratorController:
    """
    Controls generator operation with realistic start/stop behavior and minimum run time.
    """
    
    def __init__(self, size_kw, min_loading_pct=25.0, min_run_time_hours=1.0, 
                 battery_start_soc=20.0, battery_stop_soc=80.0, can_charge_battery=True):
        self.size_kw = size_kw
        self.min_loading_pct = max(25.0, min(100.0, min_loading_pct))  # Minimum 25%, max 100%
        self.min_run_time_hours = min_run_time_hours
        self.battery_start_soc = battery_start_soc  # Start generator when battery SOC drops below this
        self.battery_stop_soc = battery_stop_soc    # Stop generator when battery SOC rises above this
        self.can_charge_battery = can_charge_battery
        
        # State tracking
        self.is_running = False
        self.run_time_remaining = 0.0  # Hours remaining for minimum run time
        self.total_fuel_liters = 0.0
        self.total_energy_kwh = 0.0
        self.total_runtime_hours = 0.0
        
    def should_start(self, shortfall_kw, battery_soc_pct, time_interval_hours):
        """
        Determine if generator should start based on conditions.
        """
        # Don't start if already running
        if self.is_running:
            return False
            
        # Start if there's significant shortfall OR battery is low
        has_shortfall = shortfall_kw > (self.size_kw * 0.1)  # 10% of generator capacity
        battery_low = battery_soc_pct <= self.battery_start_soc
        
        return has_shortfall or battery_low
    
    def should_stop(self, shortfall_kw, battery_soc_pct, time_interval_hours):
        """
        Determine if generator should stop.
        For bulk charging mode: Only stop when battery reaches stop_soc AND minimum run time is complete.
        """
        # Don't stop if not running
        if not self.is_running:
            return False
            
        # Must run for minimum time
        if self.run_time_remaining > 0:
            return False
            
        # Stop when battery reaches stop_soc (regardless of demand shortfall)
        battery_charged = battery_soc_pct >= self.battery_stop_soc
        
        return battery_charged
    
    def get_output(self, demand_shortfall_kw, battery_soc_kwh, battery_capacity_kwh, time_interval_hours, inverter_ac_limit_kw=None):
        """
        Calculate generator output and fuel consumption for this time step.
        When ON, generator runs at rated power to bulk-charge battery until stop_soc.
        Returns: (gen_to_load_kw, gen_to_battery_kw, fuel_liters_consumed)
        """
        if self.size_kw <= 0:
            return 0.0, 0.0, 0.0
            
        battery_soc_pct = (battery_soc_kwh / battery_capacity_kwh * 100) if battery_capacity_kwh > 0 else 0
        
        # Check start/stop conditions
        if not self.is_running:
            if self.should_start(demand_shortfall_kw, battery_soc_pct, time_interval_hours):
                self.is_running = True
                self.run_time_remaining = self.min_run_time_hours
        else:
            if self.should_stop(demand_shortfall_kw, battery_soc_pct, time_interval_hours):
                self.is_running = False
                self.run_time_remaining = 0.0
            else:
                # Decrement minimum run time
                self.run_time_remaining = max(0.0, self.run_time_remaining - time_interval_hours)
        
        if not self.is_running:
            return 0.0, 0.0, 0.0
        
        # Generator is running - track runtime hours
        self.total_runtime_hours += time_interval_hours
        
        # Generator is running - run at rated power
        # Apply inverter limit if provided
        target_output_kw = self.size_kw
        if inverter_ac_limit_kw is not None:
            target_output_kw = min(self.size_kw, inverter_ac_limit_kw)
        
        # Serve load first
        gen_to_load_kw = min(demand_shortfall_kw, target_output_kw)
        
        # Use remaining capacity for battery charging (if enabled and battery can accept it)
        gen_to_battery_kw = 0.0
        if self.can_charge_battery and battery_capacity_kwh > 0:
            remaining_gen_capacity = target_output_kw - gen_to_load_kw
            
            if remaining_gen_capacity > 0:
                # Calculate energy needed to reach stop_soc
                energy_to_stop_soc_kwh = max(0, (self.battery_stop_soc - battery_soc_pct) * battery_capacity_kwh / 100)
                
                # Maximum charge rate based on energy needed and time interval
                max_charge_kw = energy_to_stop_soc_kwh / time_interval_hours
                
                # Battery charging is also limited by battery's maximum charge rate
                # For simplicity, assume battery can charge at any rate up to remaining capacity
                battery_max_charge_kw = max_charge_kw  # Could add a separate battery charge rate limit here
                
                # Use minimum of: remaining generator capacity, battery charge limit, energy needed
                gen_to_battery_kw = min(remaining_gen_capacity, battery_max_charge_kw)
                gen_to_battery_kw = max(0, gen_to_battery_kw)  # Ensure non-negative
        
        # Total actual generator output
        actual_gen_output_kw = gen_to_load_kw + gen_to_battery_kw
        
        # For fuel calculation, use the target output (rated power or inverter limit)
        # Even if we can't use all the power, generator still runs at rated capacity
        fuel_load_factor = actual_gen_output_kw / self.size_kw if self.size_kw > 0 else 0
        fuel_consumption_lph = get_fuel_consumption(self.size_kw, fuel_load_factor)
        fuel_liters_consumed = fuel_consumption_lph * time_interval_hours
        
        # Track totals
        self.total_fuel_liters += fuel_liters_consumed
        self.total_energy_kwh += actual_gen_output_kw * time_interval_hours
        
        return gen_to_load_kw, gen_to_battery_kw, fuel_liters_consumed
        
        # Calculate fuel consumption
        load_factor = total_output_kw / self.size_kw if self.size_kw > 0 else 0
        fuel_consumption_lph = get_fuel_consumption(self.size_kw, load_factor)
        fuel_liters_consumed = fuel_consumption_lph * time_interval_hours
        
        # Track totals
        self.total_fuel_liters += fuel_liters_consumed
        self.total_energy_kwh += total_output_kw * time_interval_hours
        
        return gen_to_load_kw, gen_to_battery_kw, fuel_liters_consumed


def simulate_system_inner(
        project_id, 
        panel_kw, 
        battery_kwh,
        system_type,
        inverter_kva,
        allow_export,
        tilt,
        azimuth,
        use_pvgis=False,
        profile_name='Midrand Azth:east-west Tilt:5',
        battery_soc_limit=20,
        generator_config=None
):    
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
        time_interval_hours = 0.5

        usable_generation_kw = []

        min_soc_limit_kwh = battery_capacity_kwh * (float(battery_soc_limit) / 100)

        # Generator config (defaults)
        gen = generator_config or {}
        gen_enabled = bool(gen.get('enabled', False))
        gen_kva = float(gen.get('kva', 0) or 0)
        gen_min_loading_pct = max(25.0, min(100.0, float(gen.get('min_loading_pct', 30))))
        gen_can_charge = bool(gen.get('can_charge_battery', True))
        gen_min_run_time = float(gen.get('min_run_time_hours', 1.0))
        gen_start_soc = float(gen.get('battery_start_soc', 20))
        gen_stop_soc = float(gen.get('battery_stop_soc', 80))
        gen_service_cost = float(gen.get('service_cost', 1000))
        gen_service_interval = float(gen.get('service_interval_hours', 1000))
        diesel_price = float(
            (gen.get('diesel_price_r_per_liter')
             or gen.get('diesel_price_per_l')
             or 22.58)
        )

        # Initialize generator controller for off-grid systems
        generator = None
        if system_type == 'off-grid' and gen_enabled and gen_kva > 0:
            generator = GeneratorController(
                size_kw=gen_kva,
                min_loading_pct=gen_min_loading_pct,
                min_run_time_hours=gen_min_run_time,
                battery_start_soc=gen_start_soc,
                battery_stop_soc=gen_stop_soc,
                can_charge_battery=gen_can_charge
            )

        import_from_grid, export_to_grid = [], []
        usable_generation_kw, battery_soc_trace = [], []
        shortfall_kw, generator_kw = [], []

        for i in range(len(demand_kw)):
            # PV available this interval (already inverter-capped)
            gen_kwh = potential_generation_kw.iloc[i] * time_interval_hours
            load_kwh = demand_kw[i] * time_interval_hours

            # 1) PV to load
            pv_to_load = min(gen_kwh, load_kwh)
            rem_load_kwh = load_kwh - pv_to_load
            excess_pv_kwh = gen_kwh - pv_to_load

            # 2) Excess PV to battery (hybrid or off-grid)
            pv_to_batt = 0.0
            if excess_pv_kwh > 0 and system_type in ['hybrid', 'off-grid'] and battery_capacity_kwh > 0:
                pv_to_batt = min(excess_pv_kwh, battery_capacity_kwh - battery_soc_kwh)
                battery_soc_kwh += pv_to_batt
            
            # 3) Discharge battery to remaining load (respect min SOC)
            batt_to_load = 0.0
            if rem_load_kwh > 0 and system_type in ['hybrid', 'off-grid'] and battery_capacity_kwh > 0:
                available_discharge = max(0.0, battery_soc_kwh - min_soc_limit_kwh)
                batt_to_load = min(rem_load_kwh, available_discharge)
                battery_soc_kwh -= batt_to_load
                rem_load_kwh -= batt_to_load

            # 4) Generator operation for off-grid systems
            gen_to_load_kw = 0.0
            gen_to_batt_kw = 0.0
            fuel_consumed = 0.0
            
            if system_type == 'off-grid' and generator:
                gen_to_load_kw, gen_to_batt_kw, fuel_consumed = generator.get_output(
                    demand_shortfall_kw=rem_load_kwh / time_interval_hours,
                    battery_soc_kwh=battery_soc_kwh,
                    battery_capacity_kwh=battery_capacity_kwh,
                    time_interval_hours=time_interval_hours,
                    inverter_ac_limit_kw=inverter_kva
                )
                
                # Apply generator output
                gen_to_load_kwh = gen_to_load_kw * time_interval_hours
                gen_to_batt_kwh = gen_to_batt_kw * time_interval_hours
                
                rem_load_kwh -= gen_to_load_kwh
                rem_load_kwh = max(0.0, rem_load_kwh)  # Ensure non-negative
                
                if gen_to_batt_kwh > 0 and battery_capacity_kwh > 0:
                    # Generator charges battery
                    actual_charge = min(gen_to_batt_kwh, battery_capacity_kwh - battery_soc_kwh)
                    battery_soc_kwh += actual_charge

            # 5) Handle remaining load based on system type
            if rem_load_kwh > 0:
                if system_type == 'off-grid':
                    # Off-grid: remaining load becomes shortfall (no grid)
                    shortfall_kw.append(rem_load_kwh / time_interval_hours)
                    import_from_grid.append(0.0)
                else:
                    # Grid-tied or hybrid: import from grid
                    import_from_grid.append(rem_load_kwh / time_interval_hours)
                    shortfall_kw.append(0.0)
            else:
                import_from_grid.append(0.0)
                shortfall_kw.append(0.0)

            # 6) Generator output tracking
            total_gen_output_kw = gen_to_load_kw + gen_to_batt_kw
            generator_kw.append(total_gen_output_kw)

            # 7) Grid export only if allowed (surplus PV after charging battery)
            export_kwh = 0.0
            remaining_excess_after_batt = excess_pv_kwh - pv_to_batt
            if remaining_excess_after_batt > 0 and allow_export and system_type != 'off-grid':
                export_kwh = remaining_excess_after_batt
            export_to_grid.append(export_kwh / time_interval_hours)

            # 8) Usable gen (PV used + PV to batt + export) for plotting
            usable_kwh = pv_to_load + pv_to_batt + export_kwh
            usable_generation_kw.append(usable_kwh / time_interval_hours)

            battery_soc_trace.append((battery_soc_kwh / battery_capacity_kwh * 100) if battery_capacity_kwh > 0 else 0)

        # Generator totals
        diesel_liters_total = generator.total_fuel_liters if generator else 0.0
        diesel_cost_total = diesel_liters_total * diesel_price
        energy_shortfall_total_kwh = sum([x * time_interval_hours for x in shortfall_kw])
        generator_energy_total_kwh = generator.total_energy_kwh if generator else 0.0
        generator_runtime_hours = generator.total_runtime_hours if generator else 0.0

        return {
            "timestamps": [ts.isoformat() for ts in full_30min_index],
            "demand": demand_kw,
            "generation": [round(val, 2) for val in usable_generation_kw],
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid,
            "battery_soc": [round(val, 2) for val in battery_soc_trace],
            "panel_kw": degraded_panel_kw,
            "potential_generation": [round(val, 2) for val in potential_generation_kw],
            "inverter_kva": inverter_kva,
            "battery_kwh": battery_kwh,

            # Off-grid generator metrics
            "shortfall_kw": [round(x, 3) for x in shortfall_kw],
            "generator_kw": [round(x, 3) for x in generator_kw],
            "diesel_liters_total": round(diesel_liters_total, 2),
            "diesel_cost_total": round(diesel_cost_total, 2),
            "energy_shortfall_total_kwh": round(energy_shortfall_total_kwh, 2),
            "generator_energy_total_kwh": round(generator_energy_total_kwh, 2),
            "generator_runtime_hours": round(generator_runtime_hours, 2),
            "generator_config": {
                "enabled": gen_enabled,
                "kva": gen_kva,
                "min_loading_pct": gen_min_loading_pct,
                "can_charge_battery": gen_can_charge,
                "min_run_time_hours": gen_min_run_time,
                "battery_start_soc": gen_start_soc,
                "battery_stop_soc": gen_stop_soc,
                "service_cost": gen_service_cost,
                "service_interval_hours": gen_service_interval,
                "diesel_price_r_per_liter": diesel_price,
                "generator_running_intervals": generator.is_running if generator else False,
                "generator_total_run_time_hours": (generator.min_run_time_hours - generator.run_time_remaining) if generator else 0
            }
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