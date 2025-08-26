# routes/quotes.py
from flask import Blueprint, jsonify
from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from datetime import datetime
from zoneinfo import ZoneInfo

from models import (
    db, Projects, Clients, Product, BOMComponent, User,
    Document, DocumentVersion, DocumentLineItem, DocumentEvent,
    DocumentKind, DocumentStatus, VersionStatus
)

quotes_bp = Blueprint("quotes", __name__)
SA_TZ = ZoneInfo("Africa/Johannesburg")

def _generate_quote_number(project: Projects) -> str:
    """ORKA-{ProjId}-{YYYY}-{NNNN} per-project-per-year sequence."""
    year = datetime.now(SA_TZ).year
    base = f"ORKA-P{project.id}-{year}"
    # Count existing quotes (this year) for this project
    q = (
        Document.query
        .filter(Document.project_id == project.id)
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
    return float((bom_row.unit_cost_at_time if bom_row.unit_cost_at_time is not None else prod.unit_cost) or 0.0)

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
            "layout_flags": {},      # placeholder for PDF/render options
            "terms": None,           # placeholder
            "bank_details": None,    # placeholder
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

    db.session.commit()

    return jsonify({
        "document": doc.to_dict(),
        "version": version.to_dict(include_lines=True),
    }), 201
