# routes/jobcards.py
from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
from models import db, JobCard, Clients, JobCategory, Vehicle
from werkzeug.utils import secure_filename
import os

jobcards_bp = Blueprint("jobcards", __name__)

def _parse_dt(v):
    if not v: return None
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    except Exception:
        return None
    
def _str255(v):
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        if isinstance(v, dict):
            parts = [
                v.get('street'),
                v.get('suburb'),
                v.get('town') or v.get('city'),
                v.get('province'),
                v.get('postal_code'),
            ]
            s = ', '.join([p for p in parts if p])
            if s:
                return s[:255]
        # fallback
        return json.dumps(v, ensure_ascii=False)[:255]
    return str(v)[:255]

@jobcards_bp.before_request
def _preflight():
    if request.method == "OPTIONS":
        return ("", 204)

@jobcards_bp.route("/jobcards", methods=["GET","POST","OPTIONS"])
@jwt_required()
def jobcards_collection():
    if request.method == "GET":
        rows = JobCard.query.order_by(JobCard.created_at.desc()).all()
        return jsonify([j.to_dict(with_lines=True) for j in rows])

    data = request.get_json() or {}
    jc = JobCard(
        client_id=data["client_id"],
        owner_id=data["owner_id"],
        category_id=data.get("category_id"),
        title=data.get("title"),
        description=data.get("description"),
        is_quoted=data.get("is_quoted", False),
        project_id=data.get("project_id"),
        start_at=_parse_dt(data.get("start_at")),
        complete_at=_parse_dt(data.get("complete_at")),
        labourers_count=data.get("labourers_count", 0),
        labour_hours=data.get("labour_hours", 0),
        labour_rate_per_hour=data.get("labour_rate_per_hour", 0),
        materials_used=data.get("materials_used", False),
        did_travel=data.get("did_travel", False),
        vehicle_id=data.get("vehicle_id"),
        travel_distance_km=data.get("travel_distance_km", 0),
        coc_required=data.get("coc_required", False),
        status=data.get("status", "draft"),
        created_by_id=int(get_jwt_identity()),
    )
    # snapshot client
    client = Clients.query.get(jc.client_id)
    if client:
        jc.client_name_snapshot   = _str255(getattr(client, "client_name", None))
        jc.client_email_snapshot  = _str255(getattr(client, "email", None))
        jc.client_address_snapshot= _str255(getattr(client, "address", None))

    db.session.add(jc)
    db.session.commit()
    return jsonify(jc.to_dict()), 201

@jobcards_bp.route("/jobcards/<int:jid>", methods=["GET","PATCH","PUT","DELETE","OPTIONS"])
@jwt_required()
def jobcards_item(jid: int):
    jc = JobCard.query.get_or_404(jid)

    if request.method == "GET":
        return jsonify(jc.to_dict(with_lines=True))

    if request.method in ("PATCH","PUT"):
        data = request.get_json() or {}
        for f in [
            "title","description","is_quoted","project_id","category_id","start_at","complete_at",
            "labourers_count","labour_hours","labour_rate_per_hour",
            "materials_used","did_travel","vehicle_id","travel_distance_km",
            "coc_required","status"
        ]:
            if f in data:
                val = _parse_dt(data[f]) if f in ("start_at","complete_at") else data[f]
                setattr(jc, f, val)
        db.session.commit()
        return jsonify(jc.to_dict())

    if request.method == "DELETE":
        db.session.delete(jc)
        db.session.commit()
        return ("", 204)

    abort(405)

@jobcards_bp.route("/jobcategories", methods=["GET","POST","OPTIONS"])
@jwt_required()
def jobcategories_collection():
    if request.method == "GET":
        rows = JobCategory.query.order_by(JobCategory.name.asc()).all()
        return jsonify([c.to_dict() for c in rows])
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        abort(400, description="name required")
    cat = JobCategory(name=name, active=True)
    db.session.add(cat); db.session.commit()
    return jsonify(cat.to_dict()), 201

@jobcards_bp.route("/jobcategories/<int:cid>", methods=["PUT","PATCH","DELETE","OPTIONS"])
@jwt_required()
def jobcategories_item(cid: int):
    c = JobCategory.query.get_or_404(cid)
    if request.method in ("PUT","PATCH"):
        data = request.get_json() or {}
        if "name" in data:
            c.name = (data["name"] or "").strip()
        if "active" in data:
            c.active = bool(data["active"])
        db.session.commit()
        return jsonify(c.to_dict())
    if request.method == "DELETE":
        db.session.delete(c); db.session.commit()
        return ("", 204)
    abort(405)

# ---------- Vehicles ----------
@jobcards_bp.route("/vehicles", methods=["GET","POST","OPTIONS"])
@jwt_required()
def vehicles_collection():
    if request.method == "GET":
        rows = Vehicle.query.order_by(Vehicle.name.asc()).all()
        return jsonify([v.to_dict() for v in rows])
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        abort(400, description="name required")
    v = Vehicle(
        name=name,
        registration=data.get("registration"),
        rate_per_km=data.get("rate_per_km") or 0,
        active=bool(data.get("active", True)),
    )
    db.session.add(v); db.session.commit()
    return jsonify(v.to_dict()), 201

@jobcards_bp.route("/vehicles/<int:vid>", methods=["PUT","PATCH","DELETE","OPTIONS"])
@jwt_required()
def vehicles_item(vid: int):
    v = Vehicle.query.get_or_404(vid)
    if request.method in ("PUT","PATCH"):
        data = request.get_json() or {}
        for f in ("name","registration","rate_per_km","active"):
            if f in data:
                setattr(v, f, data[f])
        db.session.commit()
        return jsonify(v.to_dict())
    if request.method == "DELETE":
        db.session.delete(v); db.session.commit()
        return ("", 204)
    abort(405)

@jobcards_bp.route("/jobcards/<int:jid>/attachments", methods=["POST","OPTIONS"])
@jwt_required()
def upload_jobcard_attachment(jid: int):
  from models import JobCard, JobCardAttachment, db
  jc = JobCard.query.get_or_404(jid)
  file = request.files.get('file')
  if not file:
      return {"message": "file required"}, 400
  fname = secure_filename(file.filename or "photo.jpg")
  root = current_app.config.get("UPLOAD_FOLDER", "uploads")
  folder = os.path.join(root, "jobcards", str(jid))
  os.makedirs(folder, exist_ok=True)
  path = os.path.join(folder, fname)
  # prevent overwrite
  base, ext = os.path.splitext(fname)
  i = 1
  while os.path.exists(path):
      fname = f"{base}_{i}{ext}"
      path = os.path.join(folder, fname)
      i += 1
  file.save(path)

  # public URL (adjust to your static serving)
  public_base = current_app.config.get("PUBLIC_UPLOAD_BASE", "/uploads")
  url = f"{public_base}/jobcards/{jid}/{fname}"

  att = JobCardAttachment(
      job_card_id=jid,
      filename=fname,
      url=url,
      content_type=file.mimetype,
      size_bytes=os.path.getsize(path),
      uploaded_by_id=get_jwt_identity(),
  )
  db.session.add(att); db.session.commit()
  return att.to_dict(), 201

@jobcards_bp.route("/jobcards/<int:jid>/attachments/<int:aid>", methods=["DELETE","OPTIONS"])
@jwt_required()
def delete_jobcard_attachment(jid: int, aid: int):
  from models import JobCardAttachment, db
  att = JobCardAttachment.query.get_or_404(aid)
  if att.job_card_id != jid:
      return {"message": "mismatch"}, 400
  # best-effort remove file
  try:
      local_path = att.url
      # if you store as /uploads/... map it to filesystem path
      root = current_app.config.get("UPLOAD_FOLDER", "uploads")
      # strip PUBLIC_UPLOAD_BASE
      public_base = current_app.config.get("PUBLIC_UPLOAD_BASE", "/uploads")
      rel = att.url.split(public_base, 1)[-1].lstrip("/")
      local_path = os.path.join(root, rel)
      if os.path.exists(local_path):
          os.remove(local_path)
  except Exception:
      pass
  db.session.delete(att); db.session.commit()
  return ("", 204)