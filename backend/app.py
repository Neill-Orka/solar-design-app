# app.py
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_mail import Mail
from config import Config
from models import db, bcrypt
from flask_migrate import Migrate
from flask_socketio import SocketIO, join_room
from sqlalchemy import event
from models import (
    Product,
    Projects,
    BOMComponent,
    LoadProfiles,
    Tariffs,
    TariffRates,
    Document,
    DocumentKind,
    User,
    Clients,
)
import logging
import os

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

# from routes.system_templates import system_templates_bp
from routes.system_builder import system_builder_bp
from routes.proposal_data import proposal_data_bp
from routes.load_profiles import load_profiles_bp
from routes.tariffs import tariffs_bp
from routes.rules import rules_bp
from routes.bom import bom_bp
from routes.quotes import quotes_bp
from routes.jobcards import jobcards_bp
from routes.technicians import technicians_bp
from routes.invoices import invoices_bp
from routes.notifications import notifications_bp

# Initialize app
app = Flask(__name__)

env = os.environ.get("FLASK_ENV", "development")
if env == "production":
    app.config.from_object('config.ProductionConfig')
else:
    app.config.from_object('config.DevelopmentConfig')

print("Using SQLALCHEMY_DATABASE_URI:", app.config['SQLALCHEMY_DATABASE_URI'])



# app.config.from_object(Config)
# # Update CORS for production - add your Vercel domain
# LAN = "http://192.168.8.181:5173"
# ALLOWED_ORIGINS = [
#     "http://localhost:3000",
#     "https://solar-design-app.vercel.app",
#     "http://localhost:5173",
#     LAN,
# ]

app.config["UPLOAD_FOLDER"] = os.path.join(os.getcwd(), "uploads")
app.config["PUBLIC_UPLOAD_BASE"] = "/uploads"

CORS(
    app,
    origins=app.config['ALLOWED_ORIGINS'],
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)

socketio = SocketIO(app, cors_allowed_origins=app.config['ALLOWED_ORIGINS'], async_mode="eventlet")

# Initialize extensions
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)
mail = Mail(app)
migrate = Migrate(app, db)

logging.basicConfig(level=logging.INFO)


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@socketio.on("join")
def on_join(data):
    for r in data.get("rooms", []):
        join_room(r)


def _emit(kind, payload, room=None):
    try:
        socketio.emit(kind, payload, to=room) if room else socketio.emit(kind, payload)
    except Exception as e:
        app.logger.warning(f"socket emit failed: {e}")


# JWT error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return {"message": "Token has expired"}, 401


@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"Invalid token error: {error}")
    return {"message": "Invalid token"}, 401


@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"Missing token error: {error}")
    return {"message": "Authorization token is required"}, 401


@jwt.needs_fresh_token_loader
def token_not_fresh_callback(jwt_header, jwt_payload):
    return {"message": "Fresh token required"}, 401


app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(clients_bp, url_prefix="/api")
app.register_blueprint(projects_bp, url_prefix="/api")
app.register_blueprint(simulation_bp, url_prefix="/api")
app.register_blueprint(financial_bp, url_prefix="/api")
app.register_blueprint(consumption_bp, url_prefix="/api")
app.register_blueprint(optimize_bp, url_prefix="/api")
app.register_blueprint(products_bp, url_prefix="/api")
app.register_blueprint(energy_data_bp, url_prefix="/api")
# app.register_blueprint(system_templates_bp, url_prefix='/api')
app.register_blueprint(system_builder_bp, url_prefix="/api")
app.register_blueprint(proposal_data_bp, url_prefix="/api")
app.register_blueprint(load_profiles_bp, url_prefix="/api")
app.register_blueprint(tariffs_bp, url_prefix="/api")
app.register_blueprint(rules_bp, url_prefix="/api")
app.register_blueprint(bom_bp, url_prefix="/api")
app.register_blueprint(quotes_bp, url_prefix="/api")
app.register_blueprint(jobcards_bp, url_prefix="/api")
app.register_blueprint(technicians_bp, url_prefix="/api")
app.register_blueprint(invoices_bp, url_prefix="/api")
app.register_blueprint(notifications_bp, url_prefix="/api")


@event.listens_for(Product, "after_insert")
@event.listens_for(Product, "after_update")
@event.listens_for(Product, "after_delete")
def _product_changed(mapper, connection, target):
    _emit("product:updated", {"id": getattr(target, "id", None)}, room="products")


@event.listens_for(Projects, "after_insert")
@event.listens_for(Projects, "after_update")
@event.listens_for(Projects, "after_delete")
def _projects_changed(mapper, connection, target):
    pid = getattr(target, "id", None)
    _emit("projects:updated", {"id": pid}, room="projects")  # NEW
    if pid:
        _emit("project:updated", {"id": pid}, room=f"project:{pid}")  # existing pattern


# clients -> NEW listener + broadcast
@event.listens_for(Clients, "after_insert")
@event.listens_for(Clients, "after_update")
@event.listens_for(Clients, "after_delete")
def _clients_changed(mapper, connection, target):
    _emit("clients:updated", {"id": getattr(target, "id", None)}, room="clients")


@event.listens_for(BOMComponent, "after_insert")
@event.listens_for(BOMComponent, "after_update")
@event.listens_for(BOMComponent, "after_delete")
def _bom_changed(mapper, connection, target):
    pid = getattr(target, "project_id", None)
    if pid:
        _emit("project:updated", {"id": pid}, room=f"project:{pid}")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
