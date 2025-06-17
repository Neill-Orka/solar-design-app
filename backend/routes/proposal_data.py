from flask import Blueprint, jsonify
from models import db, Projects, QuickDesignData, LoadProfiles
from services.simulation_engine import run_quick_simulation
from services.financial_calcs import run_quick_financials

proposal_data_bp = Blueprint('proposal_data', __name__)

@proposal_data_bp.route('/proposal_data/<int:project_id>', methods=['GET'])
def get_proposal_data(project_id):
    print(f"--- PROPOSAL DATA: Fetching all data for project {project_id} ---")
    try:
        # 1. Fetch the main project and its quick design entry
        project = Projects.query.get_or_404(project_id)
        quick_design = project.quick_design_entry
        if not quick_design:
            return jsonify({"error": "No Quick Design data found for this project."}), 404

        # 2. Get the selected load profile data
        profile = LoadProfiles.query.get(quick_design.selected_profile_id)
        if not profile:
            return jsonify({"error": "Selected load profile not found."}), 404
        
        # 3. Get system config and scale the profile data
        system_config = quick_design.selected_system_config_json
        scaler = quick_design.profile_scaler or 1 # Assume you've saved the scaler
        
        scaled_profile_data = [{
            'timestamp': dp.get('Timestamp') or dp.get('timestamp'),
            'demand_kw': (dp.get('Demand_kW') or dp.get('demand_kw', 0)) * scaler
        } for dp in profile.profile_data]
        
        # 4. Run the simulation
        sim_params = {
            "scaled_load_profile": scaled_profile_data,
            "panel_kw": system_config.get('panel_kw', 0),
            "inverter_kva": system_config.get('inverter_kva', 0),
            "battery_kwh": system_config.get('battery_kwh', 0),
            "system_type": system_config.get('system_type', 'Hybrid')
        }
        sim_response = run_quick_simulation(**sim_params)
        if 'error' in sim_response: return jsonify(sim_response), 500

        # 5. Run financial calculations
        financial_params = {
            "sim_response": sim_response,
            "system_cost": system_config.get('total_cost', 0),
            "tariff": quick_design.tariff
        }
        financial_results = run_quick_financials(**financial_params)
        if 'error' in financial_results: return jsonify(financial_results), 500

        # 6. Assemble the final payload
        final_data = {
            "client_name": project.client.client_name,
            "project_name": project.name,
            "location": project.location,
            "basic_info": {
                "consumption": quick_design.consumption,
                "tariff": quick_design.tariff
            },
            "selected_system": system_config,
            "simulation": sim_response,
            "financials": financial_results
        }

        return jsonify(final_data), 200

    except Exception as e:
        print(f"--- ERROR in get_proposal_data: {e}")
        return jsonify({"error": "An unexpected server error occurred."}), 500