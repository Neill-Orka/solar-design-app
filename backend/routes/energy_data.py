# routes/energy_data.py
from flask import Blueprint, request, jsonify, Response
from models import db, Projects, EnergyData
import pandas as pd
import io

energy_data_bp = Blueprint("energy_data", __name__)

# ---------- helpers -------------------------------------------------------
def _parse_file(upload):
    "Return a normalised DataFrame with columns ['timestamp', 'demand_kw']."
    if upload.filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(upload, engine="openpyxl")
    else:                                          # default to csv
        df = pd.read_csv(upload)

    if df.shape[1] < 2:
        raise ValueError("First two columns must be timestamp and demand_kW")

    df = df.iloc[:, :2].dropna()
    df.columns = ["timestamp", "demand_kw"]
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="raise")
    df["demand_kw"] = df["demand_kw"].astype(float)
    return df

# ---------- POST  /projects/<id>/energy-data ------------------------------
@energy_data_bp.route("/projects/<int:project_id>/energy-data", methods=["POST"])
def upload_energy_data(project_id):
    """Upload (or replace) the energy‑consumption profile for one project."""
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404

    try:
        df = _parse_file(request.files["file"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # replace old data
    EnergyData.query.filter_by(project_id=project_id).delete()
    db.session.bulk_save_objects([
        EnergyData(project_id=project_id,
                   timestamp=row.timestamp,
                   demand_kw=row.demand_kw)
        for row in df.itertuples(index=False)
    ])
    db.session.commit()
    return jsonify({"message": f"Uploaded {len(df)} rows"}), 200

# ---------- GET  /projects/<id>/energy-data -------------------------------
@energy_data_bp.route("/projects/<int:project_id>/energy-data", methods=["GET"])
def list_energy_data(project_id):
    """Stream the project’s energy data back as CSV (handy for charts/exports)."""
    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404

    q = (EnergyData.query
                      .filter_by(project_id=project_id)
                      .order_by(EnergyData.timestamp))
    rows = [{"timestamp": r.timestamp.isoformat(), "demand_kw": r.demand_kw}
            for r in q]
    return jsonify(rows), 200

# ---------- DELETE  /projects/<id>/energy-data ----------------------------
@energy_data_bp.route("/projects/<int:project_id>/energy-data", methods=["DELETE"])
def delete_energy_data(project_id):
    deleted = EnergyData.query.filter_by(project_id=project_id).delete()
    db.session.commit()
    return jsonify({"message": f"Deleted {deleted} rows"}), 200

# ---------- POST  /projects/<id>/use-profile ------------------------------
@energy_data_bp.route("/projects/<int:project_id>/use-profile", methods=["POST"])
def use_profile_as_energy_data(project_id):
    """Apply a load profile as energy data for a project with optional scaling."""
    data = request.get_json()
    if not data or 'profile_id' not in data:
        return jsonify({"error": "profile_id is required"}), 400
    
    profile_id = data['profile_id']
    scaler = float(data.get('scaler', 1.0))
    if scaler <= 0:
        return jsonify({"error": "scaler must be greater than 0"}), 400
    
    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404
    
    # Get the profile data
    from models import LoadProfiles
    profile = LoadProfiles.query.get(profile_id)
    if not profile or not profile.profile_data:
        return jsonify({"error": f"Profile {profile_id} not found or has no data"}), 404
    
    # Delete existing data and commit the transaction first
    # This is the key fix - commit the delete before using a raw connection
    EnergyData.query.filter_by(project_id=project_id).delete()
    db.session.commit()  # <-- Critical fix: commit the deletion before COPY
    
    # Convert to DataFrame for faster processing
    import pandas as pd
    from io import StringIO
    import csv
    from sqlalchemy import text
    
    # Extract keys once
    timestamp_key = 'timestamp' if 'timestamp' in profile.profile_data[0] else 'Timestamp'
    demand_key = 'demand_kw' if 'demand_kw' in profile.profile_data[0] else 'Demand_kW'
    
    # Create pandas DataFrame
    df = pd.DataFrame(profile.profile_data)
    df[timestamp_key] = pd.to_datetime(df[timestamp_key])
    df[demand_key] = df[demand_key].astype(float) * scaler
    
    # Prepare data for COPY
    output = StringIO()
    for idx, row in df.iterrows():
        output.write(f"{project_id}\t{row[timestamp_key]}\t{row[demand_key]}\n")
    output.seek(0)
    
    # Using raw connection for COPY
    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("BEGIN")
        cursor.copy_from(output, 'energy_data', columns=('project_id', 'timestamp', 'demand_kw'))
        cursor.execute("COMMIT")
    finally:
        connection.close()
    
    return jsonify({"message": f"Applied profile '{profile.name}' with scaling factor {scaler}. Generated {len(df)} data points."}), 200
