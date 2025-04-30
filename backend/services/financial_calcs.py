# services/financial_calcs.py
from datetime import datetime

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
