from flask import Blueprint, request, jsonify
from models import db, Product

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
def add_product():
    data = clean_numbers(request.get_json())
    p = Product(**data)
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id}), 201

@products_bp.route('/products/<int:pid>', methods=['PUT'])
def update_product(pid):
    p = Product.query.get_or_404(pid)
    data = clean_numbers(request.get_json())
    for k, v in data.items():
        setattr(p, k, v)
    db.session.commit()
    return jsonify({'message': 'updated'})

@products_bp.route('/products/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    p = Product.query.get_or_404(pid)
    db.session.delete(p); db.session.commit()
    return jsonify({'message': 'deleted'})
