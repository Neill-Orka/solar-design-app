# routes/consumption.py
from flask import Blueprint, jsonify, request
from models import Projects, EnergyData

consumption_bp = Blueprint('consumption', __name__)

@consumption_bp.route('/consumption_data/<int:project_id>', methods=['GET'])
def get_consumption_data(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": f"Project with id {project_id} does not exist"}), 404

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = EnergyData.query.filter_by(project_id=project_id)
        if start_date:
            query = query.filter(EnergyData.timestamp >= start_date)
        if end_date:
            query = query.filter(EnergyData.timestamp <= end_date)

        data = query.order_by(EnergyData.timestamp).all()
        return jsonify([
            {
                'timestamp': record.timestamp.isoformat(),
                'demand_kw': record.demand_kw
            }
            for record in data
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
