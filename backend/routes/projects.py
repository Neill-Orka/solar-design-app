# routes/projects.py
from flask import Blueprint, request, jsonify
from models import db, Projects, Clients, LoadProfiles, QuickDesignData
from .tariffs import serialize_tariff

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
                'latitude': p.latitude,
                'longitude': p.longitude,
                'system_type': p.system_type,
                'panel_kw': p.panel_kw,
                'inverter_kva': p.inverter_kva,
                'battery_kwh': p.battery_kwh,
                'project_value_excl_vat': p.project_value_excl_vat,
                'site_contact_person': p.site_contact_person,
                'site_phone': p.site_phone,
                'design_type': p.design_type,
                'project_type': p.project_type,
                'tariff_id': p.tariff_id,
                'custom_flat_rate': p.custom_flat_rate,
                'tariff_details': serialize_tariff(p.tariff) if p.tariff else None,
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

        # Fetch and serialize quick design data if it exists.
        quick_design_data = None
        if project.quick_design_entry:
            qdd = project.quick_design_entry
            quick_design_data = {
                'id': qdd.id,
                'consumption': qdd.consumption,
                'tariff': qdd.tariff,
                'consumer_type': qdd.consumer_type,
                'transformer_size': qdd.transformer_size,
                'selected_profile_id': qdd.selected_profile_id,
                'profile_scaler': qdd.profile_scaler,
                'selected_system_config_json': qdd.selected_system_config_json
            }

        return jsonify({
            'id': project.id,
            'name': project.name,
            'client_name': project.client.client_name,
            'location': project.location,
            'latitude': project.latitude,
            'longitude': project.longitude,
            'system_type': project.system_type,
            'panel_kw': project.panel_kw,
            'inverter_kva': project.inverter_kva,
            'battery_kwh': project.battery_kwh,
            'project_value_excl_vat': project.project_value_excl_vat,
            'site_contact_person': project.site_contact_person,
            'site_phone': project.site_phone,
            'design_type': project.design_type,
            'project_type': project.project_type,
            'quick_design_data': quick_design_data,
            'tariff_id': project.tariff_id,
            'custom_flat_rate': project.custom_flat_rate,
            'tariff_details': serialize_tariff(project.tariff) if project.tariff else None,
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
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            project_value_excl_vat=data.get('project_value_excl_vat'),
            site_contact_person=data.get('site_contact_person'),
            site_phone=data.get('site_phone'),
            design_type=data.get('design_type', 'Quick'),
            project_type=data.get('project_type', 'Residential'),
            tariff_id=data.get('tariff_id'),
            custom_flat_rate=data.get('custom_flat_rate')
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

        tariff_id = data.get('tariff_id')
        custom_flat_rate = data.get('custom_flat_rate')

        # Handle tariff fields with the clearing logic
        if 'tariff_id' in data and data['tariff_id'] is not None:
            project.tariff_id = data['tariff_id']
            project.custom_flat_rate = None # Clear the other type
        elif 'custom_flat_rate' in data and data['custom_flat_rate'] is not None:
            project.custom_flat_rate = data['custom_flat_rate']
            project.tariff_id = None # Clear the other type
            

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
        
        if 'profileScaler' in data:
            quick_data_entry.profile_scaler = data.get('profileScaler', 1.0)

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
    
@projects_bp.route('/projects/<int:project_id>/quick_design', methods=['GET'])
def get_quick_design_data(project_id):
    try:
        quick_data = QuickDesignData.query.filter_by(project_id=project_id).first()
        if not quick_data:
            return jsonify(None), 200 # Return null if no data exists yet, which is not an error

        return jsonify({
            'id': quick_data.id,
            'project_id': quick_data.project_id,
            'consumption': quick_data.consumption,
            'tariff': quick_data.tariff,
            'consumerType': quick_data.consumer_type,
            'transformerSize': quick_data.transformer_size,
            'selectedProfileId': quick_data.selected_profile_id,
            'profileScaler': quick_data.profile_scaler,
            'selectedSystemConfigJson': quick_data.selected_system_config_json
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500