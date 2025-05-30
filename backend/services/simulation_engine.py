# services/simulation_engine.py
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
import pandas as pd
from models import EnergyData


def simulate_system_inner(project_id, panel_kw, battery_kwh, battery_count, system_type, inverter_kva, inverter_count, allow_export):
    try:
        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return {"error": "No energy data found for project"}

        latitude, longitude = -29.7538, 24.0859
        times = pd.to_datetime([r.timestamp for r in records]).tz_localize('Africa/Johannesburg')
        site = Location(latitude, longitude, tz='Africa/Johannesburg')
        clearsky = site.get_clearsky(times)

        temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']
        system = PVSystem(
            surface_tilt=30,
            surface_azimuth=0,
            module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
            inverter_parameters={'pdc0': inverter_kva * 1000},
            temperature_model_parameters=temperature_params,
            racking_model='open_rack',
            module_type='glass_glass'
        )

        mc = ModelChain(system, site, aoi_model='no_loss', spectral_model='no_loss', losses_model='no_loss')
        mc.run_model(clearsky)

        generation_kw = mc.results.ac.fillna(0) / 1000  # kW
        demand_kw = [r.demand_kw for r in records]

        battery_max = (battery_kwh or 0) * battery_count * 1000
        battery_soc = 0
        soc_trace, import_from_grid, export_to_grid, generation_trace = [], [], [], []

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

            # total inverter capacity in kW
            total_inv_kw = inverter_kva * inverter_count
            inv_gen = min(gen, total_inv_kw)

            # decide how much PV is used for load.
            if system_type == 'grid' and not allow_export:
                # all generation goes to load, no export
                pv_used = min(inv_gen, demand)
            else:
                # hybrid or off-grid system, or grid-tied with export allowed
                pv_used = inv_gen

            # export only if allowed
            export_kw = allow_export and max(0, pv_used - demand) or 0

            # import only if system is not off-grid
            import_kw = system_type != 'off-grid' and max(0, demand - pv_used) or 0

            generation_trace.append(round(pv_used, 2))
            import_from_grid.append(round(import_kw, 2))
            export_to_grid.append(round(export_kw, 2))

        return {
            "timestamps": [r.timestamp.isoformat() for r in records],
            "demand": demand_kw,
            "generation": generation_trace,
            "battery_soc": soc_trace,
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid
        }

    except Exception as e:
        return {"error": str(e)}