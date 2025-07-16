# routes/rules.py
from flask import Blueprint, request, jsonify
from models import db, ComponentRule, Product

rules_bp = Blueprint('rules', __name__)

# Endpoint to create a new rule
@rules_bp.route('/rules', methods=['POST'])
def create_rule():
    data = request.get_json()
    if not all(k in data for k in ['subject_product_id', 'rule_type', 'object_category']):
        return jsonify({"error": "Missing required fields"}), 400
    
    new_rule = ComponentRule(
        subject_product_id = data['subject_product_id'],
        rule_type = data['rule_type'],
        object_category = data['object_category'],
        constraints=data.get('constraints'),
        quantity_formula=data.get('quantity_formula'),
        description=data.get('description')
    )
    db.session.add(new_rule)
    db.session.commit()
    return jsonify({"message": "Rule created successfully", "rule_id": new_rule.id}), 201

# --- Endpoint to Get all rules (for the editor) ---
@rules_bp.route('/rules', methods=['GET'])
def get_rules():
    rules = ComponentRule.query.all()
    rules_list = [{
        "id": r.id,
        "subject_product_id": r.subject_product_id,
        "subject_product_name": f"{r.subject_product.brand} {r.subject_product.model}",
        "rule_type": r.rule_type,
        "object_category": r.object_category,
        "constraints": r.constraints,
        "quantity_formula": r.quantity_formula,
        "description": r.description
    } for r in rules]
    return jsonify(rules_list)

# --- Endpoint to Update a rule ---
@rules_bp.route('/rules/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id):
    rule = ComponentRule.query.get_or_404(rule_id)
    data = request.get_json()
    
    for key, value in data.items():
        setattr(rule, key, value)
        
    db.session.commit()
    return jsonify({"message": "Rule updated successfully"})

# --- Endpoint to Delete a rule ---
@rules_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    rule = ComponentRule.query.get_or_404(rule_id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({"message": "Rule deleted successfully"})