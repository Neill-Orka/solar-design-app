# services/simulation_engine.py
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
import pandas as pd
from models import EnergyData


def simulate_system_inner(project_id, panel_kw, battery_kwh, system_type, inverter_kva, allow_export):
    try:
        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return {"error": "No energy data found for project"}

        latitude, longitude = -26.71085739284715, 27.081064165934936 # -29.7538, 24.0859 De Aar 
        times = pd.to_datetime([r.timestamp for r in records]).tz_localize('Africa/Johannesburg')
        site = Location(latitude, longitude, tz='Africa/Johannesburg')
        clearsky = site.get_clearsky(times)

        temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']
        system = PVSystem(
            surface_tilt=15,
            surface_azimuth=14,
            module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
            inverter_parameters={'pdc0': inverter_kva * 1000},
            temperature_model_parameters=temperature_params,
            racking_model='open_rack',
            module_type='glass_glass'
        )

        mc = ModelChain(system, site, aoi_model='no_loss', spectral_model='no_loss', losses_model='no_loss')
        mc.run_model(clearsky)

        if mc.results.ac is not None:
            generation_kw = mc.results.ac.fillna(0) / 1000  # kW
        else:
            generation_kw = pd.Series([0] * len(records))
        demand_kw = [r.demand_kw for r in records]

        battery_max = (battery_kwh or 0) * 1000
        battery_soc = 0
        soc_trace, import_from_grid, export_to_grid = [], [], []

        for i in range(len(demand_kw)):
            gen = generation_kw.iloc[i]
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
