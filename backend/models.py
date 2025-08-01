# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect

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
    tariff_id = db.Column(db.Integer, db.ForeignKey('tariffs.id'), nullable=True)
    custom_flat_rate = db.Column(db.Numeric(10, 4), nullable=True)
    tariff = db.relationship('Tariffs', backref='projects')
    site_contact_person = db.Column(db.String(80), nullable=True)
    site_phone = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    surface_tilt = db.Column(db.Float, default=15.0)
    surface_azimuth = db.Column(db.Float, default=0.0)  # Default to North
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    design_type = db.Column(db.String(20), nullable=False) # 'detailed', 'quick'
    project_type = db.Column(db.String(50), nullable=False) # 'residential', 'commercial'
    use_pvgis = db.Column(db.Boolean, nullable=False, default=False)  # Whether to use PVGIS for generation profiles
    generation_profile_name = db.Column(db.String(100), nullable=True, default='midrand_ew_5')

    energy_data = db.relationship('EnergyData', backref='project', lazy=True)
    quick_design_entry = db.relationship('QuickDesignData', backref='project', uselist=False, lazy=True, cascade="all, delete-orphan")


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
    properties  = db.Column(JSONB, nullable=True)

    def as_dict(self):
        "Return a plain-dict representation of the Product instance (handy for JSON)."
        from sqlalchemy.inspection import inspect as sqlalchemy_inspect
        return {c.key: getattr(self, c.key) for c in sqlalchemy_inspect(self).mapper.column_attrs}
    
class ComponentRule(db.Model):
    __tablename__ = 'component_rules'
    id = db.Column(db.Integer, primary_key=True)
    subject_product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False) # e.g. 'REQUIRES', 'EXCLUDES'
    object_category = db.Column(db.String(50), nullable=False) # e.g. 'panel', 'inverter', 'battery', 'fuse'
    constraints = db.Column(JSONB, nullable=True) # {"voltage": 48, "min_amp_rating": 25}
    quantity_formula = db.Column(db.String(255), nullable=True) # e.g., "num_panels * 4"
    description = db.Column(db.String(255))
    subject_product = db.relationship('Product', backref='rules')

class OptimizationRun(db.Model):
    __tablename__ = "optimization_runs"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    system_type = db.Column(db.String(20))
    inputs_json = db.Column(db.JSON)
    best_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# NEW: A temporary model for testing the import process
class ProductTest(db.Model):
    __tablename__ = 'products_test' # Points to a new table
    id          = db.Column(db.Integer, primary_key=True)
    category    = db.Column(db.String(50), index=True)
    brand       = db.Column(db.String(80))
    model       = db.Column(db.String(120))
    power_w     = db.Column(db.Float,  nullable=True)
    rating_kva  = db.Column(db.Float,  nullable=True)
    capacity_kwh= db.Column(db.Float,  nullable=True)
    cost        = db.Column(db.Float,  nullable=True)
    price       = db.Column(db.Float,  nullable=True)
    warranty_y  = db.Column(db.Integer, nullable=True)
    notes       = db.Column(db.String(250))
    properties  = db.Column(JSONB, nullable=True)

class LoadProfiles(db.Model):
    __tablename__ = 'load_profiles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    profile_type = db.Column(db.String(50), nullable=False)  # 'residential', 'commercial'
    annual_kwh = db.Column(db.Float, nullable=True)  # Annual energy consumption in kWh
    profile_data = db.Column(JSONB, nullable=False)  # JSONB to store the load profile data

    def __repr__(self):
        return f'<LoadProfile {self.name}>'
    
class QuickDesignData(db.Model):
    __tablename__ = 'quick_design_data'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)

    # Fields from BasicInfoForm
    consumption = db.Column(db.Float, nullable=True)  # Monthly consumption in kWh
    tariff = db.Column(db.Float, nullable=True)  # Tariff in R/kWh
    consumer_type = db.Column(db.String(50), nullable=True)  # 'residential', 'commercial'
    transformer_size = db.Column(db.Float, nullable=True)  # Transformer size in kVA

    # Field for ProfileSelection
    selected_profile_id = db.Column(db.Integer, db.ForeignKey('load_profiles.id'), nullable=True)

    profile_scaler = db.Column(db.Float, nullable=True, default=1.0)  # Scaler for the load profile data

    # Field for SystemSelection (placeholder)
    selected_system_config_json = db.Column(JSONB, nullable=True)  # JSON to store selected system configuration

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    load_profile = db.relationship('LoadProfiles')

    def __repr__(self):
        return f'<QuickDesignData for Project {self.project_id}>'

# Die stoor die naam en tipe "kit", bv (Standard 50 kW Grid-Tied)
class SystemTemplate(db.Model):
    __tablename__ = 'system_templates'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.String(250))
    system_type = db.Column(db.String(50)) # 'Grid-Tied', 'Hybrid', 'Off-Grid'
    extras_cost = db.Column(db.Float, nullable=True, default=0)  # Extra cost for this template
    
    # Relationship to the components in the template
    components = db.relationship('SystemTemplateComponent', backref='template', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<SystemTemplate {self.name}>'

# Die is die crucial "linking" table tussen 'n SystemTemplate en die Products wat dit kort
class SystemTemplateComponent(db.Model):
    __tablename__ = 'system_template_components'
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('system_templates.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    
    # Relationship to the actual product
    product = db.relationship('Product')

    def __repr__(self):
        return f'<{self.quantity}x of ProductID {self.product_id} for TemplateID {self.template_id}>'
    
class Tariffs(db.Model):
    __tablename__ = 'tariffs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    power_user_type = db.Column(db.String(50)) # 'SPU' or 'LPU'
    tariff_category = db.Column(db.String(100), nullable=True) # e.g., 'Local Authority'
    transmission_zone = db.Column(db.String(100), nullable=True)
    supply_voltage = db.Column(db.String(100), nullable=True)
    code = db.Column(db.String(255), nullable=True)
    matrix_code = db.Column(db.String(50), nullable=True)
    structure = db.Column(db.String(50), nullable=False) # 'flat_rate', 'time_of_use', 'block'
    supplier = db.Column(db.String(100), nullable=True, default='Eskom')
    year = db.Column(db.String(20), nullable=True)
    
    # This creates a one-to-many relationship. One tariff plan can have many rate components.
    rates = db.relationship('TariffRates', backref='tariff', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Tariff {self.id}: {self.name}>'
    
class TariffRates(db.Model):
    __tablename__ = 'tariff_rates'
    id = db.Column(db.Integer, primary_key=True)
    tariff_id = db.Column(db.Integer, db.ForeignKey('tariffs.id'), nullable=False)
    
    charge_name = db.Column(db.String(150), nullable=False) # e.g., "Service and administration charge"
    charge_category = db.Column(db.String(50), nullable=False, index=True) # Our internal logic group: 'energy', 'fixed', 'demand'
    
    season = db.Column(db.String(50), default='all') # 'high', 'low', 'all'
    time_of_use = db.Column(db.String(50), default='all') # 'peak', 'standard', 'off_peak', 'all'
    
    rate_unit = db.Column(db.String(50), nullable=False) # 'c/kWh', 'R/POD/day', 'R/kVA/month'
    rate_value = db.Column(db.Numeric(12, 6), nullable=False) # Using Numeric for precision with monetary values
    
    block_threshold_kwh = db.Column(db.Numeric(10, 2), nullable=True) # The upper limit for tiered rates

    def __repr__(self):
        return f'<TariffRate for TariffID {self.tariff_id}: {self.charge_name}>'