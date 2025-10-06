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
        scale_factor = float(request.args.get('scale_factor', 1.0))

        query = EnergyData.query.filter_by(project_id=project_id)
        if start_date:
            query = query.filter(EnergyData.timestamp >= start_date)
        if end_date:
            query = query.filter(EnergyData.timestamp <= end_date)

        data = query.order_by(EnergyData.timestamp).all()

        # Get profile information if it exists
        from models import LoadProfiles
        profile_info = None

        if hasattr(project, 'profile_id') and project.profile_id:
            profile = LoadProfiles.query.get(project.profile_id)
            if profile:
                profile_info = {
                    "name": profile.name,
                    "annual_kwh": profile.annual_kwh,
                    "monthly_avg_kwh_original": profile.monthly_avg_kwh_original,
                    "max_peak_demand_kw": profile.max_peak_demand_kw,
                    "profile_type": profile.profile_type,
                    "scaler": project.profile_scaler if hasattr(project, 'profile_scaler') else 1.0
                }

        # Format response with both data and profile info
        data_points = [
            {
                'timestamp': record.timestamp.isoformat(),
                'demand_kw': record.demand_kw * scale_factor
            }
            for record in data
        ]
        return jsonify([
            {
                'timestamp': record.timestamp.isoformat(),
                'demand_kw': record.demand_kw * scale_factor
            }
            for record in data
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
