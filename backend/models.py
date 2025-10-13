# models.py
from email.policy import default
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import synonym
from flask_bcrypt import Bcrypt
from enum import Enum
from sqlalchemy import Enum as SAEnum
import secrets
from zoneinfo import ZoneInfo

# Tell type checker to ignore common SQLAlchemy patterns
# pyright: reportAttributeAccessIssue=false
# pyright: reportGeneralTypeIssues=false
# pyright: reportOptionalCall=false

db = SQLAlchemy()
bcrypt = Bcrypt()

SA_TZ = ZoneInfo("Africa/Johannesburg")


def sa_year_now() -> int:
    """Use SA business year for human-friendly numbering"""
    return datetime.now(SA_TZ).year


# User roles enum
class UserRole(Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    SALES = "sales"
    DESIGN = "design"
    TEAM_LEADER = "team_leader"
    TECHNICIAN = "technician"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.SALES)
    is_active = db.Column(db.Boolean, default=True)
    is_email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    profile_picture = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    is_bum = db.Column(db.Boolean, nullable=False, default=False)

    # Relationships
    created_by = db.relationship("User", remote_side=[id], foreign_keys=[created_by_id])

    def set_password(self, password):
        """Set password hash"""
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        """Check password against hash"""
        return bcrypt.check_password_hash(self.password_hash, password)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "role": self.role.value if self.role else None,
            "is_active": self.is_active,
            "is_email_verified": self.is_email_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "phone": self.phone,
            "is_bum": self.is_bum,
        }


class RegistrationToken(db.Model):
    __tablename__ = "registration_tokens"

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False)

    role = db.Column(
        SAEnum(
            UserRole, name="userrole", values_callable=lambda e: [m.name for m in e]
        ),
        nullable=False,
        default=UserRole.SALES,
    )

    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    used_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    used_by = db.relationship("User", foreign_keys=[used_by_id])

    @staticmethod
    def generate_token():
        """Generate a secure 8-character token"""
        import string
        import secrets

        alphabet = string.ascii_uppercase + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(8))

    def is_valid(self):
        """Check if token is still valid"""
        return not self.is_used and self.expires_at > datetime.utcnow()

    def use_token(self, user_id):
        """Mark token as used"""
        self.is_used = True
        self.used_by_id = user_id
        self.used_at = datetime.utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "token": self.token,
            "role": self.role.name if self.role else None,
            "created_by": self.created_by.full_name if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_used": self.is_used,
            "used_by": self.used_by.full_name if self.used_by else None,
            "used_at": self.used_at.isoformat() if self.used_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action = db.Column(
        db.String(100), nullable=False
    )  # CREATE, UPDATE, DELETE, LOGIN, etc.
    resource_type = db.Column(
        db.String(50), nullable=False
    )  # project, product, quote, etc.
    resource_id = db.Column(db.Integer, nullable=True)  # ID of the affected resource
    details = db.Column(JSONB, nullable=True)  # Additional details about the action
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    user = db.relationship("User", backref="audit_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "user_email": self.user.email if self.user else None,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(255), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_revoked = db.Column(db.Boolean, default=False)

    # Relationship
    user = db.relationship("User", backref="refresh_tokens")

    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(32)

    def is_valid(self):
        return not self.is_revoked and self.expires_at > datetime.utcnow()

    def revoke(self):
        self.is_revoked = True


class Clients(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(80))
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))
    address = db.Column(db.JSON, nullable=True)
    company = db.Column(db.String(100), nullable=True)
    vat_number = db.Column(db.String(30), nullable=True)

    projects = db.relationship("Projects", backref="client", lazy=True)


class Projects(db.Model):
    __tablename__ = "projects"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    system_type = db.Column(db.String(20))
    panel_kw = db.Column(db.Float)
    num_panels = db.Column(db.Integer, nullable=True)  # Store actual panel count
    inverter_kva = db.Column(JSONB)
    battery_kwh = db.Column(JSONB)
    panel_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=True)
    inverter_ids = db.Column(JSONB)  # NEW COLUMN
    battery_ids = db.Column(JSONB)  # NEW COLUMN
    project_value_excl_vat = db.Column(db.Float, nullable=True)
    tariff_id = db.Column(db.Integer, db.ForeignKey("tariffs.id"), nullable=True)
    custom_flat_rate = db.Column(db.Numeric(10, 4), nullable=True)
    tariff = db.relationship("Tariffs", backref="projects")
    site_contact_person = db.Column(db.String(80), nullable=True)
    site_phone = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    surface_tilt = db.Column(db.Float, default=15.0)
    surface_azimuth = db.Column(db.Float, default=0.0)  # Default to North
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    design_type = db.Column(db.String(20), nullable=False)  # 'detailed', 'quick'
    project_type = db.Column(
        db.String(50), nullable=False
    )  # 'residential', 'commercial'
    use_pvgis = db.Column(
        db.Boolean, nullable=False, default=False
    )  # Whether to use PVGIS for generation profiles
    generation_profile_name = db.Column(
        db.String(100), nullable=True, default="midrand_ew_5"
    )
    from_standard_template = db.Column(db.Boolean, default=False)
    template_id = db.Column(db.Integer, nullable=True)
    template_name = db.Column(db.String(100), nullable=True)
    bom_modified = db.Column(
        db.Boolean, default=False
    )  # Track if user has modified BOM
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    profile_id = db.Column(db.Integer, db.ForeignKey("load_profiles.id"), nullable=True)
    profile_scaler = db.Column(db.Float, nullable=True, default=1.0)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(SA_TZ))
    updated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    updated_by = db.relationship("User", foreign_keys=[updated_by_id])
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    deleted_by = db.relationship("User", foreign_keys=[deleted_by_id])
    is_deleted = db.Column(db.Boolean, default=False)
    generator_config = db.Column(JSONB, nullable=True)

    energy_data = db.relationship(
        "EnergyData", backref="project", lazy=True, cascade="all, delete-orphan"
    )
    quick_design_entry = db.relationship(
        "QuickDesignData",
        backref="project",
        uselist=False,
        lazy=True,
        cascade="all, delete-orphan",
    )
    bom_components = db.relationship(
        "BOMComponent", backref="project", lazy=True, cascade="all, delete-orphan"
    )
    load_profile = db.relationship("LoadProfiles", foreign_keys=[profile_id])


class EnergyData(db.Model):
    __tablename__ = "energy_data"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    timestamp = db.Column(db.DateTime)
    demand_kw = db.Column(db.Float)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    # ─── 1‒11 : General info  ──────────────────────────────────────────────────
    category = db.Column("Category", db.String(50))
    component_type = db.Column("Component Type", db.String(50))
    brand_name = db.Column("Brand Name", db.String(80))
    description = db.Column("Description", db.String(300))
    notes = db.Column("Notes", db.String(300))
    supplier = db.Column("Supplier", db.String(80))
    updated = db.Column("Updated", db.String(30))  # keep string for max flexibility
    unit_cost = db.Column("Unit Cost", db.Float)
    qty = db.Column("QTY", db.Integer)
    margin = db.Column("Margin", db.Float)
    price = db.Column("Price", db.Float)
    # Warranty (years) – newly added to persist warranty information for products
    warranty_y = db.Column("Warranty (y)", db.Integer)
    # Audit fields
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    updated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    updated_by = db.relationship("User", foreign_keys=[updated_by_id])

    # ─── 12‒17 : PV-module electrical  ────────────────────────────────────────
    power_rating_w = db.Column("Power Rating (W)", db.Float)
    isc_a = db.Column("Isc (A)", db.Float)
    max_voc_v = db.Column("Max Voc (V)", db.Float)
    imp_a = db.Column("Imp (A)", db.Float)
    vmp = db.Column("Vmp", db.Float)
    number_of_phases = db.Column("Number Of Phases", db.Integer)

    # ─── 18‒27 : Inverter / charger limits  ───────────────────────────────────
    power_rating_kva = db.Column("Power Rating (kVA)", db.Float)
    number_of_inputs = db.Column("Number of Inputs", db.Integer)
    max_input_current_per_input_a = db.Column(
        "Max Input Current per Input (A)", db.Float
    )
    number_of_mppt = db.Column("Number of MPPT", db.Integer)
    max_input_current_per_mppt_a = db.Column("Max Input Current per MPPT (A)", db.Float)
    max_isc_per_mppt_a = db.Column("Max Isc per MPPT (A)", db.Float)
    max_dc_input_voltage_per_mppt_v = db.Column(
        "Max DC Input Voltage per MPPT (V)", db.Float
    )
    min_operating_voltage_range_v = db.Column(
        "Min Operating Voltage Range (V)", db.Float
    )
    max_operating_voltage_range_v = db.Column(
        "Max Operating Voltage Range (V)", db.Float
    )
    rated_input_voltage_v = db.Column("Rated Input Voltage (V)", db.Float)

    # ─── 28‒31 : Battery specs  ───────────────────────────────────────────────
    nominal_rating_kwh = db.Column("Nominal Rating (kWh)", db.Float)
    usable_rating_kwh = db.Column("Usable Rating (kWh)", db.Float)
    nominal_voltage_v = db.Column("Nominal Voltage (V)", db.Float)
    nominal_amperage_a = db.Column("Nominal Amperage (A)", db.Float)

    # ─── ALIASES : For Panel, Inverter and Battery  ───────────────────────────
    power_w = synonym("power_rating_w")
    rating_kva = synonym("power_rating_kva")
    capacity_kwh = synonym("usable_rating_kwh")
    brand = synonym("brand_name")
    model = synonym("description")

    # ─── 32‒40 : Protection gear  ─────────────────────────────────────────────
    poles = db.Column("Poles", db.Integer)
    interrupting_capacity_ka = db.Column("Interrupting Capacity (kA)", db.Float)
    min_current_rating_a = db.Column("Min Current Rating (A)", db.Float)
    max_current_rating_a = db.Column("Max Current Rating (A)", db.Float)
    voltage_rating_v = db.Column("Voltage Rating (V)", db.Float)
    rated_voltage_v = db.Column("Rated Voltage (V)", db.Float)
    nominal_current_a = db.Column("Nominal Current (A)", db.Float)
    number_of_poles = db.Column("Number of Poles", db.Integer)
    mounting_type = db.Column("Mounting Type", db.String(80))

    # ─── 41‒56 : Cable / conductor parameters  ────────────────────────────────
    cable_type = db.Column("Cable Type", db.String(80))
    cable_size_mm2 = db.Column("Cable Size (mm2)", db.Float)
    cores_ac_cable = db.Column("Cores (AC Cable)", db.Integer)
    ampacity_at_30c = db.Column("Ampacity at 30C", db.Float)
    current_rating_ground_a = db.Column("Current Rating (Ground) [A]", db.Float)
    current_rating_air_a = db.Column("Current Rating (Air) [A]", db.Float)
    current_rating_duct_a = db.Column("Current Rating (Duct) [A]", db.Float)
    impedance_ohm_per_km = db.Column("Impedance (Ohm/km)", db.Float)
    volt_drop_3ph_mv_per_a_m = db.Column("3 Phase Volt Drop (mV/A/m)", db.Float)
    volt_drop_1ph_mv_per_a_m = db.Column("1 Phase Volt Drop (mV/A/m)", db.Float)
    d1 = db.Column("D1", db.Float)
    d = db.Column("d", db.Float)
    d2 = db.Column("D2", db.Float)
    mass_kg_per_km = db.Column("Mass (kg/km)", db.Float)
    insulation_sheath = db.Column("Insulation/Sheath", db.String(80))
    armour = db.Column("Armour", db.String(80))

    # ─── 57‒68 : Voltage ratings  ─────────────────────────────────────────────
    work_v_phase_to_earth_ac = db.Column(
        "Working voltage (phase to earth) - AC Cable", db.Float
    )
    work_v_phase_to_phase_ac = db.Column(
        "Working voltage (phase to phase) - AC Cable", db.Float
    )
    core = db.Column("Core", db.String(40))
    cross_section_mm2 = db.Column("Cross Section (mm2)", db.Float)
    current_rating_a = db.Column("Current Rating (A)", db.Float)
    voltage_drop_v_per_a_km = db.Column("Voltage Drop (V/A/km)", db.Float)
    max_outer_diam_mm = db.Column("Max Outer Diam (mm)", db.Float)
    weight_kg_per_km = db.Column("Weight (kg/km)", db.Float)
    resistance_ohm_per_km = db.Column("Resistance (ohm/km)", db.Float)
    work_v_phase_to_earth_h07 = db.Column(
        "Working voltage (phase to earth) - H07RN-F", db.Float
    )
    work_v_phase_to_phase_h07 = db.Column(
        "Working voltage (phase to phase) - H07RN-F", db.Float
    )
    copper_cross_section_mm2 = db.Column("Copper Cross Section (mm2)", db.Float)

    # ─── 69‒78 : Organisers & mounting hardware  ──────────────────────────────
    organiser_series = db.Column("Organiser Series", db.String(80))
    organiser_length_m = db.Column("Organiser Length (m)", db.Float)
    organiser_width_mm = db.Column("Organiser Width (mm)", db.Float)
    organiser_height_mm = db.Column("Organiser Height (mm)", db.Float)
    organiser_colour = db.Column("Organiser Colour", db.String(40))
    material_duty = db.Column("Material/Duty", db.String(80))
    mount_context = db.Column("Mount Context", db.String(80))
    roof_interface = db.Column("Roof Interface", db.String(80))
    mount_type = db.Column("Mount Type", db.String(80))
    tilt_angle_deg = db.Column("Tilt Angle (deg)", db.Float)

    # ─── 79‒88 : Structural / enclosure  ──────────────────────────────────────
    has_base_rails = db.Column("Has Base Rails", db.Boolean)
    ballasted_mount = db.Column("Ballasted Mount", db.Boolean)
    switch_min_current_rating = db.Column("Switch Min Current Rating", db.Float)
    switch_max_current_rating = db.Column("Switch Mx Current Rating", db.Float)
    switchover_poles = db.Column("Switchover Poles", db.Integer)
    voltage = db.Column("Voltage", db.Float)
    enclosure_width_mm = db.Column("Enclosure Width (mm)", db.Float)
    enclosure_height_mm = db.Column("Enclosure Height (mm)", db.Float)
    enclosure_depth_mm = db.Column("Enclosure Depth (mm)", db.Float)
    ip_rating = db.Column("IP Rating", db.String(20))
    door_type = db.Column("Door Type", db.String(50))

    # ─── 89‒97 : Distribution board (DB) info  ───────────────────────────────
    db_width_mm = db.Column("DB Width (mm)", db.Float)
    db_height_mm = db.Column("DB Height (mm)", db.Float)
    db_depth_mm = db.Column("DB Depth (mm)", db.Float)
    db_mounting_type = db.Column("DB Mounting Type", db.String(50))
    db_weatherproof_rating = db.Column("DB Weatherproof Rating", db.String(50))
    db_modular_size = db.Column("DB Modular Size", db.Integer)
    voltage_class = db.Column("Voltage Class", db.String(50))
    current_rating = db.Column("Current Rating", db.Float)

    # ─── 98‒108 : Electronics & comms  ────────────────────────────────────────
    mppt_communication = db.Column("MPPT Communication", db.String(80))
    enclosure = db.Column("Enclosure", db.String(80))
    mppt_application = db.Column("MPPT Application", db.String(80))
    mounting = db.Column("Mounting", db.String(80))
    function = db.Column("Function", db.String(80))
    control_communication = db.Column("Control Communication", db.String(80))
    model_code_sku = db.Column("Model Code / SKU", db.String(120))
    control_application = db.Column("Control Application", db.String(80))
    monitoring_function = db.Column("Monitoring Function", db.String(80))
    monitoring_communication = db.Column("Monitoring Communication", db.String(80))
    monitoring_application = db.Column("Monitoring Application", db.String(80))

    # ─── Soft delete fields  ──────────────────────────────────────────────────
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    deleted_by = db.relationship("User", foreign_keys=[deleted_by_id])

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

        for k in (
            "brand_name",
            "description",
            "power_rating_w",
            "power_rating_kva",
            "usable_rating_kwh",
        ):
            d.pop(k, None)

        # Append audit info in a consistent api shape
        d["updated_at"] = (
            self.updated_at.isoformat() if getattr(self, "updated_at", None) else None
        )
        d["updated_by"] = (
            self.updated_by.full_name if getattr(self, "updated_by", None) else None
        )
        if self.is_deleted:
            d["deleted_at"] = self.deleted_at.isoformat() if self.deleted_at else None
            d["deleted_by"] = self.deleted_by.full_name if self.deleted_by else None

        return d


class ComponentRule(db.Model):
    __tablename__ = "component_rules"
    id = db.Column(db.Integer, primary_key=True)
    subject_product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False
    )
    rule_type = db.Column(db.String(50), nullable=False)  # e.g. 'REQUIRES', 'EXCLUDES'
    object_category = db.Column(
        db.String(50), nullable=False
    )  # e.g. 'panel', 'inverter', 'battery', 'fuse'
    constraints = db.Column(
        JSONB, nullable=True
    )  # {"voltage": 48, "min_amp_rating": 25}
    quantity_formula = db.Column(
        db.String(255), nullable=True
    )  # e.g., "num_panels * 4"
    description = db.Column(db.String(255))
    subject_product = db.relationship("Product", backref="rules")


class OptimizationRun(db.Model):
    __tablename__ = "optimization_runs"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    system_type = db.Column(db.String(20))
    inputs_json = db.Column(db.JSON)
    best_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# NEW: A temporary model for testing the import process
class ProductTest(db.Model):
    __tablename__ = "products_test"  # Points to a new table
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), index=True)
    brand = db.Column(db.String(80))
    model = db.Column(db.String(120))
    power_w = db.Column(db.Float, nullable=True)
    rating_kva = db.Column(db.Float, nullable=True)
    capacity_kwh = db.Column(db.Float, nullable=True)
    cost = db.Column(db.Float, nullable=True)
    price = db.Column(db.Float, nullable=True)
    warranty_y = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.String(250))
    properties = db.Column(JSONB, nullable=True)


class LoadProfiles(db.Model):
    __tablename__ = "load_profiles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    profile_type = db.Column(
        db.String(50), nullable=False
    )  # 'residential', 'commercial'
    annual_kwh = db.Column(
        db.Float, nullable=True
    )  # Annual energy consumption in kWh (normalized to 12 kWh)
    monthly_avg_kwh_original = db.Column(
        db.Float, nullable=True
    )  # Monthly average consumption before normalization
    max_peak_demand_kw = db.Column(
        db.Float, nullable=True
    )  # Maximum peak demand in kW before normalization
    profile_data = db.Column(
        JSONB, nullable=False
    )  # JSONB to store the load profile data

    def __repr__(self):
        return f"<LoadProfile {self.name}>"


class QuickDesignData(db.Model):
    __tablename__ = "quick_design_data"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)

    # Fields from BasicInfoForm
    consumption = db.Column(db.Float, nullable=True)  # Monthly consumption in kWh
    tariff = db.Column(db.Float, nullable=True)  # Tariff in R/kWh
    consumer_type = db.Column(
        db.String(50), nullable=True
    )  # 'residential', 'commercial'
    transformer_size = db.Column(db.Float, nullable=True)  # Transformer size in kVA

    # Field for ProfileSelection
    selected_profile_id = db.Column(
        db.Integer, db.ForeignKey("load_profiles.id"), nullable=True
    )

    profile_scaler = db.Column(
        db.Float, nullable=True, default=1.0
    )  # Scaler for the load profile data

    # Field for SystemSelection (placeholder)
    selected_system_config_json = db.Column(
        JSONB, nullable=True
    )  # JSON to store selected system configuration

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    load_profile = db.relationship("LoadProfiles")

    def __repr__(self):
        return f"<QuickDesignData for Project {self.project_id}>"


# Die stoor die naam en tipe "kit", bv (Standard 50 kW Grid-Tied)
class SystemTemplate(db.Model):
    __tablename__ = "system_templates"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.String(250))
    system_type = db.Column(db.String(50))  # 'Grid-Tied', 'Hybrid', 'Off-Grid'
    extras_cost = db.Column(
        db.Float, nullable=True, default=0
    )  # Extra cost for this template

    # Relationship to the components in the template
    components = db.relationship(
        "SystemTemplateComponent",
        backref="template",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<SystemTemplate {self.name}>"


# Die is die crucial "linking" table tussen 'n SystemTemplate en die Products wat dit kort
class SystemTemplateComponent(db.Model):
    __tablename__ = "system_template_components"
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(
        db.Integer, db.ForeignKey("system_templates.id"), nullable=False
    )
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    # Relationship to the actual product
    product = db.relationship("Product")

    def __repr__(self):
        return f"<{self.quantity}x of ProductID {self.product_id} for TemplateID {self.template_id}>"


class Tariffs(db.Model):
    __tablename__ = "tariffs"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    power_user_type = db.Column(db.String(50))  # 'SPU' or 'LPU'
    tariff_category = db.Column(
        db.String(100), nullable=True
    )  # e.g., 'Local Authority'
    transmission_zone = db.Column(db.String(100), nullable=True)
    supply_voltage = db.Column(db.String(100), nullable=True)
    code = db.Column(db.String(255), nullable=True)
    matrix_code = db.Column(db.String(50), nullable=True)
    structure = db.Column(
        db.String(50), nullable=False
    )  # 'flat_rate', 'time_of_use', 'block'
    supplier = db.Column(db.String(100), nullable=True, default="Eskom")
    year = db.Column(db.String(20), nullable=True)

    # This creates a one-to-many relationship. One tariff plan can have many rate components.
    rates = db.relationship(
        "TariffRates", backref="tariff", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Tariff {self.id}: {self.name}>"


class TariffRates(db.Model):
    __tablename__ = "tariff_rates"
    id = db.Column(db.Integer, primary_key=True)
    tariff_id = db.Column(db.Integer, db.ForeignKey("tariffs.id"), nullable=False)

    charge_name = db.Column(
        db.String(150), nullable=False
    )  # e.g., "Service and administration charge"
    charge_category = db.Column(
        db.String(50), nullable=False, index=True
    )  # Our internal logic group: 'energy', 'fixed', 'demand'

    season = db.Column(db.String(50), default="all")  # 'high', 'low', 'all'
    time_of_use = db.Column(
        db.String(50), default="all"
    )  # 'peak', 'standard', 'off_peak', 'all'

    rate_unit = db.Column(
        db.String(50), nullable=False
    )  # 'c/kWh', 'R/POD/day', 'R/kVA/month'
    rate_value = db.Column(
        db.Numeric(12, 6), nullable=False
    )  # Using Numeric for precision with monetary values

    block_threshold_kwh = db.Column(
        db.Numeric(10, 2), nullable=True
    )  # The upper limit for tiered rates

    def __repr__(self):
        return f"<TariffRate for TariffID {self.tariff_id}: {self.charge_name}>"


class BOMComponent(db.Model):
    __tablename__ = "bom_components"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    # pricing snapshot fields
    override_margin = db.Column(
        db.Float, nullable=True
    )  # decimal fraction, e.g. 0.25 for 25%
    unit_cost_at_time = db.Column(
        db.Float, nullable=True
    )  # snapshot of cost when locking
    price_at_time = db.Column(
        db.Float, nullable=True
    )  # snapshot of sell price when locking
    priced_at = db.Column(db.DateTime, nullable=True)  # when we locked the price

    quote_status = db.Column(db.String(20), default="draft")
    extras_cost = db.Column(db.Float, nullable=True, default=0)

    # optional lifecycle timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(SA_TZ))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(SA_TZ),
        onupdate=lambda: datetime.now(SA_TZ),
    )

    quote_number = db.Column(db.String(50), nullable=True)
    quote_version = db.Column(db.Integer, default=1)

    # Relationships
    product = db.relationship("Product")

    def __repr__(self):
        return f"<BOMComponent {self.id} for Project {self.project_id}>"


# Kinds (so Reports can reuse the exact same pipeline later)
class DocumentKind(Enum):
    QUOTE = "quote"
    REPORT = "report"
    INVOICE = "invoice"


# Envelope-level status (generic; quotes mainly use these)
class DocumentStatus(Enum):
    OPEN = "open"  # Draft, being edited
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CLOSED = "closed"


# Version-level lifecyle (immutable snapshots)
class VersionStatus(Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    job_card_id = db.Column(db.Integer, db.ForeignKey("job_cards.id"), nullable=True)
    kind = db.Column(db.Enum(DocumentKind), nullable=False)
    number = db.Column(db.String(64), unique=True, index=True)
    current_version_no = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(
        db.Enum(DocumentStatus), nullable=False, default=DocumentStatus.OPEN
    )

    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    client_snapshot_json = db.Column(
        JSONB, nullable=True
    )  # Snapshot of client details at time of document creation
    tags = db.Column(
        db.String(255), nullable=True
    )  # Comma-separated tags for categorization

    # relationships
    project = db.relationship(
        "Projects", backref=db.backref("documents", lazy="dynamic")
    )
    created_by = db.relationship("User", foreign_keys=[created_by_id])

    versions = db.relationship(
        "DocumentVersion",
        backref="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.version_no",
        lazy="dynamic",
    )

    def mark_sent(self, user_id=None):
        """Mark quote as sent, lock current version, set valid_until=30 days"""
        if self.status != DocumentStatus.OPEN:
            raise ValueError(f"Cannot send quote with status {self.status.value}")

        current_version = self.versions.filter_by(
            version_no=self.current_version_no
        ).first()
        if not current_version:
            raise ValueError("No current version found")

        if current_version.status != VersionStatus.DRAFT:
            raise ValueError(
                f"Cannot send version with status {current_version.status.value}"
            )

        # Lock the version
        current_version.status = VersionStatus.SENT
        current_version.valid_until = datetime.utcnow() + timedelta(days=30)
        current_version.price_locked_at = datetime.utcnow()

        # Update document status
        self.status = DocumentStatus.OPEN  # Keep as OPEN when sent

        # Add event
        event = DocumentEvent(
            document_version_id=current_version.id,
            event="sent",
            meta_json={"valid_until": current_version.valid_until.isoformat()},
            created_by_id=user_id,
        )
        db.session.add(event)

    def mark_accepted(self, user_id=None):
        """Mark quote as accepted"""
        current_version = self.versions.filter_by(
            version_no=self.current_version_no
        ).first()
        if not current_version or current_version.status != VersionStatus.SENT:
            raise ValueError("Can only accept sent quotes")

        current_version.status = VersionStatus.ACCEPTED
        self.status = DocumentStatus.ACCEPTED

        # Add event
        event = DocumentEvent(
            document_version_id=current_version.id,
            event="accepted",
            meta_json={},
            created_by_id=user_id,
        )
        db.session.add(event)

    def mark_declined(self, user_id=None):
        """Mark quote as declined"""
        current_version = self.versions.filter_by(
            version_no=self.current_version_no
        ).first()
        if not current_version or current_version.status != VersionStatus.SENT:
            raise ValueError("Can only decline sent quotes")

        current_version.status = VersionStatus.DECLINED
        self.status = DocumentStatus.DECLINED

        # Add event
        event = DocumentEvent(
            document_version_id=current_version.id,
            event="declined",
            meta_json={},
            created_by_id=user_id,
        )
        db.session.add(event)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "job_card_id": self.job_card_id,
            "kind": self.kind.value,
            "number": self.number,
            "current_version_no": self.current_version_no,
            "status": self.status.value,
            "created_by_id": self.created_by_id,
            "created_at": self.created_at.isoformat() + "Z",
            "client_snapshot_json": self.client_snapshot_json,
            "tags": self.tags,
        }


class DocumentVersion(db.Model):
    __tablename__ = "document_versions"
    __table_args__ = (
        db.UniqueConstraint("document_id", "version_no", name="uq_document_version"),
    )

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=False)
    version_no = db.Column(db.Integer, nullable=False)

    status = db.Column(
        db.Enum(VersionStatus), nullable=False, default=VersionStatus.DRAFT
    )
    valid_until = db.Column(db.DateTime, nullable=True)  # set on SENT
    price_locked_at = db.Column(db.DateTime, nullable=True)  # set on SENT/ACCEPTED

    # immutable payloads to fully reproduce the doc
    payload_json = db.Column(
        JSONB, nullable=False
    )  # line items, extras, VAT %, discounts, terms, layout flags
    totals_json = db.Column(
        JSONB, nullable=False
    )  # subtotal, vat, total, deposit breakdown
    pdf_path = db.Column(db.String(512), nullable=True)
    html_hash = db.Column(db.String(64), nullable=True)

    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    created_by = db.relationship("User", foreign_keys=[created_by_id])

    line_items = db.relationship(
        "DocumentLineItem",
        backref="version",
        cascade="all, delete-orphan",
        lazy=True,
    )
    events = db.relationship(
        "DocumentEvent",
        backref="version",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="desc(DocumentEvent.created_at)",
    )

    def to_dict(self, include_lines=False):
        d = {
            "id": self.id,
            "document_id": self.document_id,
            "version_no": self.version_no,
            "status": self.status.value,
            "valid_until": (
                self.valid_until.isoformat() + "Z" if self.valid_until else None
            ),
            "price_locked_at": (
                self.price_locked_at.isoformat() + "Z" if self.price_locked_at else None
            ),
            "payload_json": self.payload_json,
            "totals_json": self.totals_json,
            "pdf_path": self.pdf_path,
            "html_hash": self.html_hash,
            "created_by_id": self.created_by_id,
            "created_at": self.created_at.isoformat() + "Z",
        }
        if include_lines:
            d["line_items"] = [li.to_dict() for li in self.line_items]
        return d


class DocumentLineItem(db.Model):
    __tablename__ = "document_line_items"

    id = db.Column(db.Integer, primary_key=True)
    document_version_id = db.Column(
        db.Integer, db.ForeignKey("document_versions.id"), nullable=False
    )

    # optional link to catalog; snapshot always drives rendering
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=True)
    product_snapshot_json = db.Column(JSONB, nullable=False)

    qty = db.Column(db.Float, nullable=False, default=1.0)

    # locked commercial values
    unit_cost_locked = db.Column(db.Float, nullable=False)
    unit_price_locked = db.Column(db.Float, nullable=False)
    margin_locked = db.Column(db.Float, nullable=True)
    line_total_locked = db.Column(db.Float, nullable=False)

    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "document_version_id": self.document_version_id,
            "product_id": self.product_id,
            "product_snapshot_json": self.product_snapshot_json,
            "qty": self.qty,
            "unit_cost_locked": self.unit_cost_locked,
            "unit_price_locked": self.unit_price_locked,
            "margin_locked": self.margin_locked,
            "line_total_locked": self.line_total_locked,
        }


class DocumentEvent(db.Model):
    __tablename__ = "document_events"

    id = db.Column(db.Integer, primary_key=True)
    document_version_id = db.Column(
        db.Integer, db.ForeignKey("document_versions.id"), nullable=False
    )
    event = db.Column(
        db.String(32), nullable=False
    )  # created|sent|viewed|accepted|declined|comment
    meta_json = db.Column(JSONB, nullable=True)

    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    created_by = db.relationship("User", foreign_keys=[created_by_id])

    def to_dict(self):
        return {
            "id": self.id,
            "document_version_id": self.document_version_id,
            "event": self.event,
            "meta_json": self.meta_json,
            "created_by_id": self.created_by_id,
            "created_at": self.created_at.isoformat() + "Z",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Job Cards models
# ─────────────────────────────────────────────────────────────────────────────


# Review status for BUM decisions on Job Cards
class JobCardReviewStatus(Enum):
    OPEN = "open"
    SUBMITTED = "submitted"
    INVOICED = "invoiced"
    COMPLETED = "completed"


class TechnicianProfile(db.Model):
    __tablename__ = "technician_profiles"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    hourly_rate = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    active = db.Column(db.Boolean, default=True)

    user = db.relationship(
        "User", backref=db.backref("technician_profile", uselist=False)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.user.full_name if self.user else None,
            "hourly_rate": float(self.hourly_rate or 0),
            "active": self.active,
        }


class JobCategory(db.Model):
    __tablename__ = "job_categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "active": self.active}


class Vehicle(db.Model):
    __tablename__ = "vehicles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)  # e.g. "Hilux 2.4D"
    registration = db.Column(db.String(40), unique=True)  # e.g. "CA 123-456"
    rate_per_km = db.Column(db.Numeric(10, 2), nullable=True)  # optional, for costing
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "registration": self.registration,
            "rate_per_km": float(self.rate_per_km or 0),
            "active": self.active,
        }


class JobCard(db.Model):
    __tablename__ = "job_cards"
    __table_args__ = (
        db.Index('ix_job_cards_category_id', 'category_id'),
        db.Index('ix_job_cards_client_id', 'client_id'),
        db.Index('ix_job_cards_owner_id', 'owner_id'),
        db.Index('ix_job_cards_project_id', 'project_id'),
        db.Index('ix_job_cards_status', 'status'),
        db.Index('ix_job_cards_vehicle_id', 'vehicle_id'),
    )

    id = db.Column(db.Integer, primary_key=True)

    # Assignment
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id = db.Column(
        db.Integer, db.ForeignKey("job_categories.id"), nullable=True
    )
    bum_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    # Basics
    title = db.Column(db.String(120), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_quoted = db.Column(db.Boolean, default=False)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)

    # Timing
    start_at = db.Column(db.DateTime, nullable=True)  # call out start
    complete_at = db.Column(db.DateTime, nullable=True)  # completion

    # Client snapshots (freeze values at creation time)
    client_name_snapshot = db.Column(db.String(120))
    client_email_snapshot = db.Column(db.String(120))
    client_address_snapshot = db.Column(db.String(255))

    # Labour (summary-level)
    labourers_count = db.Column(db.Integer, default=0)
    labour_hours = db.Column(db.Numeric(10, 2), nullable=True)
    labour_rate_per_hour = db.Column(db.Numeric(10, 2), nullable=True)

    # Materials
    materials_used = db.Column(db.Boolean, default=False)

    # Travel
    did_travel = db.Column(db.Boolean, default=False)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=True)
    travel_distance_km = db.Column(db.Numeric(10, 2), nullable=True)

    # Compliance
    coc_required = db.Column(db.Boolean, default=False)

    # Status / meta
    # Suggested lifecycle strings: 'draft','scheduled','in_progress','paused','completed','cancelled','invoiced'
    status = db.Column(db.String(20), default="open")
    metadata_json = db.Column(JSONB, nullable=True)

    # BUM review state
    bum_status = db.Column(
        SAEnum(
            JobCardReviewStatus,
            name="jobcardreviewstatus",
            values_callable=lambda e: [m.value for m in e],
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=JobCardReviewStatus.OPEN,
    )
    bum_comment = db.Column(db.Text, nullable=True)
    bum_reviewed_at = db.Column(db.DateTime, nullable=True)
    bum_reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    # Audit
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(SA_TZ),
        onupdate=lambda: datetime.now(SA_TZ),
    )

    # Relationships
    client = db.relationship("Clients", backref=db.backref("job_cards", lazy=True))
    owner = db.relationship("User", foreign_keys=[owner_id])
    category = db.relationship("JobCategory")
    vehicle = db.relationship("Vehicle")
    bum = db.relationship("User", foreign_keys=[bum_id])
    bum_reviewed_by = db.relationship("User", foreign_keys=[bum_reviewed_by_id])

    time_entries = db.relationship(
        "JobCardTimeEntry", backref="job_card", cascade="all, delete-orphan", lazy=True
    )
    materials = db.relationship(
        "JobCardMaterial", backref="job_card", cascade="all, delete-orphan", lazy=True
    )
    attachments = db.relationship(
        "JobCardAttachment", backref="job_card", cascade="all, delete-orphan", lazy=True
    )

    def to_dict(self, with_lines: bool = True):
        base = {
            "id": self.id,
            "client_id": self.client_id,
            "owner_id": self.owner_id,
            "owner_name": (
                f"{self.owner.first_name} {self.owner.last_name}"
                if self.owner
                else None
            ),
            "bum_id": self.bum_id,
            "bum_name": (
                f"{self.bum.first_name} {self.bum.last_name}" if self.bum else None
            ),
            "category_id": self.category_id,
            "title": self.title,
            "description": self.description,
            "is_quoted": self.is_quoted,
            "project_id": self.project_id,
            "start_at": self.start_at.isoformat() if self.start_at else None,
            "complete_at": self.complete_at.isoformat() if self.complete_at else None,
            "client_name": self.client_name_snapshot,
            "client_email": self.client_email_snapshot,
            "client_address": self.client_address_snapshot,
            "labourers_count": self.labourers_count or 0,
            "labour_hours": float(self.labour_hours or 0),
            "labour_rate_per_hour": float(self.labour_rate_per_hour or 0),
            "materials_used": bool(self.materials_used),
            "did_travel": bool(self.did_travel),
            "vehicle_id": self.vehicle_id,
            "vehicle_name": self.vehicle.name if self.vehicle else None,
            "vehicle_registration": self.vehicle.registration if self.vehicle else None,
            "rate_per_km": self.vehicle.rate_per_km if self.vehicle else None,
            "travel_distance_km": float(self.travel_distance_km or 0),
            "coc_required": bool(self.coc_required),
            "status": self.status,
            "bum_status": (
                self.bum_status.value
                if self.bum_status
                else JobCardReviewStatus.OPEN.value
            ),
            "bum_comment": self.bum_comment,
            "bum_reviewed_at": (
                self.bum_reviewed_at.isoformat() if self.bum_reviewed_at else None
            ),
            "bum_reviewed_by_id": self.bum_reviewed_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if with_lines:
            base["time_entries"] = [t.to_dict() for t in self.time_entries]
            base["materials"] = [m.to_dict() for m in self.materials]
            base["attachments"] = [a.to_dict() for a in self.attachments]
        return base


class JobCardTimeEntry(db.Model):
    __tablename__ = "job_card_time_entries"
    __table_args__ = (
        db.Index('ix_time_entries_job_card_id', 'job_card_id'),
        db.Index('ix_time_entries_user_id', 'user_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    job_card_id = db.Column(db.Integer, db.ForeignKey("job_cards.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    hours = db.Column(db.Numeric(6, 2), nullable=False, default=0)
    hourly_rate_at_time = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    user = db.relationship("User")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "job_card_id": self.job_card_id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
            "hours": float(self.hours or 0),
            "hourly_rate_at_time": float(self.hourly_rate_at_time or 0),
            "amount": float((self.hours or 0) * (self.hourly_rate_at_time or 0)),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobCardMaterial(db.Model):
    __tablename__ = "job_card_materials"
    __table_args__ = (
        db.Index('ix_materials_job_card_id', 'job_card_id'),
        db.Index('ix_materials_product_id', 'product_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    job_card_id = db.Column(db.Integer, db.ForeignKey("job_cards.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    unit_cost_at_time = db.Column(db.Numeric(12, 2), nullable=True)
    unit_price_at_time = db.Column(db.Numeric(12, 2), nullable=True)
    note = db.Column(db.String(200), nullable=True)

    product = db.relationship("Product")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # Get the related product if available
        product_name = None
        if hasattr(self, "product") and self.product:
            brand = self.product.brand
            model = self.product.model
            if brand:
                product_name = f"{brand} {model}"
            else:
                product_name = model
        return {
            "id": self.id,
            "job_card_id": self.job_card_id,
            "product_id": self.product_id,
            "product_name": product_name,
            "quantity": self.quantity,
            "unit_cost_at_time": float(self.unit_cost_at_time or 0),
            "unit_price_at_time": float(self.unit_price_at_time or 0),
            "line_total": float((self.unit_price_at_time or 0) * (self.quantity or 0)),
            "note": self.note,
        }


class JobCardAttachment(db.Model):
    __tablename__ = "job_card_attachments"
    __table_args__ = (
        db.Index('ix_attachments_job_card_id', 'job_card_id'),
        db.Index('ix_attachments_uploaded_by', 'uploaded_by_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    job_card_id = db.Column(db.Integer, db.ForeignKey("job_cards.id"), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    url = db.Column(db.String(500), nullable=False)  # where frontend can GET it
    content_type = db.Column(db.String(80), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    attachment_type = db.Column(db.String(20), nullable=False, default="site")
    caption = db.Column(db.String(255), nullable=True)

    uploaded_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "job_card_id": self.job_card_id,
            "filename": self.filename,
            "url": self.url,
            "content_type": self.content_type,
            "size_bytes": self.size_bytes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "attachment_type": self.attachment_type,
            "caption": self.caption,
        }


class JobCardMaterialReceipt(db.Model):
    __tablename__ = "job_card_material_receipts"
    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(
        db.Integer, db.ForeignKey("job_card_materials.id"), nullable=False
    )
    attachment_id = db.Column(
        db.Integer, db.ForeignKey("job_card_attachments.id"), nullable=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    material = db.relationship(
        "JobCardMaterial", backref=db.backref("receipts", lazy=True)
    )
    attachment = db.relationship("JobCardAttachment")

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "attachment_id": self.attachment_id,
            "url": self.attachment.url if self.attachment else None,
            "filename": self.attachment.filename if self.attachment else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Invoice(db.Model):
    __tablename__ = "invoices"
    id = db.Column(db.Integer, primary_key=True)

    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)

    # lineage back to the quote snapshot used
    quote_number = db.Column(db.String(50), nullable=True)
    quote_version = db.Column(db.Integer, nullable=True)

    # numbering & lifecycle
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_type = db.Column(db.String(30), nullable=False) # `deposit` or `final`
    status = db.Column(db.String(30), default='draft')

    issue_date = db.Column(db.Date, nullable=False, default=lambda: datetime.now(SA_TZ))
    due_date = db.Column(db.Date, nullable=True)

    # proration for deposit/final
    percent_of_quote = db.Column(db.Float, nullable=True)

    # billing snapshot (so changes to Client later don't alter this doc)
    billing_name = db.Column(db.String(255))
    billing_company = db.Column(db.String(255), nullable=True)
    billing_vat_no = db.Column(db.String(64))
    billing_address = db.Column(db.Text)

    currency = db.Column(db.String(10), nullable=True, default='ZAR')
    vat_rate = db.Column(db.Numeric(5, 2), default=15.00)

    subtotal_excl_vat = db.Column(db.Numeric(12, 2), default=0)
    vat_amount = db.Column(db.Numeric(12, 2), default=0)
    total_incl_vat = db.Column(db.Numeric(12, 2), default=0)

    amount_paid = db.Column(db.Numeric(12, 2), default=0)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(SA_TZ))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(SA_TZ),
        onupdate=lambda: datetime.now(SA_TZ),
    )

    items = db.relationship('InvoiceItem', backref='invoice', cascade="all, delete-orphan")

class InvoiceItem(db.Model):
    __tablename__ = "invoice_items"
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False)

    # snapshot of the line
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=True)  # optional link back
    description = db.Column(db.String(255), nullable=False)
    sku = db.Column(db.String(128), nullable=True)

    quantity = db.Column(db.Float, nullable=False, default=1.0)
    unit = db.Column(db.String(32), nullable=True)

    unit_price_excl_vat = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    line_total_excl_vat = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    vat_rate = db.Column(db.Numeric(5, 2), nullable=False, default=15.00)
    line_vat = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    line_total_incl_vat = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    