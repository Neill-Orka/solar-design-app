# routes/projects.py
from flask import Blueprint, request, jsonify
from models import db, Projects, Clients, LoadProfiles, QuickDesignData, Product, ComponentRule, User, UserRole, EnergyData, BOMComponent
from flask_jwt_extended import jwt_required, get_jwt_identity
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
                'client_email': p.client.email,
                'client_phone': p.client.phone,
                'location': p.location,
                'latitude': p.latitude,
                'longitude': p.longitude,
                'system_type': p.system_type,
                'panel_kw': p.panel_kw,
                'panel_id': p.panel_id,
                'inverter_kva': p.inverter_kva,
                'inverter_ids': p.inverter_ids if p.inverter_ids is not None else [],
                'battery_ids': p.battery_ids if p.battery_ids is not None else [],
                'battery_kwh': p.battery_kwh,
                'project_value_excl_vat': p.project_value_excl_vat,
                'site_contact_person': p.site_contact_person,
                'site_phone': p.site_phone,
                'design_type': p.design_type,
                'project_type': p.project_type,
                'tariff_id': p.tariff_id,
                'custom_flat_rate': p.custom_flat_rate,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'tariff_details': serialize_tariff(p.tariff) if p.tariff else None,
            }
            for p in projects
        ])
    except Exception as e:
        import traceback
        print(f"Error in get_projects: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project_by_id(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        # Update debug logging to remove panel_id
        print(f"Project data: ID={project.id}, inverter_ids={project.inverter_ids}, battery_ids={project.battery_ids}")
        
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
            pass

        inverter_ids = project.inverter_ids if project.inverter_ids is not None else []
        battery_ids = project.battery_ids if project.battery_ids is not None else []

        from_standard_template = getattr(project, 'from_standard_template', False)
        template_id = getattr(project, 'template_id', None)
        template_name = getattr(project, 'template_name', None)
        bom_modified = getattr(project, 'bom_modified', False)

        return jsonify({
            'id': project.id,
            'name': project.name,
            'client_name': project.client.client_name,
            'client_email': project.client.email,
            'client_phone': project.client.phone,
            'company': project.client.company,
            'vat_number': project.client.vat_number,
            'location': project.location,
            'latitude': project.latitude,
            'longitude': project.longitude,
            'system_type': project.system_type,
            'panel_kw': project.panel_kw,
            'panel_id': project.panel_id,
            'num_panels': project.num_panels,
            'inverter_kva': project.inverter_kva,
            'inverter_ids': inverter_ids,
            'battery_ids': battery_ids,
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
            'surface_tilt': project.surface_tilt,
            'surface_azimuth': project.surface_azimuth,
            'use_pvgis': project.use_pvgis,
            'generation_profile_name': project.generation_profile_name,
            # Make sure these fields are included
            'from_standard_template': from_standard_template,
            'template_id': template_id,
            'template_name': template_name,
            'bom_modified': bom_modified,
        })
    except Exception as e:
        # Add better error logging
        import traceback
        print(f"Error in get_project_by_id: {str(e)}")
        print(traceback.format_exc())
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
        return jsonify({
            'message': 'Project added successfully!',
            'project_id': new_project.id
        }), 201
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

        if 'panel_id' in data:
            project.panel_id = data['panel_id'] or None
        if 'panel_kw' in data:
            project.panel_kw = float(data['panel_kw'] or 0)

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

        if 'use_pvgis' in data:
            project.use_pvgis = data['use_pvgis']
        if 'generation_profile_name' in data:
            project.generation_profile_name = data['generation_profile_name']

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
@jwt_required()
def delete_project(project_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({
            'error': 'forbidden',
            'message': 'Access Restricted: Only administrators can delete projects.'
        }), 403
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        # Bulk delete children to avoid per-row cascade overhead
        db.session.query(EnergyData).filter_by(project_id=project_id).delete(synchronize_session=False)
        db.session.query(BOMComponent).filter_by(project_id=project_id).delete(synchronize_session=False)
        db.session.query(QuickDesignData).filter_by(project_id=project_id).delete(synchronize_session=False)
     
        db.session.delete(project)
        db.session.commit()
        return jsonify({'message': 'Project deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
# Endpoint to find compatible products based on rules
@projects_bp.route('/compatible_products', methods=['GET'])
def get_compatible_products():
    subject_id = request.args.get('subject_id', type=int)
    object_category = request.args.get('category', type=str)

    if not subject_id or not object_category:
        return jsonify({"error": "subject_id and category are required parameters"}), 400

    # Base query for the category of products we want
    query = Product.query.filter_by(category=object_category)

    # Handle REQUIRE rules
    require_rule = ComponentRule.query.filter_by(
        subject_product_id=subject_id,
        rule_type='REQUIRES_ONE',
        object_category=object_category
    ).first()

    if require_rule and require_rule.constraints:
        for key, value in require_rule.constraints.items():
            query = query.filter(Product.properties[key].astext == str(value))

    # Get all exclusion rules for the subject product
    exclusion_rules = ComponentRule.query.filter_by(
        subject_product_id=subject_id,
        rule_type='EXCLUDES',
        object_category=object_category
    ).all()

    # Apply exclusion rules to the query
    for rule in exclusion_rules:
        if rule.constraints:
            for key, value in rule.constraints.items():
                # This filters the JSONB 'properties' column
                query = query.filter(Product.properties[key].astext != str(value))
    
    compatible_products = query.all()
    return jsonify([p.as_dict() for p in compatible_products])

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
                'monthly_avg_kwh_original': profile.monthly_avg_kwh_original,
                'max_peak_demand_kw': profile.max_peak_demand_kw,
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