# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Clients(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(80))
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))

    projects = db.relationship('Projects', backref='client', lazy=True)


class Projects(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    system_type = db.Column(db.String(20))
    panel_kw = db.Column(db.Float)
    inverter_kva = db.Column(db.Float)
    battery_kwh = db.Column(db.Float)
    project_value_excl_vat = db.Column(db.Float, nullable=True)
    site_contact_person = db.Column(db.String(80), nullable=True)
    site_phone = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    energy_data = db.relationship('EnergyData', backref='project', lazy=True)


class EnergyData(db.Model):
    __tablename__ = 'energy_data'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    timestamp = db.Column(db.DateTime)
    demand_kw = db.Column(db.Float)
