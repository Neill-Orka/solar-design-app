# routes/quotes.py
from flask import Blueprint, jsonify
from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from datetime import datetime
from zoneinfo import ZoneInfo

from models import (
    db,
    Projects,
    Clients,
    Product,
    BOMComponent,
    User,
    Document,
    DocumentVersion,
    DocumentLineItem,
    DocumentEvent,
    DocumentKind,
    DocumentStatus,
    VersionStatus,
)
from routes.projects import mark_project_activity, optional_user_id

quotes_bp = Blueprint("quotes", __name__)
SA_TZ = ZoneInfo("Africa/Johannesburg")


def _latest_version(doc: Document):
    # Document.versions is lazy="dynamic"
    return doc.versions.order_by(DocumentVersion.version_no.desc()).first()


def _generate_quote_number(project: Projects) -> str:
    """ORKA-{ProjId}-{YYYY}-{NNNN} per-project-per-year sequence."""
    year = datetime.now(SA_TZ).year
    base = f"Orka_Solar_QTE_P{project.id}_{year}"
    # Count existing quotes (this year) for this project
    q = (
        Document.query.filter(Document.project_id == project.id)
        .filter(Document.kind == DocumentKind.QUOTE)
        .filter(Document.created_at >= datetime(year, 1, 1))
        .count()
    )
    seq = q + 1
    return f"{base}-{seq:04d}"


def _margin_for(bom_row: BOMComponent, prod: Product) -> float:
    # margin stored as decimal (0.25 = 25%); fallback to 0 if None
    if bom_row.override_margin is not None:
        return float(bom_row.override_margin or 0.0)
    return float(prod.margin or 0.0)


def _unit_cost_for(bom_row: BOMComponent, prod: Product) -> float:
    return float(
        (
            bom_row.unit_cost_at_time
            if bom_row.unit_cost_at_time is not None
            else prod.unit_cost
        )
        or 0.0
    )


def _unit_price_locked_for(bom_row: BOMComponent, prod: Product) -> float:
    # If row already has a locked price, keep it; else derive: cost * (1 + margin) (fallback to prod.price)
    if bom_row.price_at_time is not None:
        return float(bom_row.price_at_time)
    cost = _unit_cost_for(bom_row, prod)
    m = _margin_for(bom_row, prod)
    derived = cost * (1.0 + m) if cost > 0 else float(prod.price or 0.0)
    return float(derived)


def _product_snapshot(prod: Product) -> dict:
    # Minimal snapshot to reproduce documents even if catalog changes
    return {
        "id": prod.id,
        "category": getattr(prod, "category", None),
        "brand": getattr(prod, "brand_name", None),
        "model": getattr(prod, "description", None),
        "warranty_y": getattr(prod, "warranty_y", None),
        "notes": getattr(prod, "notes", None),
        "supplier": getattr(prod, "supplier", None),
        # useful electricals if present (safe to omit if null)
        "power_w": getattr(prod, "power_w", None),
        "rating_kva": getattr(prod, "rating_kva", None),
        "capacity_kwh": getattr(prod, "capacity_kwh", None),
    }


@quotes_bp.route("/projects/<int:project_id>/quotes", methods=["POST"])
@jwt_required(optional=True)  # allow manual testing; we’ll attach user if available
def create_quote_from_bom(project_id: int):
    """
    Create a new Document(kind='quote') + v1 snapshot from the current BOM (workbench).
    Response: {document, version, line_items, totals}
    """
    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Load workbench rows
    bom_rows = BOMComponent.query.filter_by(project_id=project_id).all()
    if not bom_rows:
        return jsonify({"error": "No BOM found for this project"}), 400

    # Extras (single BOM-level number; stored redundantly on rows today)
    extras_excl_vat = 0.0
    for r in bom_rows:
        if getattr(r, "extras_cost", None) is not None:
            extras_excl_vat = float(r.extras_cost or 0.0)
            break

    # Build snapshot lines
    line_items_locked = []
    subtotal_items_ex_vat = 0.0
    subtotal_items_cost = 0.0

    # (User for audit)
    user_id = None
    try:
        ident = get_jwt_identity()
        if ident:
            user = User.query.get(int(ident))
            user_id = user.id if user else None
    except Exception:
        pass

    for r in bom_rows:
        prod = Product.query.get(r.product_id)
        if not prod:
            # Skip orphaned rows (or raise if you prefer)
            continue

        unit_cost = _unit_cost_for(r, prod)
        unit_price_locked = _unit_price_locked_for(r, prod)
        qty = float(r.quantity or 1)

        subtotal_items_ex_vat += unit_price_locked * qty
        subtotal_items_cost += unit_cost * qty

        li = DocumentLineItem(
            product_id=prod.id,
            product_snapshot_json=_product_snapshot(prod),
            qty=qty,
            unit_cost_locked=unit_cost,
            unit_price_locked=unit_price_locked,
            margin_locked=_margin_for(r, prod),
            line_total_locked=unit_price_locked * qty,
        )
        line_items_locked.append(li)

    # Totals (15% VAT in SA)
    vat_perc = 15.0
    total_excl_vat = subtotal_items_ex_vat + extras_excl_vat
    vat_price = total_excl_vat * (vat_perc / 100.0)
    total_incl_vat = total_excl_vat + vat_price

    # Envelope
    number = _generate_quote_number(project)
    doc = Document(
        project_id=project.id,
        kind=DocumentKind.QUOTE,
        number=number,
        current_version_no=1,
        status=DocumentStatus.OPEN,
        created_by_id=user_id,
        client_snapshot_json={
            "name": project.client.client_name if project.client else None,
            "email": project.client.email if project.client else None,
            "phone": project.client.phone if project.client else None,
            "location": project.location,
        },
    )
    db.session.add(doc)
    db.session.flush()  # get doc.id

    # Version (v1, draft)
    version = DocumentVersion(
        document_id=doc.id,
        version_no=1,
        status=VersionStatus.DRAFT,
        payload_json={
            "extras_excl_vat": extras_excl_vat,
            "vat_perc": vat_perc,
            "workbench_quote_status": getattr(bom_rows[0], "quote_status", "draft"),
            "layout_flags": {},  # placeholder for PDF/render options
            "terms": None,  # placeholder
            "bank_details": None,  # placeholder
        },
        totals_json={
            "subtotal_items_excl_vat": subtotal_items_ex_vat,
            "extras_excl_vat": extras_excl_vat,
            "total_excl_vat": total_excl_vat,
            "vat_perc": vat_perc,
            "vat_price": vat_price,
            "total_incl_vat": total_incl_vat,
            "subtotal_items_cost": subtotal_items_cost,
            "total_markup": total_excl_vat - subtotal_items_cost,
        },
        created_by_id=user_id,
    )
    db.session.add(version)
    db.session.flush()  # get version.id

    # Attach immutable line items
    for li in line_items_locked:
        li.document_version_id = version.id
        db.session.add(li)

    # Event
    evt = DocumentEvent(
        document_version_id=version.id,
        event="created",
        meta_json={"source": "workbench_bom_snapshot"},
        created_by_id=user_id,
    )
    db.session.add(evt)

    mark_project_activity(project_id, optional_user_id())

    db.session.commit()

    return (
        jsonify(
            {
                "document": doc.to_dict(),
                "version": version.to_dict(include_lines=True),
            }
        ),
        201,
    )


@quotes_bp.get("/projects/<int:project_id>/quotes")
def list_project_quotes(project_id):
    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    docs = (
        Document.query.filter_by(project_id=project_id, kind=DocumentKind.QUOTE)
        .order_by(Document.created_at.desc())
        .all()
    )

    out = []
    for d in docs:
        v = _latest_version(d)
        updated_at = v.created_at if v else d.created_at

        # Get current version status for the quote status display
        current_version = d.versions.filter_by(version_no=d.current_version_no).first()
        display_status = d.status.value if d.status else None

        # If document is open but current version is sent, show 'sent' status
        if (
            d.status.value == "open"
            and current_version
            and current_version.status.value == "sent"
        ):
            display_status = "sent"

        out.append(
            {
                "id": d.id,
                "number": d.number,
                "status": display_status,
                "created_at": d.created_at.isoformat() + "Z",
                "updated_at": updated_at.isoformat() + "Z",
                "version_count": d.versions.count(),  # dynamic rel
                "latest_version_no": v.version_no if v else None,
                "latest_totals": v.totals_json if v else None,
                "created_by": {
                    "id": d.created_by.id if d.created_by else None,
                    "full_name": d.created_by.full_name if d.created_by else "Unknown",
                },
            }
        )

        mark_project_activity(project_id, optional_user_id())
        db.session.commit()
    return jsonify(out), 200


@quotes_bp.get("/quotes/<int:document_id>")
def get_quote(document_id):
    d = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not d:
        return jsonify({"error": "Quote not found"}), 404

    versions = []
    for v in d.versions.order_by(DocumentVersion.version_no.asc()).all():
        versions.append(
            {
                "id": v.id,
                "version_no": v.version_no,
                "created_at": v.created_at.isoformat() + "Z",
                "status": v.status.value if v.status else None,
                "totals": v.totals_json,
                "lines_count": len(v.line_items),
            }
        )

    # Get current version status for the quote status display
    current_version = d.versions.filter_by(version_no=d.current_version_no).first()
    display_status = d.status.value if d.status else None

    # If document is open but current version is sent, show 'sent' status
    if (
        d.status.value == "open"
        and current_version
        and current_version.status.value == "sent"
    ):
        display_status = "sent"

    return (
        jsonify(
            {
                "id": d.id,
                "number": d.number,
                "status": display_status,
                "project_id": d.project_id,
                "created_at": d.created_at.isoformat() + "Z",
                "versions": versions,
            }
        ),
        200,
    )


@quotes_bp.get("/quote-versions/<int:version_id>")
def get_quote_version(version_id):
    v = DocumentVersion.query.get(version_id)
    if not v:
        return jsonify({"error": "Version not found"}), 404

    lines = []
    for li in v.line_items:
        p = li.product  # may be None if product removed from catalog
        snapshot = li.product_snapshot_json or {}
        lines.append(
            {
                "id": li.id,
                "product_id": li.product_id,
                "category": (p.category if p else snapshot.get("category")),
                "brand": (p.brand_name if p else snapshot.get("brand")),
                "model": (p.description if p else snapshot.get("model")),
                "qty": li.qty,
                "unit_cost_locked": li.unit_cost_locked,
                "unit_price_locked": li.unit_price_locked,
                "margin_locked": li.margin_locked,
                "line_total_locked": li.line_total_locked,
                "product_snapshot": snapshot,
            }
        )

    return (
        jsonify(
            {
                "id": v.id,
                "document_id": v.document_id,
                "version_no": v.version_no,
                "created_at": v.created_at.isoformat() + "Z",
                "status": v.status.value if v.status else None,
                "totals": v.totals_json,
                "payload": v.payload_json,
                "lines": lines,
                "pdf_path": v.pdf_path,
            }
        ),
        200,
    )


@quotes_bp.route("/quote-versions/<int:version_id>/load-to-bom", methods=["POST"])
def load_version_to_bom(version_id):
    v = DocumentVersion.query.get_or_404(version_id)
    doc = v.document
    project_id = doc.project_id

    # Clear current BOM and repopulate from saved version
    BOMComponent.query.filter_by(project_id=project_id).delete()

    # Grab an extras figure from the version totals if present
    extras_cost = 0.0
    try:
        if v.totals_json and isinstance(v.totals_json, dict):
            extras_cost = float(v.totals_json.get("extras_excl_vat") or 0)
    except Exception:
        extras_cost = 0.0

    # Default to draft so the user can edit margins/qty immediately
    quote_status = "draft"

    # Track core components for SystemDesign synchronization
    core_components = {"panel": None, "inverter": None, "battery": None}

    count = 0
    for li in v.line_items:
        # Only map items that still reference a product id
        if not li.product_id:
            continue

        # Get product and snapshot for core component detection
        product = li.product
        snapshot = li.product_snapshot_json or {}
        category = (
            product.category if product else snapshot.get("category", "")
        ).lower()

        # Track core components with their quantities
        if category == "panel":
            core_components["panel"] = {
                "product_id": li.product_id,
                "quantity": li.qty or 1,
                "product": product,
            }
        elif category == "inverter":
            core_components["inverter"] = {
                "product_id": li.product_id,
                "quantity": li.qty or 1,
                "product": product,
            }
        elif category == "battery":
            core_components["battery"] = {
                "product_id": li.product_id,
                "quantity": li.qty or 1,
                "product": product,
            }

        bom = BOMComponent(
            project_id=project_id,
            product_id=li.product_id,
            quantity=li.qty or 1,
            override_margin=li.margin_locked,  # keep the margin as a starting point
            unit_cost_at_time=li.unit_cost_locked,  # optional, shows old vs live when not draft
            price_at_time=li.unit_price_locked,  # optional, shows old vs live when not draft
            quote_status=quote_status,
            extras_cost=extras_cost,
        )
        db.session.add(bom)
        count += 1
    mark_project_activity(project_id, optional_user_id())
    db.session.commit()

    # Update the project's core components to match the quote
    project = Projects.query.get(project_id)
    if project:
        # Update panel_id
        if core_components["panel"] and core_components["panel"]["product"]:
            project.panel_id = core_components["panel"]["product_id"]
            project.num_panels = core_components["panel"]["quantity"]
            panel_product = core_components["panel"]["product"]
            panel_power_w = getattr(
                core_components["panel"]["product"], "power_w", None
            )
            if panel_power_w:
                project.panel_kw = (
                    panel_power_w * core_components["panel"]["quantity"] / 1000.0
                )

            # panel metadata
            project.panel_metadata = {
                "brand": getattr(panel_product, "brand_name", ""),
                "model": getattr(panel_product, "description", ""),
                "power_w": panel_power_w,
            }

        # Update inverter_ids (stored as JSON array) and inverter_kva with quantity
        if core_components["inverter"] and core_components["inverter"]["product"]:
            project.inverter_ids = [core_components["inverter"]["product_id"]]
            inverter_product = core_components["inverter"]["product"]
            inverter_rating = getattr(inverter_product, "rating_kva", None)
            if inverter_rating:
                project.inverter_kva = {
                    "brand": getattr(inverter_product, "brand_name", ""),
                    "model": getattr(inverter_product, "description", ""),
                    "capacity": inverter_rating
                    * core_components["inverter"]["quantity"],
                    "quantity": core_components["inverter"]["quantity"],
                }

        # Update battery_ids (stored as JSON array) and battery_kwh with quantity
        if core_components["battery"] and core_components["battery"]["product"]:
            project.battery_ids = [core_components["battery"]["product_id"]]
            battery_product = core_components["battery"]["product"]
            battery_capacity = getattr(battery_product, "capacity_kwh", None)
            if battery_capacity:
                project.battery_kwh = {
                    "brand": getattr(battery_product, "brand_name", ""),
                    "model": getattr(battery_product, "description", ""),
                    "capacity": battery_capacity,
                    "quantity": core_components["battery"]["quantity"],
                }

        project.bom_modified = True
        db.session.commit()

    # Return core components info for frontend synchronization
    response_data = {
        "message": "Version loaded into BOM",
        "rows": count,
        "core_components": {
            "quote_name": f"{doc.number}",
            "quote_number": doc.number,
            "system_type": project.system_type,
        },
    }

    # Add core component details to response
    for comp_type, comp_data in core_components.items():
        if comp_data and comp_data["product"]:
            product = comp_data["product"]
            response_data["core_components"][comp_type] = {
                "id": product.id,
                "quantity": comp_data["quantity"],
                "brand": getattr(product, "brand_name", ""),
                "model": getattr(product, "description", ""),
                "power_w": getattr(product, "power_w", None),
                "rating_kva": getattr(product, "rating_kva", None),
                "capacity_kwh": getattr(product, "capacity_kwh", None),
            }

    return jsonify(response_data), 200


@quotes_bp.route("/quotes/<int:document_id>/versions", methods=["POST"])
def create_version_from_bom(document_id):
    # 1) Load document + project
    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404
    project_id = doc.project_id

    # 2) Load current BOM rows
    bom_rows = BOMComponent.query.filter_by(project_id=project_id).all()
    if not bom_rows:
        return jsonify({"error": "No BOM rows to snapshot"}), 400

    # 3) Identify user (optional)
    user_id = None
    try:
        ident = get_jwt_identity()
        if ident:
            u = User.query.get(int(ident))
            user_id = u.id if u else None
    except Exception:
        pass

    # 4) Pricing logic — same precedence as elsewhere
    DEFAULT_MARGIN = 0.25
    VAT_PERC = 15.0

    subtotal_items_ex_vat = 0.0
    subtotal_items_cost = 0.0
    extras_excl_vat = next(
        (float(r.extras_cost or 0) for r in bom_rows if r.extras_cost is not None), 0.0
    )

    # 5) Next version number
    max_no = (
        db.session.query(db.func.max(DocumentVersion.version_no))
        .filter_by(document_id=document_id)
        .scalar()
        or 0
    )
    v = DocumentVersion(
        document_id=document_id,
        version_no=max_no + 1,
        status=VersionStatus.DRAFT,
        created_by_id=user_id,
        payload_json={},  # will set after we compute totals
        totals_json={},
    )
    db.session.add(v)
    db.session.flush()  # need v.id

    # 6) Snapshot each line
    for r in bom_rows:
        p = Product.query.get(r.product_id)
        if not p:
            continue

        # precedence: override_margin -> product.margin -> default
        margin = float(
            r.override_margin
            if r.override_margin is not None
            else (p.margin if p.margin is not None else DEFAULT_MARGIN)
        )
        unit_cost = float(p.unit_cost or 0)
        unit_price = unit_cost * (1.0 + margin)
        qty = float(r.quantity or 1)

        subtotal_items_cost += unit_cost * qty
        subtotal_items_ex_vat += unit_price * qty

        li = DocumentLineItem(
            document_version_id=v.id,
            product_id=p.id,
            product_snapshot_json={
                "id": p.id,
                "category": getattr(p, "category", None),
                "brand": getattr(p, "brand_name", None),
                "model": getattr(p, "description", None),
                "warranty_y": getattr(p, "warranty_y", None),
                "notes": getattr(p, "notes", None),
                "supplier": getattr(p, "supplier", None),
                "power_w": getattr(p, "power_w", None),
                "rating_kva": getattr(p, "rating_kva", None),
                "capacity_kwh": getattr(p, "capacity_kwh", None),
            },
            qty=qty,
            margin_locked=margin,
            unit_cost_locked=unit_cost,
            unit_price_locked=unit_price,
            line_total_locked=unit_price * qty,
        )
        db.session.add(li)

    # 7) Totals
    total_excl_vat = subtotal_items_ex_vat + extras_excl_vat
    vat_price = total_excl_vat * (VAT_PERC / 100.0)
    total_incl_vat = total_excl_vat + vat_price

    # payload + totals (mirror v1 fields so UI stays consistent)
    v.payload_json = {
        "extras_excl_vat": extras_excl_vat,
        "vat_perc": VAT_PERC,
        "workbench_quote_status": getattr(bom_rows[0], "quote_status", "draft"),
        "layout_flags": {},
        "terms": None,
        "bank_details": None,
    }
    v.totals_json = {
        "subtotal_items_excl_vat": subtotal_items_ex_vat,
        "extras_excl_vat": extras_excl_vat,
        "total_excl_vat": total_excl_vat,
        "vat_perc": VAT_PERC,
        "vat_price": vat_price,
        "total_incl_vat": total_incl_vat,
        "subtotal_items_cost": subtotal_items_cost,
        "total_markup": total_excl_vat - subtotal_items_cost,
    }

    # 8) Update envelope pointer + event
    doc.current_version_no = v.version_no
    evt = DocumentEvent(
        document_version_id=v.id,
        event="created",
        meta_json={"source": "workbench_bom_snapshot"},
        created_by_id=user_id,
    )
    db.session.add(evt)

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Version created",
                "version_id": v.id,
                "version_no": v.version_no,
            }
        ),
        201,
    )


@quotes_bp.route("/quotes/<int:document_id>/send", methods=["POST"])
@jwt_required(optional=True)
def send_quote(document_id):
    """Send a quote (mark as sent, lock version, set valid_until)"""
    user_id = None
    try:
        user_id = get_jwt_identity()
    except Exception:
        pass

    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404

    try:
        doc.mark_sent(user_id)

        db.session.commit()
        return jsonify(
            {"message": "Quote sent successfully", "status": doc.status.value}
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to send quote"}), 500


@quotes_bp.route("/quotes/<int:document_id>/accept", methods=["POST"])
@jwt_required(optional=True)
def accept_quote(document_id):
    """Mark a quote as accepted"""
    user_id = None
    try:
        user_id = get_jwt_identity()
    except Exception:
        pass

    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404

    try:
        doc.mark_accepted(user_id)
        db.session.commit()
        return jsonify({"message": "Quote accepted", "status": doc.status.value})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to accept quote"}), 500


@quotes_bp.route("/quotes/<int:document_id>/decline", methods=["POST"])
@jwt_required(optional=True)
def decline_quote(document_id):
    """Mark a quote as declined"""
    user_id = None
    try:
        user_id = get_jwt_identity()
    except Exception:
        pass

    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404

    try:
        doc.mark_declined(user_id)
        db.session.commit()
        return jsonify({"message": "Quote declined", "status": doc.status.value})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to decline quote"}), 500


@quotes_bp.route("/quotes/<int:document_id>", methods=["DELETE"])
@jwt_required(optional=True)
def delete_quote(document_id):
    """Delete a quote and all its versions"""
    user_id = None
    try:
        user_id = get_jwt_identity()
    except Exception:
        pass

    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404

    try:
        # Delete all versions and their line items (CASCADE should handle this)
        # Delete all events related to this document's versions
        for version in doc.versions:
            DocumentEvent.query.filter_by(document_version_id=version.id).delete()
            DocumentLineItem.query.filter_by(document_version_id=version.id).delete()

        DocumentVersion.query.filter_by(document_id=document_id).delete()

        # Delete the document
        db.session.delete(doc)
        db.session.commit()

        return jsonify({"message": "Quote deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to delete quote"}), 500


@quotes_bp.route("/quotes/<int:document_id>/rename", methods=["PATCH"])
@jwt_required(optional=True)
def rename_quote(document_id):
    """Rename a quote by updating its number (keeping the sequence number)"""
    user_id = None
    try:
        user_id = get_jwt_identity()
    except Exception:
        pass

    doc = Document.query.filter_by(id=document_id, kind=DocumentKind.QUOTE).first()
    if not doc:
        return jsonify({"error": "Quote not found"}), 404

    data = request.get_json()
    new_prefix = data.get("new_prefix", "").strip()

    if not new_prefix:
        return jsonify({"error": "New prefix is required"}), 400

    try:
        # Extract the sequence number from the current quote number
        # Use regex to find the last sequence of digits
        import re

        current_number = doc.number
        match = re.search(r"(\d+)$", current_number)
        if match:
            sequence_part = match.group(1)
            new_number = f"{new_prefix}{sequence_part}"
        else:
            return jsonify({"error": "No numeric sequence found in quote number"}), 400

        # Check if the new number already exists
        existing = (
            Document.query.filter_by(number=new_number, kind=DocumentKind.QUOTE)
            .filter(Document.id != document_id)
            .first()
        )
        if existing:
            return jsonify({"error": "Quote number already exists"}), 400

        # Update the quote number
        doc.number = new_number
        db.session.commit()

        return jsonify(
            {"message": "Quote renamed successfully", "new_number": new_number}
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to rename quote"}), 500
