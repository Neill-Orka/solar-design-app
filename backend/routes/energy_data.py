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
