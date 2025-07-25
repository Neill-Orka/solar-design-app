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
        use_pvgis = data.get("use_pvgis", False)
        panel_kw = data["system"]["panel_kw"]
        tilt = data["system"]["tilt"]
        azimuth = data["system"]["azimuth"]
        system_type = data["system"]["system_type"]
        inverter_kva = data["system"].get("inverter_kva")
        battery_kwh = data["system"].get("battery_kwh", 0)
        allow_export = data["system"].get("allow_export", False)

        # If we get an object instead of number
        if isinstance(inverter_kva, dict):
            inverter_kva = inverter_kva.get('capacity', 0) * inverter_kva.get('quantity', 1)
        if isinstance(battery_kwh, dict):
            battery_kwh = battery_kwh.get('capacity', 0) * battery_kwh.get('quantity', 1)

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if inverter_kva is None:
            return jsonify({"error": "Inverter size (kVA) is required"}), 400

        result = simulate_system_inner(project_id, panel_kw, battery_kwh, system_type, inverter_kva, allow_export, tilt, azimuth, use_pvgis)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500