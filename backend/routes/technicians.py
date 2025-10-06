from flask import Blueprint, request, jsonify
from models import db, User, TechnicianProfile
from flask_jwt_extended import jwt_required, get_jwt_identity

technicians_bp = Blueprint('technicians', __name__)

@technicians_bp.route('/technicians', methods=['GET'])
@jwt_required()
def get_technicians():
    """Get all technicians"""
    try:
        # Join TechnicianProfile with User to get both profile data and user names
        techs = db.session.query(
            TechnicianProfile, User
        ).join(
            User, TechnicianProfile.user_id == User.id
        ).all()

        # Format response
        result = []
        for profile, user in techs:
            result.append({
                "id": user.id,
                "tech_profile_id": profile.id,
                "full_name": user.full_name,
                "hourly_rate": float(profile.hourly_rate),
                "active": profile.active
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@technicians_bp.route('/technicians', methods=['POST'])
@jwt_required()
def create_technician():
    """Create a new technician profile"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('user_id') or not data.get('hourly_rate'):
            return jsonify({"error": "User ID and hourly rate are required"}), 400
            
        # Check if user exists
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        # Check if profile already exists
        existing = TechnicianProfile.query.filter_by(user_id=data['user_id']).first()
        if existing:
            return jsonify({"error": "Technician profile already exists for this user"}), 400
            
        # Create new profile
        profile = TechnicianProfile(
            user_id=data['user_id'],
            hourly_rate=data['hourly_rate'],
            active=data.get('active', True)
        )
        
        db.session.add(profile)
        db.session.commit()
        
        return jsonify({
            "id": profile.id,
            "user_id": profile.user_id,
            "hourly_rate": float(profile.hourly_rate),
            "active": profile.active,
            "full_name": user.full_name
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@technicians_bp.route('/technicians/<int:id>', methods=['PUT'])
@jwt_required()
def update_technician(id):
    """Update a technician profile"""
    try:
        profile = TechnicianProfile.query.get(id)
        if not profile:
            return jsonify({"error": "Technician profile not found"}), 404
            
        data = request.get_json()
        
        # Update fields
        if 'hourly_rate' in data:
            profile.hourly_rate = data['hourly_rate']
        if 'active' in data:
            profile.active = data['active']
            
        db.session.commit()
        
        user = User.query.get(profile.user_id)
        
        return jsonify({
            "id": profile.id,
            "user_id": profile.user_id,
            "hourly_rate": float(profile.hourly_rate),
            "active": profile.active,
            "full_name": user.full_name if user else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@technicians_bp.route('/technicians/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_technician(id):
    """Delete a technician profile"""
    try:
        profile = TechnicianProfile.query.get(id)
        if not profile:
            return jsonify({"error": "Technician profile not found"}), 404
            
        db.session.delete(profile)
        db.session.commit()
        
        return jsonify({"message": "Technician profile deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500