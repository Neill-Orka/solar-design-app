# routes/financial.py
from flask import Blueprint, request, jsonify
from models import db, Projects, EnergyData
from services.simulation_engine import simulate_system_inner
from datetime import datetime

financial_bp = Blueprint('financial', __name__)

@financial_bp.route('/financial_model', methods=['POST'])
def financial_model():
    try:
        data = request.get_json()
        project_id = data.get("project_id")
        eskom_tariff = float(data.get("tariff", 2.2))
        export_enabled = data.get("export_enabled", False)
        feed_in_tariff = float(data.get("feed_in_tariff", 1.0))

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        sim_response = simulate_system_inner(
            project_id,
            project.panel_kw,
            project.battery_kwh or 0,
            project.system_type
        )

        if "error" in sim_response:
            return jsonify(sim_response), 500

        demand = sim_response["demand"]
        generation = sim_response["generation"]
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

        return jsonify({
            "annual_savings": round(base_savings),
            "payback_years": payback_years,
            "roi_20yr": roi_20yr,
            "yearly_savings": yearly_savings,
            "cost_comparison": cost_comparison
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500