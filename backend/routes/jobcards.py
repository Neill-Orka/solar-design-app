# routes/jobcards.py
from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
from models import Document, JobCardMaterial, db, JobCard, Clients, JobCategory, Vehicle, DocumentKind, DocumentStatus, DocumentVersion, Product, User, UserRole, JobCardTimeEntry, TechnicianProfile, JobCardReviewStatus
from werkzeug.utils import secure_filename
import os
from routes.auth import log_user_action
from sqlalchemy.orm import aliased

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
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        scope = (request.args.get("scope") or "").strip().lower() or None
        status = (request.args.get("status") or "").strip().lower() or None
        q = (request.args.get("q") or "").strip()

        qry = JobCard.query

        # Join the owner to allow filtering by technician name (an owner is the technician)
        Owner = aliased(User)
        qry = qry.join(Owner, JobCard.owner_id == Owner.id)

        # Hard security: technician users see only their own job cards
        if user and (not getattr(user, "is_bum", False)) and user.role not in (UserRole.ADMIN,):
            qry = qry.filter(JobCard.owner_id == current_user_id)
        else:
            # BUM / ADMIN logic: allow scopes
            if scope == 'bum':
                qry = qry.filter(JobCard.bum_id == current_user_id)
            elif scope == 'mine':
                qry = qry.filter(JobCard.owner_id == current_user_id)

        # status filter: try bum_status enum first, else fall back to lifecycle strings
        if status:
            try:
                enum_val = JobCardReviewStatus(status)
                qry = qry.filter(JobCard.bum_status == enum_val)
            except Exception:
                qry = qry.filter(JobCard.status.ilike(status))

        # technician name search against owner name
        if q:
            term = f"%{q.lower()}%"
            qry = qry.filter(
                (Owner.first_name.ilike(term)) | (Owner.last_name.ilike(term))  #| (Owner.first_name + " " + Owner.last_name.ilike(term))
            )

        rows = qry.order_by(JobCard.created_at.desc()).all()
        return jsonify([j.to_dict(with_lines=True) for j in rows])

    data = request.get_json() or {}
    jc = JobCard(
        client_id=data["client_id"],
        owner_id=data["owner_id"],
        bum_id=int(data["bum_id"]) if data.get("bum_id") else None,
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
        bum_comment=data.get("bum_comment"),
        created_by_id=int(get_jwt_identity()),
    )
    # snapshot client
    client = Clients.query.get(jc.client_id)
    if client:
        jc.client_name_snapshot   = _str255(getattr(client, "client_name", None))
        jc.client_email_snapshot  = _str255(getattr(client, "email", None))
        jc.client_address_snapshot= _str255(getattr(client, "address", None))

    # optional BUM status at creation
    if "bum_status" in data and data.get("bum_status"):
        raw = str(data.get("bum_status"))
        new_stat = None
        try:
            new_stat = JobCardReviewStatus(raw)
        except Exception:
            # Try normalized variants
            norm = raw.strip().lower().replace("-", "_").replace(" ", "_")
            try:
                new_stat = JobCardReviewStatus(norm)
            except Exception:
                new_stat = None

        if new_stat:
            jc.bum_status = new_stat
            if new_stat != JobCardReviewStatus.OPEN:
                current_user_id = int(get_jwt_identity())
                jc.bum_reviewed_by_id = current_user_id
                jc.bum_reviewed_at = datetime.now()
        else: jc.bum_status = JobCardReviewStatus.OPEN


    db.session.add(jc)
    db.session.commit()

    time_entries = data.get("time_entries") or []
    if isinstance(time_entries, list):
        for te in time_entries:
            try:
                uid = int(te.get("user_id"))
                hours = float(te.get("hours", 0))
                if hours <= 0:
                    continue
            except Exception:
                continue
            prof = TechnicianProfile.query.filter_by(user_id=uid, active=True).first()
            rate = float(prof.hourly_rate) if prof else 0.0
            db.session.add(JobCardTimeEntry(
                job_card_id=jc.id,
                user_id=uid,
                hours=hours,
                hourly_rate_at_time=rate
            ))
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
            "coc_required","status","owner_id", "bum_id",
            "bum_comment"
        ]:
            if f in data:
                val = _parse_dt(data[f]) if f in ("start_at","complete_at") else data[f]
                setattr(jc, f, val)

        # Handle BUM status update (only BUMs or admins)
        if "bum_status" in data:
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)
            if not user or (not user.is_bum and user.role != UserRole.ADMIN):
                return jsonify({"error": "Only BUMs or administrators can set bum_status"}), 403

            raw = str(data.get("bum_status"))
            try:
                # Accept enum value first
                new_status = JobCardReviewStatus(raw)
            except Exception:
                try:
                    # Accept ENUM name ("APPROVED")
                    new_status = JobCardReviewStatus[raw.upper()]
                except Exception:
                    return jsonify({"error": f"Invalid bum_status {raw}"}), 400

            jc.bum_status = new_status
            jc.bum_reviewed_by_id = current_user_id
            jc.bum_reviewed_at = datetime.now()

        db.session.commit()
        return jsonify(jc.to_dict())

    if request.method == "DELETE":
        # Get current user
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        # Check if the user is admin
        if not user or user.role != UserRole.ADMIN:
            return jsonify({"error": "Only administrators can delete job cards"}), 403
        
        # Log the action before deletion
        log_user_action(
            user_id=current_user_id,
            action='DELETE',
            resource_type='job_card',
            resource_id=jc.id,
            details = {
                'job_card_id': jc.id,
                'client_name': jc.client_name_snapshot,
                'title': jc.title,
                'created_by': jc.created_by_id
            }
        )

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

  kind = request.form.get("attachment_type") or request.form.get("type") or "site"
  caption = request.form.get("caption") or None

  att = JobCardAttachment(
      job_card_id=jid,
      filename=fname,
      url=url,
      content_type=file.mimetype,
      size_bytes=os.path.getsize(path),
      uploaded_by_id=get_jwt_identity(),
      attachment_type=kind if kind in ("site", "receipt") else "site",
      caption=caption,
  )
  db.session.add(att); db.session.commit()
  return att.to_dict(), 201

@jobcards_bp.route("/jobcards/<int:jid>/attachments/<int:aid>/caption", methods=["PATCH"])
@jwt_required()
def update_jobcard_attachment_caption(jid: int, aid: int):
    from models import JobCardAttachment, db
    att = JobCardAttachment.query.get_or_404(aid)
    if att.job_card_id != jid:
        return jsonify({"error": "Attachment not found"}), 400
    data = request.get_json() or {}
    att.caption = (data.get("caption") or "").strip() or None
    db.session.commit()
    return jsonify(att.to_dict())

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

# ----------- Materials Used (Get Quotes) ---------------------------------------------------
@jobcards_bp.route("jobcards/projects/<int:project_id>/accepted_quotes", methods=["GET"])
@jwt_required()
def get_accepted_quotes_for_project(project_id):
    """ GET all accepted quotes for a project """
    try:
        # Find quotes with ACCEPTED status for this project
        quotes = Document.query.filter_by(
            project_id=project_id,
            kind=DocumentKind.QUOTE,
            status=DocumentStatus.ACCEPTED
        ).all()

        result = []
        for quote in quotes:
            # Get the latest version
            latest_version = quote.versions.order_by(DocumentVersion.version_no.desc()).first()
            if latest_version:
                result.append({
                    "id": quote.id,
                    "number": quote.number,
                    "created_at": quote.created_at.isoformat(),
                    "version_id": latest_version.id,
                    "version_no": latest_version.version_no,
                    "totals": latest_version.totals_json
                })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@jobcards_bp.route("jobcards/quotes/<int:quote_id>/line_items", methods=["GET"])
@jwt_required()
def get_quote_line_items(quote_id):
    """ GET all line items from the latest version of an accepted quote """
    try: 
        # Find quote and verify it's accepted
        quote = Document.query.filter_by(
            id=quote_id, 
            kind=DocumentKind.QUOTE,
            status=DocumentStatus.ACCEPTED
        ).first()

        if not quote:
            return jsonify({"error": "Accepted quote not found"}), 404
        
        # Get the latest version
        latest_version = quote.versions.order_by(DocumentVersion.version_no.desc()).first()
        if not latest_version:
            return jsonify({"error": "No versions found for this quote"}), 404
        
        # Get line items
        items = []
        for item in latest_version.line_items:
            # Get the current product if it still exists
            product = Product.query.get(item.product_id) if item.product_id else None

            # Use product snapshot if available, otherwise use current product details
            snapshot = item.product_snapshot_json or {}

            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "name": f"{snapshot.get('brand', product.brand if product else '')} • {snapshot.get('model', product.model if product else '')}".strip(),
                "unit_price": item.unit_price_locked,
                "unit_cost": item.unit_cost_locked,
                "qty": item.qty,
                "from_quote": True
            })

        return jsonify({
            "quote_id": quote.id,
            "quote_number": quote.number,
            "items": items
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@jobcards_bp.route("/jobcards/<int:jid>/material-receipts/<int:material_id>", methods=["POST"])
@jwt_required()
def upload_material_receipt(jid: int, material_id: int):
    from models import JobCard, JobCardMaterial, JobCardAttachment, db
    
    # Verify job card and material exist
    jc = JobCard.query.get_or_404(jid)
    material = JobCardMaterial.query.get_or_404(material_id)
    
    if material.job_card_id != jid:
        return jsonify({"error": "Material does not belong to this job card"}), 400
    
    file = request.files.get('file')
    if not file:
        return {"message": "file required"}, 400
        
    # Similar file upload logic as attachments
    fname = secure_filename(file.filename or "receipt.jpg")
    root = current_app.config.get("UPLOAD_FOLDER", "uploads")
    folder = os.path.join(root, "jobcards", str(jid), "receipts")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, fname)
    
    # Prevent overwrite
    base, ext = os.path.splitext(fname)
    i = 1
    while os.path.exists(path):
        fname = f"{base}_{i}{ext}"
        path = os.path.join(folder, fname)
        i += 1
        
    file.save(path)

    # Public URL
    public_base = current_app.config.get("PUBLIC_UPLOAD_BASE", "/uploads")
    url = f"{public_base}/jobcards/{jid}/receipts/{fname}"
    
    # Create an attachment for tracking
    att = JobCardAttachment(
        job_card_id=jid,
        filename=fname,
        url=url,
        content_type=file.mimetype,
        size_bytes=os.path.getsize(path),
        uploaded_by_id=get_jwt_identity(),
        attachment_type="receipt",
    )
    
    db.session.add(att)
    db.session.commit()
    
    # Also update the material with a note about the receipt
    material.note = f"Receipt photo: {url}"
    db.session.commit()
    
    return att.to_dict(), 201

@jobcards_bp.route("/jobcards/materials", methods=["POST"])
@jwt_required()
def create_jobcard_material():
    """Create a material line item for a job card"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required = ["job_card_id", "product_id", "quantity"]
        for field in required:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Verify job card exists
        job_card = JobCard.query.get_or_404(data["job_card_id"])
        
        # Verify product exists
        product = Product.query.get_or_404(data["product_id"])
        
        # Create the material entry
        material = JobCardMaterial(
            job_card_id=data["job_card_id"],
            product_id=data["product_id"],
            quantity=data["quantity"],
            unit_cost_at_time=data.get("unit_cost_at_time"),
            unit_price_at_time=data.get("unit_price_at_time"),
            note=data.get("note")
        )
        
        db.session.add(material)
        db.session.commit()
        
        # Set product name for response
        response = material.to_dict() if hasattr(material, 'to_dict') else {
            "id": material.id,
            "job_card_id": material.job_card_id,
            "product_id": material.product_id,
            "product_name": f"{product.brand_name} {product.description}",
            "quantity": material.quantity,
            "unit_cost_at_time": material.unit_cost_at_time,
            "unit_price_at_time": material.unit_price_at_time,
            "note": material.note
        }
        
        return jsonify(response), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500    
    
@jobcards_bp.route("/jobcards/<int:jid>/invoices", methods=["POST", "OPTIONS"])
@jwt_required()
def create_invoice_for_jobcard(jid: int):
    """
    Create an invoice from a Job Card (standalone or project-linked).
    Request body (optional):
      {
        "type": "final" | "misc",   # default 'final' (for now this only influences the title/notes)
        "note": "string note to include on invoice"
      }
    Returns:
      { "invoice_id": number, "project_id": number|null }
    """
    from models import JobCard, Invoice, InvoiceItem, Clients, Product, db
    from datetime import datetime, timedelta

    # CORS preflight shortcut
    if request.method == "OPTIONS":
        return ("", 204)
    
    jc = JobCard.query.get_or_404(jid)

    body = request.get_json() or {}
    inv_type = (body.get("type") or "final").lower()
    vat_rate = 15.0

    # Build billing snapshot
    client_name = jc.client_name_snapshot or (jc.client.client_name if jc.client else None)
    billing = {
        "name": client_name,
        "company": getattr(jc.client, "company", None) if jc.client else None,
        "vat_no": getattr(jc.client, "vat_number", None) if jc.client else None,
        "address": jc.client_address_snapshot,
    }

    # Complete invoice items from job card
    items = []
    subtotal = 0.0

    # Labour (per item entry) 
    for te in jc.time_entries:
        hours = float(te.hours or 0)
        rate = float(te.hourly_rate_at_time or 0)
        if hours <= 0 or rate < 0:
            continue
        line_excl = round(hours * rate, 2)
        items.append({
            "product_id": None,
            "description": f"Labour — {te.user.full_name if te.user else 'Technician'}",
            "sku": None,
            "quantity": hours,
            "unit": "hour",
            "unit_price_excl_vat": rate,
            "line_total_excl_vat": line_excl,
            "vat_rate": vat_rate,            
        })
        subtotal += line_excl

    # Materials (per material line)
    for m in jc.materials:
        qty = float(m.quantity or 0)
        unit = float(m.unit_price_at_time or 0)
        if unit == 0:  # fallback to current catalog price if snapshot missing
            if m.product:
                unit = float(m.product.price or 0) or float(m.product.unit_cost or 0)
        if qty <= 0 or unit < 0:
            continue
        line_excl = round(qty * unit, 2)
        name = None
        if m.product:
            brand = m.product.brand if hasattr(m.product, "brand") else getattr(m.product, "brand_name", "")
            model = m.product.model if hasattr(m.product, "model") else getattr(m.product, "description", "")
            name = f"{brand} {model}".strip()
        items.append({
            "product_id": m.product_id,
            "description": name or (m.product_name or "Material"),
            "sku": getattr(m.product, "model_code_sku", None) if m.product else None,
            "quantity": qty,
            "unit": "ea",
            "unit_price_excl_vat": round(unit, 2),
            "line_total_excl_vat": line_excl,
            "vat_rate": vat_rate,
        })
        subtotal += line_excl

    # Travel (optional)
    km = float(jc.travel_distance_km or 0)
    rate_per_km = float(getattr(jc.vehicle, "rate_per_km", 0) or 0)
    if km > 0 and rate_per_km > 0:
        line_excl = round(km * rate_per_km, 2)
        veh_name = jc.vehicle.name if jc.vehicle else "Travel"
        veh_reg = f" ({jc.vehicle.registration})" if (jc.vehicle and jc.vehicle.registration) else ""
        items.append({
            "product_id": None,
            "description": f"Travel — {veh_name}{veh_reg}",
            "sku": None,
            "quantity": km,
            "unit": "km",
            "unit_price_excl_vat": float(rate_per_km),
            "line_total_excl_vat": line_excl,
            "vat_rate": vat_rate,
        })
        subtotal += line_excl

    # Summaries
    vat_amount = round(subtotal * (vat_rate / 100.0), 2)
    total_incl = round(subtotal + vat_amount, 2)

    # ---- Create invoice header ----
    from routes.invoices import _next_invoice_number  # reuse same numbering
    inv = Invoice(
        project_id=jc.project_id,  # can be None for callouts
        quote_number=None,
        quote_version=None,
        invoice_number=_next_invoice_number(),
        invoice_type=inv_type,        # 'final' for jobcards by default
        status="draft",
        issue_date=datetime.utcnow().date(),
        due_date=(datetime.utcnow() + timedelta(days=7)).date(),
        percent_of_quote=None,
        billing_name=billing.get("name"),
        billing_company=billing.get("company"),
        billing_vat_no=billing.get("vat_no"),
        billing_address=billing.get("address"),
        vat_rate=vat_rate,
        subtotal_excl_vat=subtotal,
        vat_amount=vat_amount,
        total_incl_vat=total_incl,
        notes=(body.get("note") or None),
    )
    db.session.add(inv)
    db.session.flush()  # get inv.id

    # Lines
    for it in items:
        db.session.add(InvoiceItem(
            invoice_id=inv.id,
            product_id=it["product_id"],
            description=it["description"] or "Line Item",
            sku=it["sku"],
            quantity=it["quantity"],
            unit=it["unit"],
            unit_price_excl_vat=it["unit_price_excl_vat"],
            line_total_excl_vat=it["line_total_excl_vat"],
            vat_rate=it["vat_rate"],
            line_vat=round(it["line_total_excl_vat"] * (it["vat_rate"] / 100.0), 2),
            line_total_incl_vat=round(it["line_total_excl_vat"] * (1 + it["vat_rate"] / 100.0), 2),
        ))

    # Mark BUM review state if caller already set it via PATCH earlier — we don't change here.
    db.session.commit()

    return jsonify({"invoice_id": inv.id, "project_id": inv.project_id}), 201

    