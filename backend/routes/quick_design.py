from flask import Blueprint, request, jsonify
from models import db, Projects, LoadProfiles, QuickDesignData

try:
    from services.simulation_engine import run_quick_simulation
    from services.financial_calcs import run_quick_financials
    print("--- DEBUG: Successfully imported simulation and financial services. ---")
except ImportError as e:
    print(f"--- FATAL ERROR: Could not import services: {e} ---")
    def run_quick_simulation(*args, **kwargs): return {"error": f"Simulation engine failed to load: {e}"}
    def run_quick_financials(*args, **kwargs): return {"error": f"Financial calculator failed to load: {e}"}

quick_design_bp = Blueprint('quick_design', __name__)

@quick_design_bp.route('/quick_simulate', methods=['POST', 'OPTIONS'])
def handle_quick_simulation():
    if request.method == 'OPTIONS':
        response = jsonify(success=True)
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    if request.method == 'POST':
        try:
            data = request.get_json()

            project_id = data.get('projectId')
            project = Projects.query.get(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404

            basic_info, selected_system, selected_profile = data.get('basicInfo'), data.get('selectedSystem'), data.get('selectedProfile')

            if not all([basic_info, selected_system, selected_profile]): return jsonify({"error": "Missing required fields"}), 400
            
            profile_data = selected_profile.get('profile_data')
            scaler = selected_profile.get('scaler', 1)

            if not profile_data: return jsonify({"error": "Load profile data is missing"}), 400
            
            scaled_profile_data = [{'timestamp': dp.get('Timestamp') or dp.get('timestamp'), 'demand_kw': (dp.get('Demand_kW') or dp.get('demand_kw', 0)) * scaler} for dp in profile_data]
            
            # The 'allow_export' parameter has been removed from the call
            sim_params = {"scaled_load_profile": scaled_profile_data, "panel_kw": selected_system.get('panel_kw', 0), "inverter_kva": selected_system.get('inverter_kva', 0), "battery_kwh": selected_system.get('battery_kwh', 0), "system_type": selected_system.get('system_type', 'Hybrid')}
            sim_response = run_quick_simulation(**sim_params)
            
            if 'error' in sim_response: return jsonify(sim_response), 500
                
            # The 'export_enabled' parameter has been removed from the call
            financial_params = {"sim_response": sim_response, "system_cost": selected_system.get('total_cost', 0), "project": project}
            financial_results = run_quick_financials(**financial_params)
            
            if 'error' in financial_results: return jsonify(financial_results), 500
            
            final_response = {
                "client_name": project.client.client_name,
                "project_name": project.name,
                "location": project.location,
                "selected_system": selected_system,
                "simulation": sim_response,
                "financials": financial_results
            }

            quick_data_entry = QuickDesignData.query.filter_by(project_id=project_id).first()
            if not quick_data_entry:
                quick_data_entry = QuickDesignData(project_id=project_id)
                db.session.add(quick_data_entry)

            return jsonify(final_response), 200

        
        except Exception as e:
            print(f"--- FATAL ERROR inside handle_quick_simulation: {e}")
            return jsonify({"error": "An unexpected server error occurred."}), 500

    return jsonify({"error": "Method Not Allowed"}), 405

