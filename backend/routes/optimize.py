# routes/optimize.py
from flask import Blueprint, request, jsonify
from services.optimizer import optimize_project
from models import Projects

optimize_bp = Blueprint('optimize', __name__)

@optimize_bp.route('/optimize', methods=['POST'])
def run_optimizer():
    try:
        data = request.get_json()
        project_id = data.get("project_id")
        tariff = float(data.get("tariff", 2.2))
        export_enabled = data.get("export_enabled", False)
        feed_in_tariff = float(data.get("feed_in_tariff", 1.0))

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        result = optimize_project(
            project_id=project_id,
            tariff=tariff,
            export_enabled=export_enabled,
            feed_in_tariff=feed_in_tariff
        )

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
