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
    data = request.get_json() or {}

    # validate inputs
    if "profile_id" not in data:
        return jsonify({"error": "profile_id is required"}), 400
    try:
        profile_id = int(data["profile_id"])
    except Exception:
        return jsonify({"error": "profile_id must be an integer"}), 400

    try:
        scaler = float(data.get("scaler", 1.0))
    except Exception:
        return jsonify({"error": "scaler must be a number"}), 400
    if scaler <= 0:
        return jsonify({"error": "scaler must be greater than 0"}), 400

    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": f"Project {project_id} not found"}), 404

    from models import LoadProfiles
    profile = LoadProfiles.query.get(profile_id)
    if not profile or not profile.profile_data:
        return jsonify({"error": f"Profile {profile_id} not found or has no data"}), 404

    # normalize keys
    first = profile.profile_data[0]
    ts_key = "timestamp" if "timestamp" in first else "Timestamp"
    kw_key = "demand_kw" if "demand_kw" in first else "Demand_kW"

    # clear existing
    EnergyData.query.filter_by(project_id=project_id).delete()

    # build new rows safely
    import pandas as pd
    rows = []
    for r in profile.profile_data:
        ts = pd.to_datetime(r.get(ts_key), errors="coerce")
        if pd.isna(ts):
            continue  # skip bad rows instead of 500
        try:
            kw = float(r.get(kw_key)) * scaler
        except Exception:
            continue
        rows.append(EnergyData(project_id=project_id,
                               timestamp=ts.to_pydatetime(),
                               demand_kw=kw))

    if not rows:
        return jsonify({"error": "No valid points after parsing profile"}), 400

    db.session.bulk_save_objects(rows)
    db.session.commit()

    return jsonify({
        "message": f"Applied profile '{profile.name}' with scaling factor {scaler}. Generated {len(rows)} data points."
    }), 200

