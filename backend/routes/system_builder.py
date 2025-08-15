# routes/system_builder.py
from flask import Blueprint, request, jsonify
from models import db, SystemTemplate, SystemTemplateComponent, Product

system_builder_bp = Blueprint('system_builder', __name__)

@system_builder_bp.route('/system_templates', methods=['GET'])
def get_system_templates():
    """Get all system templates with their components and calculated values"""
    try:
        templates = SystemTemplate.query.all()
        result = []
        
        for template in templates:
            # Get all components for this template
            components = []
            total_cost = 0
            panel_kw = 0
            
            for comp in template.components:
                product = Product.query.get(comp.product_id)
                if product:
                    component_data = {
                        'product_id': comp.product_id,
                        'quantity': comp.quantity,
                        'product': {
                            'id': product.id,
                            'brand': product.brand_name,
                            'model': product.description,
                            'category': product.category,
                            'power_w': product.power_rating_w,
                            'rating_kva': product.power_rating_kva,
                            'capacity_kwh': product.usable_rating_kwh,
                            'price': product.price
                        }
                    }
                    components.append(component_data)
                    
                    # Calculate total cost
                    if product.price:
                        total_cost += product.price * comp.quantity
                    
                    # Calculate panel_kw for panels
                    if product.category == 'panel' and product.power_rating_w:
                        panel_kw += (product.power_rating_w * comp.quantity) / 1000
            
            template_data = {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'system_type': template.system_type,
                'extras_cost': template.extras_cost or 0,
                'components': components,
                'total_cost': total_cost,
                'panel_kw': panel_kw
            }
            result.append(template_data)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@system_builder_bp.route('/system_templates/<int:template_id>', methods=['GET'])
def get_system_template(template_id):
    """Get a specific system template with its components and calculated values"""
    try:
        template = SystemTemplate.query.get_or_404(template_id)
        
        # Get all components for this template
        components = []
        total_cost = 0
        panel_kw = 0
        
        for comp in template.components:
            product = Product.query.get(comp.product_id)
            if product:
                component_data = {
                    'product_id': comp.product_id,
                    'quantity': comp.quantity,
                    'product': {
                        'id': product.id,
                        'brand': product.brand_name,
                        'model': product.description,
                        'category': product.category,
                        'power_w': product.power_rating_w,
                        'rating_kva': product.power_rating_kva,
                        'capacity_kwh': product.usable_rating_kwh,
                        'price': product.price
                    }
                }
                components.append(component_data)
                
                # Calculate total cost
                if product.price:
                    total_cost += product.price * comp.quantity
                
                # Calculate panel_kw for panels
                if product.category == 'panel' and product.power_rating_w:
                    panel_kw += (product.power_rating_w * comp.quantity) / 1000
        
        template_data = {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'system_type': template.system_type,
            'extras_cost': template.extras_cost or 0,
            'components': components,
            'total_cost': total_cost,
            'panel_kw': panel_kw
        }
        
        return jsonify(template_data), 200
    
    except Exception as e:
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@system_builder_bp.route('/system_templates', methods=['POST'])
def create_system_template():
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
    
    # To update the system template
@system_builder_bp.route('/system_templates/<int:template_id>', methods=['PUT'])
def update_system_template(template_id):
    template = SystemTemplate.query.get_or_404(template_id)
    data = request.get_json()

    if not data or not data.get('name') or not data.get('components'):
        return jsonify({"error": "Missing required fields: name and components"}), 400
    
    try: 
        # update scalar fields
        template.name = data.get('name')
        template.description = data.get('description')
        template.system_type = data.get('system_type')
        template.extras_cost = data.get('extras_cost', 0)

        # Delete old components
        SystemTemplateComponent.query.filter_by(template_id=template.id).delete()

        # Add new components
        for comp_data in data.get('components', []):
            product = Product.query.get(comp_data.get('product_id'))
            if not product:
                db.session.rollback()
                return jsonify({"error": f"Product with ID {comp_data.get('product_id')} not found."}), 404
               
            new_component = SystemTemplateComponent(
                template_id=template.id,
                product_id=comp_data.get('product_id'),
                quantity=comp_data.get('quantity')
            )
            db.session.add(new_component)

        db.session.commit()
        return jsonify({
            "success": True, 
            "message": "System template updated successfully", 
            "template_id": template.id
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500
    
# New route to delete a template
@system_builder_bp.route('/system_templates/<int:template_id>', methods=['DELETE'])
def delete_system_template(template_id):
    template = SystemTemplate.query.get_or_404(template_id)
    if not template:
        return jsonify({"error": "System template not found"}), 404

    try:
        # Delete the template itself
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({"success": True, "message": "System template deleted successfully"}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

