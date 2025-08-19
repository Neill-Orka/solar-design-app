# routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    jwt_required, get_jwt_identity, get_jwt
)
from flask_mail import Message
from models import db, User, RefreshToken, AuditLog, UserRole
from datetime import datetime, timedelta
import re
from functools import wraps

auth_bp = Blueprint('auth', __name__)

def send_invitation_email(user, invitation_token):
    """Send invitation email to user"""
    try:
        from app import mail  # Import mail instance
        
        frontend_url = current_app.config.get('FRONTEND_URL', 'https://your-app-name.vercel.app')
        invitation_link = f"{frontend_url}/accept-invitation/{invitation_token}"
        
        msg = Message(
            subject='Invitation to join Orka Solar Design Platform',
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            recipients=[user.email],
            html=f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Welcome to Orka Solar</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Design Platform Invitation</p>
                </div>
                
                <div style="padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px;">
                    <h2 style="color: #333; margin-top: 0;">Hi {user.first_name}!</h2>
                    
                    <p style="color: #555; line-height: 1.6;">
                        You've been invited to join the Orka Solar Design Platform. Click the button below to accept your invitation and set up your account.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: bold; 
                                  display: inline-block;">
                            Accept Invitation
                        </a>
                    </div>
                    
                    <p style="color: #888; font-size: 14px;">
                        This invitation will expire in 7 days. If you're unable to click the button, copy and paste this link into your browser:
                    </p>
                    <p style="color: #667eea; word-break: break-all; font-size: 14px;">
                        {invitation_link}
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                    <p>© 2025 Orka Solar. All rights reserved.</p>
                </div>
            </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send invitation email: {e}")
        return False

def validate_email_domain(email):
    """Validate that email belongs to orkasolar.co.za domain"""
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
            
            if user.role.value not in [role.value for role in allowed_roles]:
                return jsonify({'message': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

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
        user.last_login = datetime.utcnow()
        
        # Create tokens
        access_token = create_access_token(identity=str(user.id))
        refresh_token_str = create_refresh_token(identity=str(user.id))
        
        # Store refresh token in database
        refresh_token = RefreshToken(
            user_id=user.id,
            token=RefreshToken.generate_token(),
            expires_at=datetime.utcnow() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES']
        )
        
        db.session.add(refresh_token)
        db.session.commit()
        
        # Log the action
        log_user_action(user.id, 'LOGIN', 'authentication', details={
            'login_time': datetime.utcnow().isoformat()
        })
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token.token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Refresh access token"""
    try:
        data = request.get_json()
        refresh_token_str = data.get('refresh_token')
        
        if not refresh_token_str:
            return jsonify({'message': 'Refresh token is required'}), 400
        
        # Find refresh token
        refresh_token = RefreshToken.query.filter_by(token=refresh_token_str).first()
        
        if not refresh_token or not refresh_token.is_valid():
            return jsonify({'message': 'Invalid or expired refresh token'}), 401
        
        # Create new access token
        access_token = create_access_token(identity=str(refresh_token.user_id))
        
        return jsonify({
            'access_token': access_token
        }), 200
        
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

@auth_bp.route('/admin/invite', methods=['POST'])
@require_role(UserRole.ADMIN)
def invite_user():
    """Invite a new user (Admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'first_name', 'last_name', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'{field} is required'}), 400
        
        email = data['email'].lower().strip()
        
        # Validate email domain
        if not validate_email_domain(email):
            return jsonify({'message': 'Only @orkasolar.co.za emails are allowed'}), 400
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'message': 'User with this email already exists'}), 400
        
        # Validate role
        try:
            role = UserRole(data['role'])
        except ValueError:
            return jsonify({'message': 'Invalid role'}), 400
        
        # Create user with invitation
        user = User(
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=role,
            is_active=False,  # Will be activated when they accept invitation
            invited_by_id=current_user_id,
            created_by_id=current_user_id
        )
        
        # Generate invitation token
        invitation_token = user.generate_invitation_token()
        
        # Set temporary password (will be changed on first login)
        user.set_password('TempPassword123!')
        
        db.session.add(user)
        db.session.commit()
        
        # Log the action
        log_user_action(current_user_id, 'CREATE', 'user', user.id, {
            'type': 'invitation',
            'invited_email': email,
            'role': role.value
        })
        
        # Send invitation email
        email_sent = send_invitation_email(user, invitation_token)
        
        response_data = {
            'message': 'User invited successfully',
            'user': user.to_dict(),
            'email_sent': email_sent
        }
        
        # Include invitation link in development
        if current_app.config.get('ENV') == 'development':
            frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
            response_data['invitation_link'] = f"{frontend_url}/accept-invitation/{invitation_token}"
        
        return jsonify(response_data), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@auth_bp.route('/accept-invitation/<token>', methods=['POST'])
def accept_invitation(token):
    """Accept user invitation and set password"""
    try:
        data = request.get_json()
        
        if not data.get('password'):
            return jsonify({'message': 'Password is required'}), 400
        
        # Find user by invitation token
        user = User.query.filter_by(invitation_token=token).first()
        
        if not user or not user.is_invitation_valid():
            return jsonify({'message': 'Invalid or expired invitation'}), 400
        
        # Validate password
        is_valid, msg = validate_password_strength(data['password'])
        if not is_valid:
            return jsonify({'message': msg}), 400
        
        # Activate user and set password
        user.set_password(data['password'])
        user.is_active = True
        user.is_email_verified = True
        user.invitation_token = None
        user.invitation_expires = None
        
        db.session.commit()
        
        # Log the action
        log_user_action(user.id, 'UPDATE', 'user', user.id, {
            'type': 'invitation_accepted'
        })
        
        return jsonify({
            'message': 'Invitation accepted successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
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
