# routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from models import SA_TZ, db, User, RefreshToken, AuditLog, UserRole, RegistrationToken, TechnicianProfile
from datetime import datetime, timedelta
import re
from functools import wraps

auth_bp = Blueprint('auth', __name__)


def validate_email_domain(email):
    """Validate that email belongs to the orkasolar.co.za domain"""
    return email.lower().endswith(current_app.config['ALLOWED_EMAIL_DOMAIN'])


def validate_password_strength(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"


def log_user_action(user_id, action, resource_type, resource_id=None, details=None):
    """Log user action for audit trail"""
    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=request.environ.get('REMOTE_ADDR'),
            user_agent=request.headers.get('User-Agent')
        )
        db.session.add(audit_log)
        db.session.commit()
    except Exception as e:
        print(f"Failed to log user action: {e}")


def require_role(*allowed_roles):
    """Decorator to require specific user roles"""

    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)

            if not user or not user.is_active:
                return jsonify({'message': 'User not found or inactive'}), 401

            if user.role not in allowed_roles:
                return jsonify({'message': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def parse_role(val) -> UserRole:
    if isinstance(val, UserRole):
        return val
    if isinstance(val, str):
        s = val.strip()
        # try by NAME first (DB enum names are UPPERCASE)
        try:
            return UserRole[s.upper()]
        except KeyError:
            # Then by VALUE (lowercase slug)
            try:
                return UserRole(s.lower())
            except KeyError:
                pass
    raise ValueError(f"Invalid role: {val!r}")


@auth_bp.route('/admin/register', methods=['POST'])
def register_admin():
    """Register the first admin user (only if no users exist)"""
    try:
        # Check if any users exist
        if User.query.count() > 0:
            return jsonify({'message': 'Admin already exists'}), 400

        data = request.get_json()

        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'{field} is required'}), 400

        email = data['email'].lower().strip()

        # Validate email domain
        if not validate_email_domain(email):
            return jsonify({'message': 'Only @orkasolar.co.za emails are allowed'}), 400

        # Validate password
        is_valid, msg = validate_password_strength(data['password'])
        if not is_valid:
            return jsonify({'message': msg}), 400

        # Create admin user
        admin = User(
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=UserRole.ADMIN,
            is_active=True,
            is_email_verified=True
        )
        admin.set_password(data['password'])

        db.session.add(admin)
        db.session.commit()

        # Log the action
        log_user_action(admin.id, 'CREATE', 'user', admin.id, {'type': 'admin_registration'})

        return jsonify({
            'message': 'Admin user created successfully',
            'user': admin.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = request.get_json()

        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400

        email = data['email'].lower().strip()

        # Find user
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(data['password']):
            return jsonify({'message': 'Invalid email or password'}), 401

        if not user.is_active:
            return jsonify({'message': 'Account is inactive'}), 401

        # Update last login
        user.last_login = datetime.now(SA_TZ)

        # Create tokens
        access_token = create_access_token(identity=str(user.id))
        # refresh_token_str = create_refresh_token(identity=str(user.id))

        # Store refresh token in database
        db_refresh = RefreshToken(
            user_id=user.id,
            token=RefreshToken.generate_token(),
            expires_at=datetime.now(SA_TZ) + current_app.config['JWT_REFRESH_TOKEN_EXPIRES']
        )

        db.session.add(db_refresh)
        db.session.commit()

        # Log the action
        log_user_action(user.id, 'LOGIN', 'authentication', details={
            'login_time': datetime.now(SA_TZ).isoformat()
        })

        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': db_refresh.token,
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Refresh access token (SLIDING refresh expiry)"""
    try:
        data = request.get_json()
        refresh_token_str = data.get('refresh_token')
        if not refresh_token_str:
            return jsonify({'message': 'Refresh token is required'}), 400

        # Find refresh token in DB
        rt = RefreshToken.query.filter_by(token=refresh_token_str).first()
        if not rt or not rt.is_valid():
            return jsonify({'message': 'Invalid or expired refresh token'}), 401

        # 1) Issue a new access token
        access_token = create_access_token(identity=str(rt.user_id))

        # 2) Slide refresh token expiry forward (user stays logged in while active)
        rt.expires_at = datetime.now(SA_TZ) + current_app.config['JWT_REFRESH_TOKEN_EXPIRES']

        db.session.commit()
        payload = {'access_token': access_token}

        return jsonify(payload), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        refresh_token_str = data.get('refresh_token')

        # Revoke refresh token if provided
        if refresh_token_str:
            refresh_token = RefreshToken.query.filter_by(
                token=refresh_token_str,
                user_id=current_user_id
            ).first()
            if refresh_token:
                refresh_token.revoke()
                db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'LOGOUT', 'authentication')

        return jsonify({'message': 'Logout successful'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or not user.is_active:
            return jsonify({'message': 'User not found or inactive'}), 401

        return jsonify({
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/generate-token', methods=['POST'])
@require_role(UserRole.ADMIN)
def generate_registration_token():
    """Generate a registration token (Admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()

        # Get role (default to DESIGN if not specified)
        role = parse_role(data.get('role', 'DESIGN'))

        # Generate token
        token_string = RegistrationToken.generate_token()

        # Create registration token (expires in 7 days)
        registration_token = RegistrationToken(
            token=token_string,
            role=role,  # Store uppercase role to match database constraint
            created_by_id=current_user_id,
            expires_at=datetime.now(SA_TZ) + timedelta(days=7)
        )

        db.session.add(registration_token)
        db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'CREATE', 'registration_token', registration_token.id, {
            'token': token_string,
            'role': role.value
        })

        return jsonify({
            'message': 'Registration token generated successfully',
            'token': token_string,
            'role': role.value,
            'expires_at': registration_token.expires_at.isoformat()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/tokens', methods=['GET'])
@require_role(UserRole.ADMIN)
def get_registration_tokens():
    """Get all registration tokens (Admin only)"""
    try:
        tokens = RegistrationToken.query.order_by(RegistrationToken.created_at.desc()).all()

        return jsonify({
            'tokens': [token.to_dict() for token in tokens]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/register', methods=['POST'])
def register_with_token():
    """Register a new user with a token"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name', 'token']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'{field} is required'}), 400

        email = data['email'].lower().strip()
        token_string = data['token'].upper().strip()

        # Validate email domain
        if not validate_email_domain(email):
            return jsonify({'message': 'Only @orkasolar.co.za emails are allowed'}), 400

        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'message': 'User with this email already exists'}), 400

        # Find and validate token
        token = RegistrationToken.query.filter_by(token=token_string).first()

        if not token or not token.is_valid():
            return jsonify({'message': 'Invalid or expired registration token'}), 400

        # Validate password
        is_valid, msg = validate_password_strength(data['password'])
        if not is_valid:
            return jsonify({'message': msg}), 400

        # Create user
        user = User(
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=parse_role(token.role),
            is_active=True,
            is_email_verified=True,
            created_by_id=token.created_by_id
        )
        user.set_password(data['password'])

        # Mark token as used
        token.use_token(user.id)

        db.session.add(user)
        db.session.commit()

        # Log the action
        log_user_action(user.id, 'CREATE', 'user', user.id, {
            'type': 'token_registration',
            'token_used': token_string
        })

        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/validate-token', methods=['POST'])
def validate_token():
    """Validate a registration token"""
    try:
        data = request.get_json()

        if not data.get('token'):
            return jsonify({'message': 'Token is required'}), 400

        token_string = data['token'].upper().strip()
        token = RegistrationToken.query.filter_by(token=token_string).first()

        if not token:
            return jsonify({'valid': False, 'message': 'Token not found'}), 404

        if not token.is_valid():
            return jsonify({'valid': False, 'message': 'Token expired or already used'}), 400

        return jsonify({
            'valid': True,
            'role': token.role.value,
            'expires_at': token.expires_at.isoformat()
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/users', methods=['GET'])
@require_role(UserRole.ADMIN)
def get_users():
    """Get all users (Admin only)"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/users/<int:user_id>/activate', methods=['POST'])
@require_role(UserRole.ADMIN)
def activate_user(user_id):
    """Activate user (Admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get_or_404(user_id)

        user.is_active = True
        db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'UPDATE', 'user', user.id, {
            'type': 'activation'
        })

        return jsonify({
            'message': 'User activated successfully',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/users/<int:user_id>/deactivate', methods=['POST'])
@require_role(UserRole.ADMIN)
def deactivate_user(user_id):
    """Deactivate user (Admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get_or_404(user_id)

        # Can't deactivate yourself
        if user.id == current_user_id:
            return jsonify({'message': 'Cannot deactivate your own account'}), 400

        user.is_active = False
        db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'UPDATE', 'user', user.id, {
            'type': 'deactivation'
        })

        return jsonify({
            'message': 'User deactivated successfully',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/users/<int:user_id>/delete', methods=['DELETE'])
@require_role(UserRole.ADMIN)
def delete_user(user_id):
    """Delete a user (Admin only)"""
    try:
        current_user_id = get_jwt_identity()

        # Prevent self-deletion
        if current_user_id == user_id:
            return jsonify({'message': 'Cannot delete your own account'}), 400

        user = User.query.get_or_404(user_id)

        # Log the action before deletion
        log_user_action(current_user_id, 'DELETE', 'user', user.id, {
            'deleted_user_email': user.email,
            'deleted_user_role': user.role.value
        })

        # Delete the user
        db.session.delete(user)
        db.session.commit()

        return jsonify({
            'message': f'User {user.email} deleted successfully'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/users/<int:user_id>/role', methods=['PUT'])
@require_role(UserRole.ADMIN)
def change_user_role(user_id):
    """Change a user's role (Admin only)"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data or 'role' not in data:
            return jsonify({'message': 'Role is required'}), 400

        try:
            new_role = parse_role(data['role'])
        except (KeyError, ValueError):
            valid_values = [r.value for r in UserRole]
            valid_names = [r.name for r in UserRole]
            return jsonify({'message': f'Invalid role. Use one of names {valid_names} or values {valid_values}'}), 400

        user = User.query.get_or_404(user_id)

        old_role = user.role
        user.role = new_role

        # Prevent changing own role from admin
        if current_user_id == user_id and user.role == UserRole.ADMIN:
            return jsonify({'message': 'Cannot change your own admin role'}), 400

        # Update user role
        user.role = UserRole(new_role)
        db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'UPDATE', 'user', user.id, {
            'type': 'role_change',
            'old_role': old_role.value,
            'new_role': new_role.value
        })

        return jsonify({
            'message': f'User role changed from {old_role} to {new_role}',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/admin/audit-logs', methods=['GET'])
@require_role(UserRole.ADMIN)
def get_audit_logs():
    """Get audit logs (Admin only)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'logs': [log.to_dict() for log in logs.items],
            'total': logs.total,
            'pages': logs.pages,
            'current_page': page
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users_minimal():
    """
    Minimal users list for pickers.
    GET /api/users?is_bum=1&active=1
    Returns: [{id, full_name, is_bum}]
    """
    try:
        q = User.query
        # default to only active=1 unless explicitly disabled
        active = request.args.get('active', '1')
        if active in ('1', 'true', 'True'):
            q = q.filter(User.is_active.is_(True))

        # optional filter: only BUMs
        is_bum = request.args.get('is_bum')
        if is_bum in ('1', 'true', 'True'):
            q = q.filter(User.is_bum.is_(True))

        users = q.order_by(User.first_name.asc(), User.last_name.asc()).all()
        return jsonify([
            {"id": u.id, "full_name": u.full_name, "is_bum": bool(getattr(u, "is_bum", False))}
            for u in users
        ]), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@auth_bp.route('/admin/users/<int:user_id>/update-bum-status', methods=['POST'])
@require_role(UserRole.ADMIN)
def update_bum_status(user_id):
    """Update a user's BUM status (Admin only)"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if 'is_bum' not in data:
            return jsonify({'message': 'is_bum field is required'}), 400

        user = User.query.get_or_404(user_id)

        # Update BUM status
        old_status = user.is_bum
        user.is_bum = bool(data['is_bum'])

        db.session.commit()

        # Log the action
        log_user_action(current_user_id, 'UPDATE', 'user', user.id, {
            'type': 'bum_status_change',
            'old_status': old_status,
            'new_status': user.is_bum
        })

        return jsonify({
            'message': f'User BUM status updated successfully',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

    # Endpoint to list technicians


@auth_bp.route('/technicians', methods=['GET'])
@jwt_required()
def list_technicians():
    """
    Get list of technicians from the TechnicianProfile table.
    Returns [{id, user_id, full_name, hourly_rate, active ]
    """
    try:
        # Join TechnicianProfile with Uer to get both profile data and user names
        techs = db.session.query(
            TechnicianProfile, User
        ).join(
            User, TechnicianProfile.user_id == User.id
        ).filter(
            TechnicianProfile.active == True
        ).all()

        # Format response
        result = []
        for profile, user in techs:
            result.append({
                "id": user.id,
                "tech_profile_id": profile.id,
                "full_name": user.full_name,
                "hourly_rate": profile.hourly_rate,
                "active": profile.active
            })

        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching technicians: {str(e)}")
        return jsonify({"Error": "Failed to get technician data"}), 500


@auth_bp.route("/users/bms", methods=["GET"])
@jwt_required()
def get_bums():
    """Returns a list of all active Business Unit Managers."""
    try:
        bums = User.query.filter_by(is_bum=True, is_active=True).order_by(User.first_name).all()
        return jsonify([{"id": bum.id, "full_name": bum.full_name} for bum in bums])
    except Exception as e:
        current_app.logger.error(f"Failed to fetch BUMs: {e}")
        return jsonify({"error": "Could not retrieve BUM list."}), 500
