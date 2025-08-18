# app.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_mail import Mail
from config import Config
from models import db, bcrypt
from flask_migrate import Migrate
import logging
import sys

# Initialize app
app = Flask(__name__)
app.config.from_object(Config)
# Update CORS for production - add your Vercel domain
CORS(app, origins=["http://localhost:3000", "https://your-app-name.vercel.app"], supports_credentials=True, allow_headers=['Content-Type', 'Authorization'])

# Initialize extensions
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)
mail = Mail(app)
migrate = Migrate(app, db)

logging.basicConfig(level=logging.INFO)

# JWT error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return {'message': 'Token has expired'}, 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"Invalid token error: {error}")
    return {'message': 'Invalid token'}, 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"Missing token error: {error}")
    return {'message': 'Authorization token is required'}, 401

@jwt.needs_fresh_token_loader
def token_not_fresh_callback(jwt_header, jwt_payload):
    return {'message': 'Fresh token required'}, 401

# Import and register blueprints
from routes.auth import auth_bp
from routes.clients import clients_bp
from routes.projects import projects_bp
from routes.simulation import simulation_bp
from routes.financial import financial_bp
from routes.consumption import consumption_bp
from routes.optimize import optimize_bp
from routes.products import products_bp
from routes.energy_data import energy_data_bp
from routes.system_templates import system_templates_bp
from routes.system_builder import system_builder_bp
from routes.quick_design import quick_design_bp
from routes.proposal_data import proposal_data_bp
from routes.load_profiles import load_profiles_bp
from routes.tariffs import tariffs_bp
from routes.rules import rules_bp
from routes.bom import bom_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(clients_bp, url_prefix='/api')
app.register_blueprint(projects_bp, url_prefix='/api')
app.register_blueprint(simulation_bp, url_prefix='/api')
app.register_blueprint(financial_bp, url_prefix='/api')
app.register_blueprint(consumption_bp, url_prefix='/api')
app.register_blueprint(optimize_bp, url_prefix='/api')
app.register_blueprint(products_bp, url_prefix='/api')
app.register_blueprint(energy_data_bp, url_prefix='/api')
app.register_blueprint(system_templates_bp, url_prefix='/api')
app.register_blueprint(system_builder_bp, url_prefix='/api')
app.register_blueprint(quick_design_bp, url_prefix='/api')
app.register_blueprint(proposal_data_bp, url_prefix='/api')
app.register_blueprint(load_profiles_bp, url_prefix='/api')
app.register_blueprint(tariffs_bp, url_prefix='/api')
app.register_blueprint(rules_bp, url_prefix='/api')
app.register_blueprint(bom_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)

import manage
