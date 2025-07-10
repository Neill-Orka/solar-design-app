# services/financial_calcs.py
from datetime import datetime
from models import db, Tariffs, TariffRates
import logging

def calculate_financial_model(project, sim_response, eskom_tariff, export_enabled, feed_in_tariff):
    try:
        demand = sim_response["demand"]
        export = sim_response["export_to_grid"]
        import_kw = sim_response["import_from_grid"]
        timestamps = sim_response["timestamps"]

        degradation_rate = 0.005
        system_cost = project.project_value_excl_vat or 0

        base_savings = 0
        monthly_costs = {}

        for i in range(len(demand)):
            ts = datetime.fromisoformat(timestamps[i])
            month = ts.strftime('%Y-%m')

            base_cost = demand[i] * 0.5 * eskom_tariff
            import_cost = import_kw[i] * 0.5 * eskom_tariff
            savings = base_cost - import_cost

            if export_enabled:
                savings += export[i] * 0.5 * feed_in_tariff

            base_savings += savings

            if month not in monthly_costs:
                monthly_costs[month] = {"old_cost": 0, "new_cost": 0}

            monthly_costs[month]["old_cost"] += base_cost
            monthly_costs[month]["new_cost"] += import_cost - (export[i] * 0.5 * feed_in_tariff if export_enabled else 0)

        yearly_savings = []
        total_savings = 0

        for year in range(2025, 2025 + 20):
            degraded_savings = base_savings * ((1 - degradation_rate) ** (year - 2025))
            yearly_savings.append({"year": year, "savings": round(degraded_savings)})
            total_savings += degraded_savings

        roi_20yr = ((total_savings / system_cost) - 1) * 100 if system_cost > 0 else 0
        payback_years = system_cost / base_savings if base_savings > 0 else 0

        cost_comparison = [
            {"period": month, "old_cost": round(v["old_cost"], 2), "new_cost": round(v["new_cost"], 2)}
            for month, v in sorted(monthly_costs.items())
        ]

        return {
            "annual_savings": round(base_savings),
            "payback_years": payback_years,
            "roi_20yr": roi_20yr,
            "yearly_savings": yearly_savings,
            "cost_comparison": cost_comparison
        }

    except Exception as e:
        return {"error": str(e)}


def run_quick_financials(sim_response, system_cost, project):
    try:
        effective_rate = 0
        if project.custom_flat_rate is not None:
            effective_rate = project.custom_flat_rate
        elif project.tariff_id is not None:
            # CURRENTLY ONLY USES THE FIRST ENERGY RATE IN THE TARIFF
            rate_entry = TariffRates.query.filter_by(tariff_id=project.tariff_id, charge_category='energy').first()
            if rate_entry:
                effective_rate = rate_entry.rate_value

        # CONVERT CENT TO RAND
        effective_rate_in_rands = float(effective_rate) / 100

        demand, imports, exports = sim_response["demand"], sim_response["import_from_grid"], sim_response["export_to_grid"]
        generation = sim_response["generation"]
        timestamps = [datetime.fromisoformat(ts) for ts in sim_response["timestamps"]]
        panel_kw = sim_response.get("panel_kw", 1)
        potential_generation = sim_response["potential_generation"]
        
        time_interval_hours, degradation_rate = 0.5, 0.005

        total_demand_kwh = sum(d * time_interval_hours for d in demand)
        total_generation_kwh = sum(g * time_interval_hours for g in generation)
        potential_generation_kwh = sum(pg * time_interval_hours for pg in potential_generation)
        total_import_kwh = sum(imp * time_interval_hours for imp in imports)
        total_export_kwh = 0 # Hardcoded to zero
        pv_used_on_site_kwh = total_demand_kwh - total_import_kwh

        throttled_kwh = potential_generation_kwh - total_generation_kwh
        throttling_loss_percent = (throttled_kwh / potential_generation_kwh) * 100 if potential_generation_kwh > 0 else 0

        yield_incl_losses = total_generation_kwh / panel_kw / 365
        yield_excl_losses = potential_generation_kwh / panel_kw / 365

        self_consumption_rate = round((pv_used_on_site_kwh / total_generation_kwh) * 100, 1) if total_generation_kwh > 0 else 0
        
        grid_independence_rate = round((pv_used_on_site_kwh / total_demand_kwh) * 100, 1) if total_demand_kwh > 0 else 0

        original_annual_cost = total_demand_kwh * effective_rate_in_rands
        new_annual_cost = total_import_kwh * effective_rate_in_rands
        annual_savings = original_annual_cost - new_annual_cost

        total_20yr_saving = sum(annual_savings * ((1 - degradation_rate) ** i) for i in range(20))
        payback_years = system_cost / annual_savings if annual_savings > 0 else float('inf')
        roi_20yr = ((total_20yr_saving - system_cost) / system_cost) * 100 if system_cost > 0 else float('inf')

        monthly_costs = {}
        for i, ts in enumerate(timestamps):
            month_key = ts.strftime('%Y-%m')
            if month_key not in monthly_costs: monthly_costs[month_key] = {"old_cost": 0, "new_cost": 0}
            monthly_costs[month_key]["old_cost"] += demand[i] * time_interval_hours * effective_rate_in_rands
            monthly_costs[month_key]["new_cost"] += (imports[i] * time_interval_hours * effective_rate_in_rands)
        
        cost_comparison_data = [{"month": key, **value} for key, value in sorted(monthly_costs.items())]

        return {
            "annual_savings": round(annual_savings),
            "payback_period": round(payback_years, 1),
            "roi": round(roi_20yr, 1),
            "total_demand_kwh": round(total_demand_kwh),
            "total_generation_kwh": round(total_generation_kwh),
            "pv_used_on_site_kwh": round(pv_used_on_site_kwh),
            "total_import_kwh": round(total_import_kwh),
            "total_export_kwh": round(total_export_kwh),
            "self_consumption_rate": round(self_consumption_rate),
            "grid_independence_rate": round(grid_independence_rate),
            "cost_comparison": cost_comparison_data,
            "yield_incl_losses": round(yield_incl_losses, 2),
            "yield_excl_losses": round(yield_excl_losses, 2),
            "potential_generation_kwh": round(potential_generation_kwh),
            "original_annual_cost": round(original_annual_cost),
            "new_annual_cost": round(new_annual_cost),
            "throttling_loss_percent": round(throttling_loss_percent, 1)
        }
    except Exception as e: return {"error": str(e)}