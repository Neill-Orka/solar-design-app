from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, User, UserRole
from sqlalchemy.inspection import inspect

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

@products_bp.route('/products/categories', methods=['GET'])
def get_product_categories():
    """Return all distinct product categories sorted alphabetically"""
    categories = db.session.query(Product.category).filter(Product.category != None).distinct().all()
    category_list = sorted([cat[0] for cat in categories if cat[0]], key=lambda x: x.lower())
    return jsonify(category_list)

@products_bp.route('/products/component-types', methods=['GET'])
def get_component_types():
    """Return all distinct component types sorted alphabetically"""
    types = db.session.query(Product.component_type).filter(Product.component_type != None).distinct().all()
    type_list = sorted([t[0] for t in types if t[0]], key=lambda x: str(x).lower())
    return jsonify(type_list)

@products_bp.route('/products/field-metadata', methods=['GET'])
def get_field_metadata():
    """Dynamically determine relevant fields for each category based on non-NULL values"""
    # Get all categories from the database
    categories = db.session.query(Product.category).filter(Product.category != None).distinct().all()
    category_list = [cat[0] for cat in categories if cat[0]]
    
    # Create a structure to store our results
    result = {
        "general": {
            "title": "General Information",
            "fields": {
                "category": {"label": "Category", "type": "select", "source": "categories"},
                "component_type": {"label": "Component Type", "type": "select", "source": "component-types"},
                "brand_name": {"label": "Brand", "type": "text"},
                "description": {"label": "Model / SKU", "type": "text"},
                "unit_cost": {"label": "Unit Cost (R)", "type": "number"},
                "margin": {"label": "Margin (%)", "type": "number"},
                "price": {"label": "Price (R)", "type": "number", "readonly": True},
                "warranty_y": {"label": "Warranty (y)", "type": "number"},
                "notes": {"label": "Notes", "type": "textarea"}
            }
        }
    }
    
    # Skip fields that shouldn't be shown to users
    skip_fields = ['id', 'updated_at', 'updated_by_id', 'properties', 'qty', 'updated']
    
    # Fields already included in general section
    general_fields = list(result["general"]["fields"].keys())
    
    # Dynamically determine relevant fields for each category
    for category in category_list:
        # Get all products for this category
        products = Product.query.filter(Product.category == category).all()
        
        # Skip if no products found
        if not products:
            continue
            
        # Dictionary to count non-NULL values for each field
        field_usage = {}
        
        # Track which fields have non-NULL values
        for product in products:
            # Get all column attributes
            for column in inspect(Product).mapper.column_attrs:
                field_name = column.key
                if field_name in skip_fields or field_name in general_fields:
                    continue
                
                # Check if this field has a non-NULL value
                value = getattr(product, field_name)
                if value is not None:
                    field_usage[field_name] = field_usage.get(field_name, 0) + 1
        
        # Include fields used in at least 10% of products
        threshold = max(1, len(products) * 0.1)
        relevant_fields = {field: count for field, count in field_usage.items() 
                          if count >= threshold}
        
        # If we found relevant fields, create a category section
        if relevant_fields:
            # Create a snake_case key for the category
            category_key = category.lower().replace(' ', '_')
            
            result[category_key] = {
                "title": f"{category} Specifications",
                "applies_to": [category],
                "fields": {}
            }
            
            # Add field metadata for each relevant field
            for field_name in sorted(relevant_fields.keys()):
                column = next((c for c in inspect(Product).mapper.column_attrs 
                              if c.key == field_name), None)
                if not column:
                    continue
                
                # Determine field type based on column type
                column_type = str(column.expression.type)
                field_type = "text"  # Default
                
                if "INT" in column_type or "FLOAT" in column_type or "DECIMAL" in column_type:
                    field_type = "number"
                elif "BOOLEAN" in column_type:
                    field_type = "checkbox"
                elif "TEXT" in column_type:
                    field_type = "textarea"
                
                # Generate a human-readable label
                label = field_name.replace('_', ' ').title()
                
                # Handle units in labels
                if "_w" in field_name.lower():
                    label += " (W)"
                elif "_kw" in field_name.lower():
                    label += " (kW)"
                elif "_kva" in field_name.lower():
                    label += " (kVA)"
                elif "_kwh" in field_name.lower():
                    label += " (kWh)"
                elif "_v" in field_name.lower():
                    label += " (V)"
                elif "_a" in field_name.lower() and not "_rating" in field_name.lower():
                    label += " (A)"
                elif "_mm" in field_name.lower():
                    label += " (mm)"
                
                # Add field to category
                result[category_key]["fields"][field_name] = {
                    "label": label,
                    "type": field_type
                }
                
                # Handle known alias mappings for backward compatibility
                if field_name == "power_rating_w":
                    result[category_key]["fields"][field_name]["alias"] = "power_w"
                elif field_name == "power_rating_kva":
                    result[category_key]["fields"][field_name]["alias"] = "rating_kva"
                elif field_name == "usable_rating_kwh":
                    result[category_key]["fields"][field_name]["alias"] = "capacity_kwh"
    
    return jsonify(result)
