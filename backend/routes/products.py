from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, User, UserRole

products_bp = Blueprint('products', __name__)

# ---------- helper --------------------------------------------------------
def clean_numbers(payload):
    """Convert empty strings to None and cast numerics."""
    float_fields = ["power_w", "rating_kva", "capacity_kwh", "cost", "price"]
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
    data = clean_numbers(request.get_json())
    user_id = get_jwt_identity()
    p = Product(**data, updated_by_id=user_id)
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id}), 201

@products_bp.route('/products/<int:pid>', methods=['PUT'])
@jwt_required()
def update_product(pid):
    p = Product.query.get_or_404(pid)
    data = clean_numbers(request.get_json())
    for k, v in data.items():
        setattr(p, k, v)
    # set audit fields
    user_id = get_jwt_identity()
    p.updated_by_id = user_id
    db.session.commit()
    return jsonify({'message': 'updated'})

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
