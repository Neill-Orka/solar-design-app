from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, User, UserRole

products_bp = Blueprint('products', __name__)

# ---------- helper --------------------------------------------------------
def clean_numbers(payload):
    """Convert empty strings to None and cast numerics."""
    # Align with API field names actually used by frontend
    float_fields = [
        "power_w", "rating_kva", "capacity_kwh",  # synonyms
        "unit_cost", "margin", "price"
    ]
    int_fields   = ["warranty_y"]
    for f in float_fields:
        v = payload.get(f)
        payload[f] = float(v) if v not in (None, "", " ") else None
    for f in int_fields:
        v = payload.get(f)
        payload[f] = int(v) if v not in (None, "", " ") else None
    return payload

@products_bp.route('/products', methods=['GET'])
def list_products():
    category = request.args.get('category')  # optional filter
    query = Product.query
    if category:
        query = query.filter(Product.category.ilike(category))
    return jsonify([p.as_dict() for p in query.all()])

@products_bp.route('/products/<int:pid>', methods=['GET'])
def get_product(pid):
    p = Product.query.get_or_404(pid)
    return jsonify(p.as_dict())

@products_bp.route('/products', methods=['POST'])
@jwt_required()
def add_product():
    raw = request.get_json() or {}
    # Remove read-only / relationship fields possibly echoed from frontend
    for k in ('id', 'updated_at', 'updated_by'): raw.pop(k, None)
    data = clean_numbers(raw)
    user_id = get_jwt_identity()
    try:
        p = Product(**data)
        p.updated_by_id = user_id
        db.session.add(p)
        db.session.commit()
        return jsonify({'id': p.id, 'product': p.as_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'create_failed', 'details': str(e)}), 400

@products_bp.route('/products/<int:pid>', methods=['PUT'])
@jwt_required()
def update_product(pid):
    p = Product.query.get_or_404(pid)
    raw = request.get_json() or {}
    # Strip read-only / relationship fields that may be sent back from UI
    for k in ('id', 'updated_at', 'updated_by'): raw.pop(k, None)
    data = clean_numbers(raw)
    try:
        # Normalize margin: if sent as percentage string (e.g. '25') convert to decimal
        if 'margin' in data and data['margin'] is not None and data['margin'] > 1:
            # assume user passed 25 meaning 25%
            data['margin'] = float(data['margin']) / 100.0

        # Determine allowed attribute names (column keys + synonyms we expose)
        # Static allowlist (subset) – expand as needed
        allowed = {
            'category','component_type','brand','model','notes','supplier','updated','unit_cost','qty','margin','price','warranty_y',
            'power_w','rating_kva','capacity_kwh'
        }

        # Apply incoming fields selectively (skip unknown / protected)
        for k, v in data.items():
            if k in allowed:
                setattr(p, k, v)

        # If unit_cost or margin provided but price omitted, auto-calc price for consistency
        if ('unit_cost' in data or 'margin' in data) and 'price' not in data:
            try:
                if p.unit_cost is not None and p.margin is not None:
                    p.price = round(p.unit_cost * (1 + p.margin), 2)
            except Exception:
                pass

        # Audit fields
        user_id = get_jwt_identity()
        p.updated_by_id = user_id
        db.session.commit()
        return jsonify({'message': 'updated', 'product': p.as_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'update_failed', 'details': str(e)}), 400

@products_bp.route('/products/<int:pid>', methods=['DELETE'])
@jwt_required()
def delete_product(pid):
    # Admin-only enforcement
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({
            'error': 'forbidden',
            'message': 'Access Restricted: Only administrators can delete products.'
        }), 403
    p = Product.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'deleted'})
