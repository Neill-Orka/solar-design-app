# services/optimizer.py
from services.simulation_engine import simulate_system_inner
from services.financial_calcs import calculate_financial_model
from models import Projects, EnergyData
import math
import time

# Constants
PANEL_WATT = 565
PANEL_KW = PANEL_WATT / 1000  # 0.565 kW
PANEL_COST = 1350
MAX_OVERSIZE_RATIO = 1.2
MIN_SOC = 20

INVERTER_OPTIONS = [
    {"brand": "Victron", "kva": 5, "cost": 16000},
    {"brand": "Victron", "kva": 10, "cost": 28000},
    {"brand": "Victron", "kva": 15, "cost": 35000},
]

BATTERY_OPTIONS = [
    {"kwh": 5.12, "cost": 22000},
    {"kwh": 8.0, "cost": 48000},
    {"kwh": 16.0, "cost": 88000},
    {"kwh": 0.0, "cost": 0}  # for grid-tied if no battery
]


def estimate_peak_demand_kw(project_id):
    records = EnergyData.query.filter_by(project_id=project_id).all()
    return max([r.demand_kw for r in records]) if records else 0


def optimize_project(project_id, tariff, export_enabled, feed_in_tariff, verbose=False):
    best_result = None
    best_config = None

    project = Projects.query.get(project_id)
    if not project:
        return {"error": "Project not found"}

    peak_demand_kw = estimate_peak_demand_kw(project_id)
    if verbose:
        print(f"Estimated peak demand: {peak_demand_kw:.2f} kW")

    valid_inverters = [inv for inv in INVERTER_OPTIONS if inv["kva"] >= peak_demand_kw * 0.8]
    estimated_kw = peak_demand_kw * 1.3
    min_panels = math.ceil(estimated_kw / PANEL_KW * 0.7)
    max_panels = math.ceil(estimated_kw / PANEL_KW * 1.3)
    panel_range = list(range(min_panels, max_panels + 1))
    total_runs = len(valid_inverters) * len(panel_range) * len(BATTERY_OPTIONS)
    run_count = 0

    for inverter in valid_inverters:
        max_allowed_panels = math.floor((inverter["kva"] * MAX_OVERSIZE_RATIO) / PANEL_KW)

        for panel_count in panel_range:
            if panel_count > max_allowed_panels:
                continue

            panel_kw = panel_count * PANEL_KW

            for battery in BATTERY_OPTIONS:
                if project.system_type == 'hybrid' and battery['kwh'] == 0:
                    continue

                run_count += 1
                print(f"[{run_count}/{total_runs}] Trying {panel_count} panels ({panel_kw:.2f}kW), {inverter['kva']}kVA inverter, {battery['kwh']}kWh battery")

                try:
                    sim = simulate_system_inner(
                        project_id=project_id,
                        panel_kw=panel_kw,
                        battery_kwh=battery["kwh"],
                        system_type=project.system_type,
                        inverter_kva=inverter["kva"],
                        allow_export=export_enabled
                    )

                    if "error" in sim:
                        print("❌ Simulation error:", sim["error"])
                        continue

                    min_soc_val = min(sim["battery_soc"] or [100])
                    if any(soc < MIN_SOC for soc in sim["battery_soc"]):
                        print(f"❌ Rejected: SOC dropped to {min_soc_val:.1f}%")
                        continue

                    if project.system_type == "off-grid" and any(imported > 0 for imported in sim["import_from_grid"]):
                        print("❌ Rejected: Off-grid config imported from grid")
                        continue

                    financials = calculate_financial_model(project, sim, tariff, export_enabled, feed_in_tariff)
                    if "error" in financials:
                        print("❌ Financial model error:", financials["error"])
                        continue

                    payback = financials["payback_years"]
                    if not best_result or payback < best_result["payback_years"]:
                        best_result = financials
                        best_config = {
                            "panel_count": panel_count,
                            "panel_kw": panel_kw,
                            "inverter_kva": inverter["kva"],
                            "battery_kwh": battery["kwh"],
                            "total_cost": (panel_count * PANEL_COST) + inverter["cost"] + battery["cost"]
                        }
                except Exception as e:
                    print(f"❌ Error during optimization: {e}")
                    continue

    return {
        "best_config": best_config,
        "financials": best_result
    } if best_result else {"error": "No valid system found that meets requirements"}
