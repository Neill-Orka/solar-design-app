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
        system_type = data["system"]["system_type"]
        inverter_kva = data["system"].get("inverter_kva")
        allow_export = data["system"].get("allow_export", False)

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if inverter_kva is None:
            return jsonify({"error": "Inverter size (kVA) is required"}), 400

        result = simulate_system_inner(project_id, panel_kw, battery_kwh, system_type, inverter_kva, allow_export)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@simulation_bp.route('/upload_energy_data', methods=['POST'])
def upload_energy_data():
    try:
        if 'file' not in request.files or 'project_id' not in request.form:
            return jsonify({"error": "File and project_id are required"}), 400

        file = request.files['file']
        project_id = int(request.form['project_id'])

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": f"Project with id {project_id} does not exist"}), 404

        if not file.filename.endswith(('xlsx', 'xls')):
            return jsonify({"error": "Only Excel files (.xlsx, .xls) are allowed"}), 400

        df = pd.read_excel(file, engine='openpyxl')
        df = df.reset_index(drop=True)
        if not all(col in df.columns for col in ['Timestamp', 'Demand_kW']):
            return jsonify({"error": "File must contain columns: Timestamp, Demand_kW"}), 400

        df = df.dropna(subset=['Timestamp', 'Demand_kW'])

        energy_records = []
        for idx, row in df.iterrows():
            try:
                timestamp = pd.to_datetime(row['Timestamp'], format='%Y/%m/%d %H:%M', errors='raise')
                demand_kw = float(row['Demand_kW'])
                if not (timestamp.year == 2025 and timestamp.minute % 30 == 0):
                    return jsonify({"error": f"Invalid timestamp at row {idx}: {timestamp}"}), 400
                energy_records.append(EnergyData(project_id=project_id, timestamp=timestamp, demand_kw=demand_kw))
            except ValueError as e:
                return jsonify({"error": f"Invalid data format in row {idx}: {str(e)}"}), 400

        if not energy_records:
            return jsonify({"error": "No valid energy data to insert"}), 400

        db.session.bulk_save_objects(energy_records)
        db.session.commit()
        return jsonify({"message": f"Uploaded {len(energy_records)} energy records for project {project_id}"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
