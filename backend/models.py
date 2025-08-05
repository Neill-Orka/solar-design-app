# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect
from sqlalchemy.orm import synonym

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
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    # ─── 1‒11 : General info  ──────────────────────────────────────────────────
    category               = db.Column("Category",               db.String(50))
    component_type         = db.Column("Component Type",         db.String(50))
    brand_name             = db.Column("Brand Name",             db.String(80))
    description            = db.Column("Description",            db.String(300))
    notes                  = db.Column("Notes",                  db.String(300))
    supplier               = db.Column("Supplier",               db.String(80))
    updated                = db.Column("Updated",                db.String(30))  # keep string for max flexibility
    unit_cost              = db.Column("Unit Cost",              db.Float)
    qty                    = db.Column("QTY",                    db.Integer)
    margin                 = db.Column("Margin",                 db.Float)
    price                  = db.Column("Price",                  db.Float)

    # ─── 12‒17 : PV-module electrical  ────────────────────────────────────────
    power_rating_w         = db.Column("Power Rating (W)",       db.Float)
    isc_a                  = db.Column("Isc (A)",                db.Float)
    max_voc_v              = db.Column("Max Voc (V)",            db.Float)
    imp_a                  = db.Column("Imp (A)",                db.Float)
    vmp                    = db.Column("Vmp",                    db.Float)
    number_of_phases       = db.Column("Number Of Phases",       db.Integer)

    # ─── 18‒27 : Inverter / charger limits  ───────────────────────────────────
    power_rating_kva                       = db.Column("Power Rating (kVA)",                        db.Float)
    number_of_inputs                       = db.Column("Number of Inputs",                         db.Integer)
    max_input_current_per_input_a          = db.Column("Max Input Current per Input (A)",           db.Float)
    number_of_mppt                         = db.Column("Number of MPPT",                           db.Integer)
    max_input_current_per_mppt_a           = db.Column("Max Input Current per MPPT (A)",            db.Float)
    max_isc_per_mppt_a                     = db.Column("Max Isc per MPPT (A)",                      db.Float)
    max_dc_input_voltage_per_mppt_v        = db.Column("Max DC Input Voltage per MPPT (V)",         db.Float)
    min_operating_voltage_range_v          = db.Column("Min Operating Voltage Range (V)",           db.Float)
    max_operating_voltage_range_v          = db.Column("Max Operating Voltage Range (V)",           db.Float)
    rated_input_voltage_v                  = db.Column("Rated Input Voltage (V)",                   db.Float)

    # ─── 28‒31 : Battery specs  ───────────────────────────────────────────────
    nominal_rating_kwh     = db.Column("Nominal Rating (kWh)",   db.Float)
    usable_rating_kwh      = db.Column("Usable Rating (kWh)",    db.Float)
    nominal_voltage_v      = db.Column("Nominal Voltage (V)",    db.Float)
    nominal_amperage_a     = db.Column("Nominal Amperage (A)",   db.Float)

    # ─── ALIASES : For Panel, Inverter and Battery  ───────────────────────────
    power_w = synonym("power_rating_w")
    rating_kva = synonym("power_rating_kva")
    capacity_kwh = synonym("usable_rating_kwh")
    brand = synonym("brand_name")
    model = synonym("description") 

    # ─── 32‒40 : Protection gear  ─────────────────────────────────────────────
    poles                                = db.Column("Poles",                                db.Integer)
    interrupting_capacity_ka             = db.Column("Interrupting Capacity (kA)",           db.Float)
    min_current_rating_a                 = db.Column("Min Current Rating (A)",               db.Float)
    max_current_rating_a                 = db.Column("Max Current Rating (A)",               db.Float)
    voltage_rating_v                     = db.Column("Voltage Rating (V)",                   db.Float)
    rated_voltage_v                      = db.Column("Rated Voltage (V)",                    db.Float)
    nominal_current_a                    = db.Column("Nominal Current (A)",                  db.Float)
    number_of_poles                      = db.Column("Number of Poles",                      db.Integer)
    mounting_type                        = db.Column("Mounting Type",                        db.String(80))

    # ─── 41‒56 : Cable / conductor parameters  ────────────────────────────────
    cable_type                           = db.Column("Cable Type",                           db.String(80))
    cable_size_mm2                       = db.Column("Cable Size (mm2)",                     db.Float)
    cores_ac_cable                       = db.Column("Cores (AC Cable)",                     db.Integer)
    ampacity_at_30c                      = db.Column("Ampacity at 30C",                      db.Float)
    current_rating_ground_a              = db.Column("Current Rating (Ground) [A]",          db.Float)
    current_rating_air_a                 = db.Column("Current Rating (Air) [A]",             db.Float)
    current_rating_duct_a                = db.Column("Current Rating (Duct) [A]",            db.Float)
    impedance_ohm_per_km                 = db.Column("Impedance (Ohm/km)",                   db.Float)
    volt_drop_3ph_mv_per_a_m             = db.Column("3 Phase Volt Drop (mV/A/m)",           db.Float)
    volt_drop_1ph_mv_per_a_m             = db.Column("1 Phase Volt Drop (mV/A/m)",           db.Float)
    d1                                   = db.Column("D1",                                   db.Float)
    d                                    = db.Column("d",                                    db.Float)
    d2                                   = db.Column("D2",                                   db.Float)
    mass_kg_per_km                       = db.Column("Mass (kg/km)",                         db.Float)
    insulation_sheath                    = db.Column("Insulation/Sheath",                    db.String(80))
    armour                               = db.Column("Armour",                               db.String(80))

    # ─── 57‒68 : Voltage ratings  ─────────────────────────────────────────────
    work_v_phase_to_earth_ac             = db.Column("Working voltage (phase to earth) - AC Cable", db.Float)
    work_v_phase_to_phase_ac             = db.Column("Working voltage (phase to phase) - AC Cable", db.Float)
    core                                 = db.Column("Core",                                 db.String(40))
    cross_section_mm2                    = db.Column("Cross Section (mm2)",                  db.Float)
    current_rating_a                     = db.Column("Current Rating (A)",                   db.Float)
    voltage_drop_v_per_a_km              = db.Column("Voltage Drop (V/A/km)",                db.Float)
    max_outer_diam_mm                    = db.Column("Max Outer Diam (mm)",                  db.Float)
    weight_kg_per_km                     = db.Column("Weight (kg/km)",                       db.Float)
    resistance_ohm_per_km                = db.Column("Resistance (ohm/km)",                    db.Float)
    work_v_phase_to_earth_h07            = db.Column("Working voltage (phase to earth) - H07RN-F", db.Float)
    work_v_phase_to_phase_h07            = db.Column("Working voltage (phase to phase) - H07RN-F", db.Float)
    copper_cross_section_mm2             = db.Column("Copper Cross Section (mm2)",           db.Float)

    # ─── 69‒78 : Organisers & mounting hardware  ──────────────────────────────
    organiser_series       = db.Column("Organiser Series",            db.String(80))
    organiser_length_m     = db.Column("Organiser Length (m)",        db.Float)
    organiser_width_mm     = db.Column("Organiser Width (mm)",        db.Float)
    organiser_height_mm    = db.Column("Organiser Height (mm)",       db.Float)
    organiser_colour       = db.Column("Organiser Colour",            db.String(40))
    material_duty          = db.Column("Material/Duty",               db.String(80))
    mount_context          = db.Column("Mount Context",               db.String(80))
    roof_interface         = db.Column("Roof Interface",              db.String(80))
    mount_type             = db.Column("Mount Type",                  db.String(80))
    tilt_angle_deg         = db.Column("Tilt Angle (deg)",            db.Float)

    # ─── 79‒88 : Structural / enclosure  ──────────────────────────────────────
    has_base_rails         = db.Column("Has Base Rails",              db.Boolean)
    ballasted_mount        = db.Column("Ballasted Mount",             db.Boolean)
    switch_min_current_rating = db.Column("Switch Min Current Rating", db.Float)
    switch_max_current_rating = db.Column("Switch Mx Current Rating",  db.Float)
    switchover_poles       = db.Column("Switchover Poles",           db.Integer)
    voltage                = db.Column("Voltage",                    db.Float)
    enclosure_width_mm     = db.Column("Enclosure Width (mm)",       db.Float)
    enclosure_height_mm    = db.Column("Enclosure Height (mm)",      db.Float)
    enclosure_depth_mm     = db.Column("Enclosure Depth (mm)",       db.Float)
    ip_rating              = db.Column("IP Rating",                  db.String(20))
    door_type              = db.Column("Door Type",                  db.String(50))

    # ─── 89‒97 : Distribution board (DB) info  ───────────────────────────────
    db_width_mm            = db.Column("DB Width (mm)",              db.Float)
    db_height_mm           = db.Column("DB Height (mm)",             db.Float)
    db_depth_mm            = db.Column("DB Depth (mm)",              db.Float)
    db_mounting_type       = db.Column("DB Mounting Type",           db.String(50))
    db_weatherproof_rating = db.Column("DB Weatherproof Rating",     db.String(50))
    db_modular_size        = db.Column("DB Modular Size",            db.Integer)
    voltage_class          = db.Column("Voltage Class",              db.String(50))
    current_rating         = db.Column("Current Rating",             db.Float)

    # ─── 98‒108 : Electronics & comms  ────────────────────────────────────────
    mppt_communication     = db.Column("MPPT Communication",         db.String(80))
    enclosure              = db.Column("Enclosure",                  db.String(80))
    mppt_application       = db.Column("MPPT Application",           db.String(80))
    mounting               = db.Column("Mounting",                   db.String(80))
    function               = db.Column("Function",                   db.String(80))
    control_communication  = db.Column("Control Communication",      db.String(80))
    model_code_sku         = db.Column("Model Code / SKU",           db.String(120))
    control_application    = db.Column("Control Application",        db.String(80))
    monitoring_function    = db.Column("Monitoring Function",        db.String(80))
    monitoring_communication = db.Column("Monitoring Communication", db.String(80))
    monitoring_application = db.Column("Monitoring Application",     db.String(80))

    # ─── Optional catch-all for anything else  ────────────────────────────────
    properties = db.Column(JSONB, nullable=True)

    # -------------------------------------------------------------------------
    def as_dict(self):
        from sqlalchemy.inspection import inspect
        d = {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
    
        d["brand"] = d.pop("brand_name", None)
        d["model"] = d.pop("description", None)
        d["power_w"] = d.pop("power_rating_w", None)
        d["rating_kva"] = d.pop("power_rating_kva", None)
        d["capacity_kwh"] = d.pop("usable_rating_kwh", None)

        for k in ("brand_name", "description", "power_rating_w", "power_rating_kva", "usable_rating_kwh"):
            d.pop(k, None)

        return d
    
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