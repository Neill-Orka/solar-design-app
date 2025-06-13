# routes/system_builder.py
from flask import Blueprint, request, jsonify
from models import db, SystemTemplate, SystemTemplateComponent, Product

system_builder_bp = Blueprint('system_builder', __name__)

@system_builder_bp.route('/system_templates', methods=['POST'])
def create_system_template():
    """
    Creates a new SystemTemplate and its associated components.
    Expects a JSON payload with template details and a list of components.
    """
    data = request.get_json()

    # Basic validation
    if not data or not data.get('name') or not data.get('components'):
        return jsonify({"error": "Missing required fields: name and components"}), 400

    # Start a database transaction
    try:
        # Create the main template object
        new_template = SystemTemplate(
            name=data.get('name'),
            description=data.get('description'),
            system_type=data.get('system_type'),
            extras_cost=data.get('extras_cost', 0)
        )
        db.session.add(new_template)
        # We need to flush to get the ID for the new_template
        db.session.flush()

        # Create the associated component links
        for comp_data in data.get('components', []):
            # Ensure the product exists before trying to add it
            product = Product.query.get(comp_data.get('product_id'))
            if not product:
                # If any product is invalid, roll back the transaction
                db.session.rollback()
                return jsonify({"error": f"Product with ID {comp_data.get('product_id')} not found."}), 404
            
            new_component = SystemTemplateComponent(
                template_id=new_template.id,
                product_id=comp_data.get('product_id'),
                quantity=comp_data.get('quantity')
            )
            db.session.add(new_component)
        
        # If all components are added successfully, commit the transaction
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "System template created successfully", 
            "template_id": new_template.id
        }), 201

    except Exception as e:
        # If any other error occurs, roll back
        db.session.rollback()
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

