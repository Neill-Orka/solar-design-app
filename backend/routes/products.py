from math import e
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Product, User, UserRole
from sqlalchemy.inspection import inspect
from sqlalchemy import Float, Integer, Numeric, or_

products_bp = Blueprint('products', __name__)

###############################################
# Helpers
###############################################

def dynamic_cast_and_clean(payload):
    """Lightweight cleaner: blanks -> None, numeric-looking strings -> float/int.
    Uses a simple allowlist for integer fields; everything else that parses to float becomes float.
    Synonym field names (brand, model, power_w, rating_kva, capacity_kwh) are preserved for later mapping.
    """
    if not payload:
        return {}
    int_fields = {
        'warranty_y','qty','number_of_inputs','number_of_mppt','max_input_current_per_input_a',
        'max_isc_per_mppt_a','max_dc_input_voltage_per_mppt_v','min_operating_voltage_range_v',
        'max_operating_voltage_range_v','rated_input_voltage_v','poles','min_current_rating_a',
        'max_current_rating_a','voltage_rating_v','rated_voltage_v','nominal_current_a','number_of_poles',
        'cores_ac_cable','number_of_phases'
    }
    cleaned = {}
    for k, v in payload.items():
        if k in ('id','updated_at','updated_by','updated_by_id'): # skip read-only
            continue
        if v in (None, '', ' '):
            cleaned[k] = None
            continue
        # Try int first if designated
        if k in int_fields:
            try:
                cleaned[k] = int(v)
                continue
            except (ValueError, TypeError):
                cleaned[k] = None
                continue
        # Fallback float parse
        if isinstance(v, (int,float)):
            cleaned[k] = v
        else:
            try:
                cleaned[k] = float(v)
            except (ValueError, TypeError):
                cleaned[k] = v  # leave as string
    return cleaned

@products_bp.route('/products', methods=['GET'])
def list_products():
    category = request.args.get('category')  # optional filter
    query = Product.query
    if category:
        query = query.filter(Product.category.ilike(category))
    return jsonify([p.as_dict() for p in query.all()])

# @products_bp.route('/products', methods=['GET'])
# def list_products():
#     q = (request.args.get('q') or '').strip()
#     category = (request.args.get('category') or '').strip()
#     try:
#         limit = min(int(request.args.get('limit', 50)), 500)
#     except Exception:
#         limit = 50
#     try:
#         offset = max(int(request.args.get('offset', 0)), 0)
#     except Exception:
#         offset = 0

#     query = Product.query
#     if category:
#         query = query.filter(Product.category.ilike(f'%{category}%'))
#     if q:
#         like = f'%{q}%'
#         query = query.filter(or_(
#             Product.brand_name.ilike(like),
#             Product.description.ilike(like),
#             Product.category.ilike(like),
#             Product.component_type.ilike(like),
#         ))

#     rows = (query
#             .order_by(Product.brand_name.asc(), Product.description.asc())
#             .offset(offset).limit(limit).all())
#     return jsonify([p.as_dict() for p in rows])

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
    data = dynamic_cast_and_clean(raw)
    user_id = get_jwt_identity()
    try:
        # Translate synonyms to real constructor kwargs
        synonym_translation = {
            'brand': 'brand_name',
            'model': 'description',
            'power_w': 'power_rating_w',
            'rating_kva': 'power_rating_kva',
            'capacity_kwh': 'usable_rating_kwh'
        }
        ctor_kwargs = {}
        for k, v in data.items():
            real_key = synonym_translation.get(k, k)
            ctor_kwargs[real_key] = v

        # Margin normalization (percentage to decimal)
        if 'margin' in ctor_kwargs and ctor_kwargs['margin'] is not None and ctor_kwargs['margin'] > 1:
            try:
                ctor_kwargs['margin'] = float(ctor_kwargs['margin']) / 100.0
            except Exception:
                pass

        p = Product(**ctor_kwargs)
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
    # Remove read-only / relationship echoes
    for k in ('id', 'updated_at', 'updated_by'): raw.pop(k, None)
    data = dynamic_cast_and_clean(raw)
    try:
        # Margin normalization (percentage to decimal if >1)
        if 'margin' in data and data['margin'] is not None and data['margin'] > 1:
            try:
                data['margin'] = float(data['margin']) / 100.0
            except Exception:
                pass

        synonyms = {
            'brand': 'brand_name',
            'model': 'description',
            'power_w': 'power_rating_w',
            'rating_kva': 'power_rating_kva',
            'capacity_kwh': 'usable_rating_kwh'
        }

        for k, v in data.items():
            real_key = synonyms.get(k, k) or k
            if isinstance(real_key, str) and real_key not in ('id','updated_at','updated_by_id') and hasattr(Product, real_key):
                try:
                    setattr(p, real_key, v)
                except Exception:
                    pass

        # Auto-calc price if unit_cost or margin changed and price not explicitly provided
        if ('unit_cost' in data or 'margin' in data) and 'price' not in data:
            try:
                if p.unit_cost is not None and p.margin is not None:
                    p.price = round(float(p.unit_cost) * (1 + float(p.margin)), 2)
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
                "price": {"label": "Price (R)", "type": "number", "readonly": True},
                "margin": {"label": "Margin (%)", "type": "number"},
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
            # For metadata we keep dynamic behavior; fall back gracefully if inspect fails
            product_columns = db.inspect(Product).columns
            for field_name in product_columns.keys():
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
            product_columns = db.inspect(Product).columns
            for field_name in sorted(relevant_fields.keys()):
                column = product_columns.get(field_name)
                if column is None:
                    continue
                column_type = str(column.type)
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
