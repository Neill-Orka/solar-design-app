# routes/simulation.py
from flask import Blueprint, request, jsonify
from models import db, Projects, EnergyData
import pandas as pd
from datetime import datetime
from services.simulation_engine import simulate_system_inner
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

simulation_bp = Blueprint('simulation', __name__)

@simulation_bp.route('/simulate', methods=['POST'])
def simulate_system():
    try:
        data = request.get_json()
        project_id = data.get("project_id")
        panel_kw = data["system"]["panel_kw"]
        battery_kwh = data["system"].get("battery_kwh", 0)
        battery_count = data["system"].get("battery_count", 0)
        system_type = data["system"]["system_type"]
        inverter_kva = data["system"].get("inverter_kva")
        inverter_count = data["system"].get("inverter_count", 1)
        allow_export = data["system"].get("allow_export", False)

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if inverter_kva is None:
            return jsonify({"error": "Inverter size (kVA) is required"}), 400

        result = simulate_system_inner(project_id, panel_kw, battery_kwh, battery_count, system_type, inverter_kva, inverter_count, allow_export)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500