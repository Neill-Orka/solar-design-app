# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

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
    inverter_kva = db.Column(JSONB)
    battery_kwh = db.Column(JSONB)
    inverter_ids = db.Column(JSONB) # NEW COLUMN
    battery_ids = db.Column(JSONB) # NEW COLUMN
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

class Product(db.Model):
    __tablename__ = 'products'
    id          = db.Column(db.Integer, primary_key=True)
    category    = db.Column(db.String(20), index=True)  # 'panel', 'inverter', 'battery'
    brand       = db.Column(db.String(80))
    model       = db.Column(db.String(120))
    power_w     = db.Column(db.Float,  nullable=True)   # panel STC power
    rating_kva  = db.Column(db.Float,  nullable=True)   # inverter rating
    capacity_kwh= db.Column(db.Float,  nullable=True)   # battery capacity
    cost        = db.Column(db.Float,  nullable=True)   # your cost
    price       = db.Column(db.Float,  nullable=True)   # selling price
    warranty_y  = db.Column(db.Integer, nullable=True)
    notes       = db.Column(db.String(250))

    def as_dict(self):
        "Return a plain-dict representation of the Product instance (handy for JSON)."
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
    
class OptimizationRun(db.Model):
    __tablename__ = "optimization_runs"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    system_type = db.Column(db.String(20))
    inputs_json = db.Column(db.JSON)
    best_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
