# routes/projects.py
from flask import Blueprint, request, jsonify
from models import db, Projects, Clients, LoadProfiles, QuickDesignData

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/projects', methods=['GET'])
def get_projects():
    try:
        projects = Projects.query.all()
        return jsonify([
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'client_name': p.client.client_name,
                'location': p.location,
                'system_type': p.system_type,
                'panel_kw': p.panel_kw,
                'inverter_kva': p.inverter_kva,
                'battery_kwh': p.battery_kwh,
                'project_value_excl_vat': p.project_value_excl_vat,
                'site_contact_person': p.site_contact_person,
                'site_phone': p.site_phone
            }
            for p in projects
        ])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project_by_id(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        return jsonify({
            'id': project.id,
            'name': project.name,
            'client_name': project.client.client_name,
            'location': project.location,
            'system_type': project.system_type,
            'panel_kw': project.panel_kw,
            'inverter_kva': project.inverter_kva,
            'battery_kwh': project.battery_kwh,
            'project_value_excl_vat': project.project_value_excl_vat,
            'site_contact_person': project.site_contact_person,
            'site_phone': project.site_phone,
            'design_type': project.design_type
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects', methods=['POST'])
def add_project():
    try:
        data = request.json
        if data is None:
            return jsonify({'error': 'No JSON data provided'}), 400
        new_project = Projects(
            client_id=data['client_id'],
            name=data['name'],
            description=data.get('description'),
            system_type=data.get('system_type'),
            panel_kw=data.get('panel_kw'),
            inverter_kva=data.get('inverter_kva'),
            battery_kwh=data.get('battery_kwh'),
            location=data.get('location'),
            project_value_excl_vat=data.get('project_value_excl_vat'),
            site_contact_person=data.get('site_contact_person'),
            site_phone=data.get('site_phone'),
            design_type=data.get('design_type', 'Quick'),
            project_type=data.get('project_type', 'Residential'),
        )
        db.session.add(new_project)
        db.session.commit()
        return jsonify({'message': 'Project added successfully!'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        data = request.json

        # Handle new quantity format
        for key in ['inverter_kva', 'battery_kwh']:
            if key in data:
                if isinstance(data[key], dict):
                    # new format with capacity and quantity
                    setattr(project, key, data[key])
                elif data[key] is not None:
                    # Backward compatibility
                    if key == 'inverter_kva':
                        setattr(project, key, {'capacity': data[key], 'quantity': 1})
                    else:
                        setattr(project, key, {'capacity': data[key], 'quantity': 1})
                else:
                    setattr(project, key, None)
                
        # Handle other fields
        for key, value in data.items():
            if key not in ['inverter_kva', 'battery_kwh']:
                setattr(project, key, value)

        db.session.commit()
        return jsonify({'message': 'Project updated successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        db.session.delete(project)
        db.session.commit()
        return jsonify({'message': 'Project deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/load_profiles', methods=['GET'])
def get_load_profiles():
    try:
        consumer_type_filter = request.args.get('consumer_type') # Optional filter
        
        query = LoadProfiles.query
        if consumer_type_filter:
            query = query.filter(LoadProfiles.profile_type == consumer_type_filter)
        
        profiles = query.all()
        
        profiles_list = []
        for profile in profiles:
            profiles_list.append({
                'id': profile.id,
                'name': profile.name,
                'description': profile.description,
                'profile_type': profile.profile_type, # Changed from consumer_type to match your model
                'annual_kwh': profile.annual_kwh,
                'profile_data': profile.profile_data # This is the array of data points
            })
        return jsonify(profiles_list), 200
    except Exception as e:
        print(f"Error fetching load profiles: {str(e)}") # Log error
        return jsonify({'error': 'Failed to fetch load profiles', 'details': str(e)}), 500
    
@projects_bp.route('/projects/<int:project_id>/quick_design', methods=['POST', 'PUT'])
def save_or_update_quick_design(project_id):
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        quick_data_entry = QuickDesignData.query.filter_by(project_id=project_id).first()

        if not quick_data_entry:
            if request.method == 'PUT':
                 return jsonify({'error': 'Quick design data not found for this project to update.'}), 404
            quick_data_entry = QuickDesignData()
            quick_data_entry.project_id = project_id
            db.session.add(quick_data_entry)
        
        # Update fields from BasicInfoForm
        if 'consumption' in data: quick_data_entry.consumption = data.get('consumption')
        if 'tariff' in data: quick_data_entry.tariff = data.get('tariff')
        if 'consumerType' in data: quick_data_entry.consumer_type = data.get('consumerType') # Matches frontend
        if 'transformerSize' in data: quick_data_entry.transformer_size = data.get('transformerSize') # Matches frontend
        
        # Update field from ProfileSelection
        if 'selectedProfileId' in data:
            quick_data_entry.selected_profile_id = data.get('selectedProfileId')
        
        # Update field from SystemSelection (example)
        if 'selectedSystem' in data: # Assuming selectedSystem is an object with system details
            quick_data_entry.selected_system_config_json = data.get('selectedSystem')

        db.session.commit()
        return jsonify({
            'message': 'Quick design data saved/updated successfully', 
            'id': quick_data_entry.id
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error in save_or_update_quick_design: {str(e)}") # Log error
        return jsonify({'error': 'Failed to save/update quick design data', 'details': str(e)}), 500