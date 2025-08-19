# routes/clients.py
from flask import Blueprint, request, jsonify
from models import db, Clients, User, UserRole
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
import psycopg2.errors

clients_bp = Blueprint('clients', __name__)

@clients_bp.route('/clients', methods=['GET'])
def get_clients():
    try:
        clients = Clients.query.all()
        return jsonify([
            {
                'id': c.id,
                'client_name': c.client_name,
                'email': c.email,
                'phone': c.phone
            }
            for c in clients
        ])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clients_bp.route('/clients/<int:client_id>', methods=['GET'])
def get_client(client_id):
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({'error': 'Client not found'}), 404
        return jsonify({
            'id': client.id,
            'client_name': client.client_name,
            'email': client.email,
            'phone': client.phone
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clients_bp.route('/clients', methods=['POST'])
def add_client():
    try:
        data = request.json
        new_client = Clients(
            client_name=data['client_name'],
            email=data['email'],
            phone=data['phone']
        )
        db.session.add(new_client)
        db.session.commit()
        return jsonify({'message': 'Client added successfully!', 'client_id': new_client.id}), 200
    except IntegrityError as e:
        db.session.rollback()
        if isinstance(e.orig, psycopg2.errors.UniqueViolation):
            return jsonify({"error": f"Email {data['email']} already exists"}), 400
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@clients_bp.route('/clients/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({'error': 'Client not found'}), 404

        data = request.json
        client.client_name = data.get('client_name', client.client_name)
        client.email = data.get('email', client.email)
        client.phone = data.get('phone', client.phone)

        db.session.commit()
        return jsonify({'message': 'Client updated successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@clients_bp.route('/clients/<int:client_id>', methods=['DELETE'])
@jwt_required()
def delete_client(client_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({
            'error': 'forbidden',
            'message': 'Access Restricted: Only administrators can delete clients.'
        }), 403
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({'error': 'Client not found'}), 404

        # Check if client has any projects
        if client.projects:
            project_names = [project.name for project in client.projects]
            return jsonify({
                'error': 'Cannot delete client with existing projects',
                'message': f'This client has {len(client.projects)} project(s): {", ".join(project_names)}. Please delete all projects first before deleting the client.',
                'projects': project_names
            }), 400

        db.session.delete(client)
        db.session.commit()
        return jsonify({'message': 'Client deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
