# app.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config
from models import db
from flask_migrate import Migrate

# Initialize app
app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Import and register blueprints
from routes.clients import clients_bp
from routes.projects import projects_bp
from routes.simulation import simulation_bp
from routes.financial import financial_bp
from routes.consumption import consumption_bp
from routes.optimize import optimize_bp
from routes.products import products_bp
from routes.energy_data import energy_data_bp

app.register_blueprint(clients_bp, url_prefix='/api')
app.register_blueprint(projects_bp, url_prefix='/api')
app.register_blueprint(simulation_bp, url_prefix='/api')
app.register_blueprint(financial_bp, url_prefix='/api')
app.register_blueprint(consumption_bp, url_prefix='/api')
app.register_blueprint(optimize_bp, url_prefix='/api')
app.register_blueprint(products_bp, url_prefix='/api')
app.register_blueprint(energy_data_bp, url_prefix='/api')

db.init_app(app)
migrate = Migrate(app, db)

if __name__ == '__main__':
    app.run(debug=True)
