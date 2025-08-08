# Gets kits from database and sents it to the frontend
from flask import Blueprint, jsonify
from models import SystemTemplate, SystemTemplateComponent, Product

system_templates_bp = Blueprint('system_templates', __name__)

@system_templates_bp.route('/system_templates', methods=['GET'])
def get_system_templates():
    templates = SystemTemplate.query.all()
    results = []

    for template in templates:
        # Calculate totals for each template on the backend
        total_cost = template.extras_cost or 0
        panel_kw = 0
        inverter_kva = 0
        battery_kwh = 0
        components_list = []

        for comp in template.components:
            if comp.product:
                cat = (comp.product.category or '').lower()
                total_cost += (comp.product.price or 0) * comp.quantity
                if cat == 'panel':
                    panel_kw += (comp.product.power_w or 0) * comp.quantity / 1000
                elif cat == 'inverter':
                    inverter_kva += (comp.product.rating_kva or 0) * comp.quantity # MOET INVERTERS BY MEKAAR GETEL WORD? 
                elif cat == 'battery':
                    battery_kwh += (comp.product.capacity_kwh or 0) * comp.quantity

                components_list.append({
                    'product_id': comp.product.id,
                    'brand': comp.product.brand,
                    'model': comp.product.model,
                    'quantity': comp.quantity,
                    'category': comp.product.category
                })

        results.append({
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'system_type': template.system_type,
            'extras_cost': template.extras_cost or 0,  # Add this line to explicitly include extras_cost
            'total_cost': total_cost,
            'panel_kw': round(panel_kw, 2),
            'inverter_kva': round(inverter_kva, 2),
            'battery_kwh': round(battery_kwh, 2),
            'components': components_list # Send the detailed components list
        })

    return jsonify(results), 200

@system_templates_bp.route('/system_templates/<int:template_id>', methods=['GET'])
def get_system_template_details(template_id):
    try:
        # Get the template
        template = SystemTemplate.query.get_or_404(template_id)
        
        # Get all components for the template
        components = SystemTemplateComponent.query.filter_by(template_id=template_id).all()
        
        # Calculate system specs for the template
        panel_kw = 0
        inverter_kva = 0
        battery_kwh = 0
        
        # Create the response data structure
        response = {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'system_type': template.system_type,
            'extras_cost': template.extras_cost,
            'components': []
        }
        
        # Add component details
        for comp in components:
            # Get the product info
            product = Product.query.get(comp.product_id)
            if product:
                # Calculate system specs
                if product.category == 'panel':
                    panel_kw += (product.power_w or 0) * comp.quantity / 1000
                elif product.category == 'inverter':
                    inverter_kva += (product.rating_kva or 0) * comp.quantity
                elif product.category == 'battery':
                    battery_kwh += (product.capacity_kwh or 0) * comp.quantity
                
                # Add to component list
                response['components'].append({
                    'product_id': comp.product_id,
                    'quantity': comp.quantity,
                    'category': product.category,
                    'brand': product.brand,
                    'model': product.model
                })
        
        # Add calculated specs
        response['panel_kw'] = round(panel_kw, 2)
        response['inverter_kva'] = round(inverter_kva, 2)
        response['battery_kwh'] = round(battery_kwh, 2)
        response['total_cost'] = round(calculate_template_cost(template_id), 2)
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper function to calculate template cost
def calculate_template_cost(template_id):
    try:
        total_cost = 0
        components = SystemTemplateComponent.query.filter_by(template_id=template_id).all()
        
        for comp in components:
            product = Product.query.get(comp.product_id)
            if product and product.price:
                total_cost += product.price * comp.quantity
        
        # Add the extras cost
        template = SystemTemplate.query.get(template_id)
        if template and template.extras_cost:
            total_cost += template.extras_cost
            
        return total_cost
    except Exception:
        return 0