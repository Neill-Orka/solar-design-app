# routes/projects.py
from flask import Blueprint, request, jsonify
from models import db, Projects, Clients

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
            'site_phone': project.site_phone
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@projects_bp.route('/projects', methods=['POST'])
def add_project():
    try:
        data = request.json
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
            site_phone=data.get('site_phone')
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
        for key, value in data.items():
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
