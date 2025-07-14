# routes/financial.py
from flask import Blueprint, request, jsonify
from models import db, Projects, EnergyData
from services.financial_calcs import run_quick_financials
from datetime import datetime
import logging

financial_bp = Blueprint('financial', __name__)

@financial_bp.route('/financial_model', methods=['POST'])
def financial_model():
    try:
        data = request.get_json()
        logging.debug(f"Financial Model Input: {data}")

        project_id = data.get("project_id")

        simulation_data = data.get("simulation_data")

        if not simulation_data or "timestamps" not in simulation_data:
            return jsonify({"error": "Simulation data is required"}), 400

        project = Projects.query.get(project_id)
        if not project:
            logging.error(f"Project {project_id} not found")
            return jsonify({"error": "Project not found"}), 404

        
        system_cost = float(project.project_value_excl_vat)

        result = run_quick_financials(simulation_data, system_cost, project)

        if result.get("error"):
            logging.error(f"Financial calculation error: {result['error']}")
            return jsonify(result), 500
        
        return jsonify(result), 200

    except Exception as e:
        logging.exception("An error occurred in financial_model")
        return jsonify({"error": str(e)}), 500