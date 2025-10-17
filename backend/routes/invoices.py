from flask import Blueprint, request, jsonify
from models import SA_TZ, db, Projects, BOMComponent, Invoice, InvoiceItem, Product, JobCard, Clients
from datetime import datetime, timedelta
from sqlalchemy import func

invoices_bp = Blueprint('invoices', __name__)

def _next_invoice_number():
    #  generate incremental INV_YYYY-#### per year
    year = datetime.now().year
    prefix = f"INV-{year}-"
    last = db.session.query(Invoice).filter(Invoice.invoice_number.like(f"{prefix}%")) \
        .order_by(Invoice.invoice_number.desc()).first()
    if last and last.invoice_number.rsplit('-', 1)[-1].isdigit():
        n = int(last.invoice_number.rsplit('-', 1)[-1]) + 1
    else:
        n = 1
    return f"{prefix}{n:04d}"

def _load_quote_lines(project_id, quote_number, quote_version=None):
    q = db.session.query(BOMComponent).filter_by(project_id=project_id, quote_number=quote_number)
    if quote_version:
        q = q.filter_by(quote_version=quote_version)
    lines = q.all()
    return lines

def _price_for_component(c: BOMComponent):
    # Prefer snapshot; fallback to live product price if snapshot is missing
    if c.price_at_time is not None:
        unit = c.price_at_time
    else:
        # Fallback: compute from product cost + margin
        p = Product.query.get(c.product_id)
        if not p:
            unit = 0
        else: 
            margin = c.override_margin if c.override_margin is not None else (getattr(p, 'margin', 0) or 0)
            unit_cost = float(getattr(p, "unit_cost", 0) or 0)
            unit = (unit_cost) * (1 + margin)
    return float(unit)

def _compute_items_from_quote(lines, percent=100.0, vat_rate=15.0):
    factor = float(percent) / 100.0
    items = []
    subtotal = 0.0
    for c in lines:
        unit = _price_for_component(c)
        qty = float(c.quantity or 1)
        line_excl = round(unit * qty * factor, 2)
        items.append({
            'product_id': c.product_id,
            'description': f"{c.product.brand if c.product else ''} {c.product.model if c.product else ''}".strip(),
            'sku': None,
            'quantity': qty,
            'unit': 'ea',
            'unit_price_excl_vat': round(unit * factor, 2),
            'line_total_excl_vat': line_excl,
            'vat_rate': vat_rate,
        })
        subtotal += line_excl
    vat_amount = round(subtotal * (vat_rate / 100.0), 2)
    total_incl = round(subtotal + vat_amount, 2)
    return items, subtotal, vat_amount, total_incl

@invoices_bp.route('/invoices', methods=['GET'])
def list_invoices():
    """List all invoices"""
    try:
        invoices = Invoice.query.order_by(Invoice.created_at.desc()).all()
        
        result = []
        for inv in invoices:
            if hasattr(inv, 'to_dict'):
                result.append(inv.to_dict())
            else:
                # Fallback serialization
                result.append({
                    'id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'number': inv.invoice_number,  # UI compatibility 
                    'status': inv.status,
                    'issue_date': inv.issue_date.isoformat() if inv.issue_date else None,
                    'due_date': inv.due_date.isoformat() if inv.due_date else None,
                    'subtotal_excl_vat': float(inv.subtotal_excl_vat),
                    'vat_amount': float(inv.vat_amount),
                    'total_incl_vat': float(inv.total_incl_vat),
                    'created_at': inv.created_at.isoformat() if hasattr(inv, 'created_at') else None,
                    'version_count': 1,  # UI compatibility
                    'latest_totals': {
                        'total_incl_vat': float(inv.total_incl_vat)
                    }
                })                

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@invoices_bp.route('/projects/<int:project_id>/invoices', methods=['POST'])
def create_invoice(project_id):
    """
    body: {
        "type": "deposit" | "final",
        "quote_number": "Q-2024-0001",
        "quote_version": 1,  # optional
        "percent": 50.0,  # optional, default 100.0
        "due_in_days": 30,  # optional, default 30
        "billing": { "name": "...", "company": "...", "vat_no":"...", "address":"..." }
    }
    """
    data = request.get_json() or {}
    inv_type = (data.get('type') or '').lower()
    quote_number = data.get('quote_number')
    quote_version = data.get('quote_version')
    percent = float(data.get('percent', 50 if inv_type == 'deposit' else 100))
    due_in_days = int(data.get('due_in_days', 7))
    vat_rate = 15.0

    project = Projects.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    if not quote_number:
        return jsonify({"error": "quote_number is required"}), 400
    
    lines = _load_quote_lines(project_id, quote_number, quote_version)
    if not lines:
        return jsonify({"error": "No BOM lines found for the given quote"}), 400
    
    # compute amounts
    if inv_type == 'deposit':
        items, subtotal, vat_amount, total_incl = _compute_items_from_quote(lines, percent=percent, vat_rate=vat_rate)
        percent_of_quote = percent
    elif inv_type == 'final':
        # create final as (100% minus sum(deposit invoices already created)
        items_full, sub_full, vat_full, tot_full = _compute_items_from_quote(lines, percent=100.0, vat_rate=vat_rate)
        deposits = db.session.query(func.coalesce(func.sum(Invoice.subtotal_excl_vat), 0.0))\
                    .filter_by(project_id=project_id, quote_number=quote_number, invoice_type='deposit')\
                    .scalar() or 0.0
        remaining_excl = max(0.0, float(sub_full) - float(deposits))
        # scale items proportionally to remaining %
        remaining_percent = 0.0 if sub_full <= 0 else (remaining_excl / float(sub_full)) * 100.0
        items, subtotal, vat_amount, total_incl = _compute_items_from_quote(lines, percent=remaining_percent, vat_rate=vat_rate)
        percent_of_quote = remaining_percent
    else:
        return jsonify({"error": "Invalid invoice type"}), 400
    
    inv = Invoice(
        project_id=project_id,
        quote_number=quote_number,
        quote_version=quote_version,
        invoice_number=_next_invoice_number(),
        invoice_type=inv_type,
        status='draft',
        issue_date=lambda: datetime.now(SA_TZ).date(),
        due_date=(lambda: datetime.now(SA_TZ) + timedelta(days=due_in_days)).date(),
        percent_of_quote=percent_of_quote,
        billing_name=data.get('billing', {}).get('name') or (project.client_name if hasattr(project, 'client_name') else None),
        billing_company=data.get('billing', {}).get('company') or getattr(project, 'company', None),
        billing_vat_no=data.get('billing', {}).get('vat_no'),
        billing_address=data.get('billing', {}).get('address') or getattr(project, 'location', None),
        vat_rate=vat_rate,
        subtotal_excl_vat=subtotal,
        vat_amount=vat_amount,
        total_incl_vat=total_incl,
    )
    db.session.add(inv)
    db.session.flush()  # to get inv.id

    for it in items:
        db.session.add(InvoiceItem(
            invoice_id=inv.id,
            product_id=it['product_id'],
            description=it['description'] or 'Line Item',
            sku=it['sku'],
            quantity=it['quantity'],
            unit=it['unit'],
            unit_price_excl_vat=it['unit_price_excl_vat'],
            line_total_excl_vat=it['line_total_excl_vat'],
            vat_rate=it['vat_rate'],
            line_vat=round(it['line_total_excl_vat'] * (it['vat_rate']/100.0), 2),
            line_total_incl_vat=round(it['line_total_excl_vat'] * (1 + it['vat_rate']/100.0), 2)
        ))

    db.session.commit()
    return jsonify({"message": "Invoice created", "invoice_id": inv.id, "invoice_number": inv.invoice_number}), 201

@invoices_bp.route('/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice(invoice_id):
    inv = Invoice.query.get(invoice_id)
    if not inv:
        return jsonify({"error":"Invoice not found"}), 404
    
    # Get client information
    client = None
    client_phone = None

    # If invoice has a job card, get client from the job card
    if inv.job_card_id:
        job_card = db.session.query(JobCard).get(inv.job_card_id)
        if job_card and job_card.client_id:
            client = db.session.query(Clients).get(job_card.client_id)
            client_phone = client.phone if client else None

    # If no client found and invoice has project_id, get client from project
    if client is None and inv.project_id:
        project = db.session.query(Projects).get(inv.project_id)
        if project and project.client_id:
            client = db.session.query(Clients).get(project.client_id)
            client_phone = client.phone if client else None

    return jsonify({
        "id": inv.id,
        "project_id": inv.project_id,
        "job_card_id": inv.job_card_id,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type,
        "status": inv.status,
        "issue_date": inv.issue_date.isoformat(),
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "percent_of_quote": inv.percent_of_quote,
        "quote_number": inv.quote_number,
        "quote_version": inv.quote_version,
        "billing": {
            "name": inv.billing_name,
            "company": inv.billing_company,
            "vat_no": inv.billing_vat_no,
            "address": inv.billing_address,
            "phone": client_phone,
        },
        "vat_rate": float(inv.vat_rate),
        "subtotal_excl_vat": float(inv.subtotal_excl_vat),
        "vat_amount": float(inv.vat_amount),
        "total_incl_vat": float(inv.total_incl_vat),
        "amount_paid": float(inv.amount_paid),
        "currency": inv.currency,
        "items": [{
            "id": it.id,
            "description": it.description,
            "sku": it.sku,
            "quantity": float(it.quantity),
            "unit": it.unit,
            "unit_price_excl_vat": float(it.unit_price_excl_vat),
            "line_total_excl_vat": float(it.line_total_excl_vat),
            "vat_rate": float(it.vat_rate),
            "line_vat": float(it.line_vat),
            "line_total_incl_vat": float(it.line_total_incl_vat),
        } for it in inv.items]
    })

@invoices_bp.route('/invoices/<int:invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    inv = Invoice.query.get(invoice_id)
    if not inv:
        return jsonify({"error":"Invoice not found"}), 404
    # if inv.status != 'draft':
    #     return jsonify({"error":"Only draft invoices can be deleted"}), 400
    db.session.delete(inv)
    db.session.commit()
    return jsonify({"message":"Invoice deleted"}), 200

