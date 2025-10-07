from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from models import db, Projects, BOMComponent, Product
from routes.projects import mark_project_activity

bom_bp = Blueprint('bom', __name__)

def optional_user_id():
    verify_jwt_in_request(optional=True)
    return get_jwt_identity()

@bom_bp.route('/projects/<int:project_id>/bom', methods=['POST'])
def save_project_bom(project_id):
    data = request.get_json()
    
    if not data or 'components' not in data:
        return jsonify({'error': 'Missing components data'}), 400
    
    try:
        # Check if project exists
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
            
        # Delete existing BOM components for this project
        BOMComponent.query.filter_by(project_id=project_id).delete()
        
        # Extract the extras_cost and quote_status
        extras_cost = data.get('extras_cost', 0)
        quote_status = data.get('quote_status', 'draft')
        
        # Add new BOM components
        for component in data['components']:
            new_component = BOMComponent(
                project_id=project_id,
                product_id=component['product_id'],
                quantity=component['quantity'],
                override_margin=component.get('override_margin'),  # User margin override
                unit_cost_at_time=component.get('unit_cost_at_time'),  # Historical cost snapshot
                price_at_time=component.get('price_at_time'),  # Historical price snapshot
                quote_status=quote_status,
                extras_cost=extras_cost  # Store on each component for now
            )
            db.session.add(new_component)
        
        # Update project with template info if applicable
        if 'from_standard_template' in data:
            project.from_standard_template = data['from_standard_template']
            
        if 'template_id' in data and data['template_id']:
            project.template_id = data['template_id']
            
        if 'template_name' in data and data['template_name']:
            project.template_name = data['template_name']
            
        # Mark BOM as modified (user has saved/exported)
        project.bom_modified = True

        mark_project_activity(project_id, optional_user_id())

        db.session.commit()
        return jsonify({'message': 'Bill of Materials saved successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bom_bp.route('/projects/<int:project_id>/bom', methods=['GET'])
def get_project_bom(project_id):
    try:
        components = BOMComponent.query.filter_by(project_id=project_id).all()
        
        result = []
        for comp in components:
            # Get the current price for comparison
            product = Product.query.get(comp.product_id)
            current_price = product.price if product else None
            
            result.append({
                'product_id': comp.product_id,
                'quantity': comp.quantity,
                'override_margin': comp.override_margin,  # Include margin override
                'unit_cost_at_time': comp.unit_cost_at_time,  # Include cost snapshot
                'price_at_time': comp.price_at_time,
                'current_price': current_price,
                'quote_status': comp.quote_status,
                'extras_cost': comp.extras_cost
            })
            
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bom_bp.route('/projects/<int:project_id>/bom/clear', methods=['POST'])
def clear_project_bom(project_id):
    """Clear BOM when switching templates"""
    try:
        # Check if project exists
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
            
        # Delete existing BOM components for this project
        BOMComponent.query.filter_by(project_id=project_id).delete()
        
        # Reset BOM modification flag
        project.bom_modified = False
        
        db.session.commit()
        return jsonify({'message': 'BOM cleared successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bom_bp.route('/projects/<int:project_id>/bom/clear-template-extras', methods=['POST'])
def clear_template_extras_from_bom(project_id):
    """Clear only non-core components from BOM when stopping template usage"""
    try:
        # Check if project exists
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
            
        # Get all BOM components for this project
        components = BOMComponent.query.filter_by(project_id=project_id).all()
        
        # Keep only core components (panels, inverters, batteries)
        core_categories = ['panel', 'inverter', 'battery']
        
        for component in components:
            product = Product.query.get(component.product_id)
            if product and product.category.lower() not in core_categories:
                # Delete non-core components
                db.session.delete(component)
        
        # Clear template information from project
        project.from_standard_template = False
        project.template_id = None
        project.template_name = None
        
        db.session.commit()
        return jsonify({'message': 'Template extras cleared from BOM successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500