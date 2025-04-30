from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import logging
from sqlalchemy.exc import IntegrityError
import psycopg2.errors
import pandas as pd
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.DEBUG)
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:1234@localhost/client_onboarding'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
CORS(app)

# Define the Clients model (cleaned)
class Clients(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    client_name = db.Column(db.String(80))
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))

    # Relationships
    projects = db.relationship('Projects', backref='client', lazy=True)

# Define the EnergyData model
class EnergyData(db.Model):
    __tablename__ = 'energy_data'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    timestamp = db.Column(db.DateTime)
    demand_kw = db.Column(db.Float)

    project = db.relationship('Projects', backref=db.backref('energy_data', lazy=True))

# Define the Projects model (cleaned)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

# Create the tables if not already created
with app.app_context():
    db.create_all()

# API to add a client
@app.route('/add_client', methods=['POST'])
def add_client():
    try:
        data = request.json
        new_client = Clients(
            client_name=data['client_name'],
            email=data['email'],
            phone=data['phone']
        )
        db.session.add(new_client)
        db.session.commit()
        return jsonify({'message': 'Client added successfully!', 'client_id': new_client.id}), 200
    except IntegrityError as e:
        db.session.rollback()
        if isinstance(e.orig, psycopg2.errors.UniqueViolation):
            return jsonify({"error": f"Email {data['email']} already exists"}), 400
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# API to get all clients (simple clean version)
@app.route('/clients', methods=['GET'])
def get_clients():
    try:
        clients = Clients.query.all()
        return jsonify([
            {
                'id': client.id,
                'client_name': client.client_name,
                'email': client.email,
                'phone': client.phone
            }
            for client in clients
        ])
    except Exception as e:
        app.logger.error(f"Error fetching clients: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# Get client by ID
@app.route('/clients/<int:client_id>', methods=['GET'])
def get_client(client_id):
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({"error": "Client not found"}), 404
        return jsonify({
            "id": client.id,
            "client_name": client.client_name,
            "email": client.email,
            "phone": client.phone
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint to update client
@app.route('/clients/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({"error": "Client not found"}), 404

        data = request.json
        client.client_name = data.get('client_name', client.client_name)
        client.email = data.get('email', client.email)
        client.phone = data.get('phone', client.phone)

        db.session.commit()
        return jsonify({"message": "Client updated successfully!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
# Endpoint to delete client
@app.route('/delete_client/<int:client_id>', methods=['DELETE'])
def delete_client(client_id):
    try:
        client = Clients.query.get(client_id)
        if not client:
            return jsonify({"error": "Client not found"}), 404

        db.session.delete(client)
        db.session.commit()
        return jsonify({"message": "Client deleted successfully!"})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting client: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Endpoint to add a project
@app.route('/add_project', methods=['POST'])
def add_project():
    try:
        data = request.json

        new_project = Projects(
            client_id=data['client_id'],
            name=data['name'],
            description=data.get('description'),
            system_type=data.get('system_type'),
            panel_kw=data.get('panel_kw'),
            inverter_kva=data.get('inverter_kva'),
            battery_kwh=data.get('battery_kwh'),
            location=data.get('location'),
            project_value_excl_vat=data.get('project_value_excl_vat'),
            site_contact_person=data.get('site_contact_person'),
            site_phone=data.get('site_phone')
        )
        db.session.add(new_project)
        db.session.commit()

        return jsonify({"message": "Project added successfully!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Endpoint to delete a project
@app.route('/delete_project/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        db.session.delete(project)
        db.session.commit()
        return jsonify({"message": "Project deleted successfully!"})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting project: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/update_project/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = request.json
        for key, value in data.items():
            setattr(project, key, value)
        
        db.session.commit()
        return jsonify({"message": "Project updated successfully!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/projects', methods=['GET'])
def get_projects():
    try:
        projects = Projects.query.all()
        return jsonify([
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'client_name': p.client.client_name,
                'location': p.location,
                'system_type': p.system_type,
                'panel_kw': p.panel_kw,
                'inverter_kva': p.inverter_kva,
                'battery_kwh': p.battery_kwh,
                'project_value_excl_vat': p.project_value_excl_vat,
                'site_contact_person': p.site_contact_person,
                'site_phone': p.site_phone,
            }
            for p in projects
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint to get project by ID
@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project_by_id(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify({
            'id': project.id,
            'name': project.name,
            'client_name': project.client.client_name,
            'location': project.location,   # ✅ fixed here
            'system_type': project.system_type,
            'panel_kw': project.panel_kw,
            'inverter_kva': project.inverter_kva,
            'battery_kwh': project.battery_kwh,
            'project_value_excl_vat': project.project_value_excl_vat,
            'site_contact_person': project.site_contact_person,
            'site_phone': project.site_phone
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# API to upload energy data
@app.route('/upload_energy_data', methods=['POST'])
def upload_energy_data():
    try:
        # Check if file and project_id are provided
        if 'file' not in request.files or 'project_id' not in request.form:
            return jsonify({"error": "File and project_id are required"}), 400
        
        file = request.files['file']
        project_id = int(request.form['project_id'])

        # Validate project_id exists
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": f"Project with id {project_id} does not exist"}), 404
        
        # Validate file type
        if not file.filename.endswith(('xlsx', 'xls')):
            return jsonify({"error": "Only Excel files (.xlsx, .xls) are allowed"}), 400
        
        # Read excel file
        app.logger.debug(f"Reading file: {file.filename}")
        df = pd.read_excel(file, engine='openpyxl')
        app.logger.debug(f"DataFrame columns: {df.columns.tolist()}")

        # Ensure integer index
        df = df.reset_index(drop=True)

        # Validate required columns
        required_columns = ['Timestamp', 'Demand_kW']
        if not all(col in df.columns for col in required_columns):
            return jsonify({"error": f"File must contain columns: {', '.join(required_columns)}"}), 400
        
        # Drop rows with missing or invalid data
        df = df.dropna(subset=['Timestamp', 'Demand_kW'])

        # Convert data to list of EnergyData objects
        energy_records = []
        for idx, row in df.iterrows():
            try:
                timestamp = pd.to_datetime(row['Timestamp'], format='%Y/%m/%d %H:%M', errors='raise')
                demand_kw = float(row['Demand_kW'])
                if not (timestamp.year == 2025 and timestamp.minute % 30 == 0):
                    return jsonify({"error": f"Invalid timestamp at row {idx}: {timestamp}. Must be in 2025 with 30-min intervals"}), 400
                energy_records.append(EnergyData(
                    project_id=project_id,
                    timestamp=timestamp,
                    demand_kw=demand_kw
                ))
            except ValueError as e:
                app.logger.error(f"Invalid data format in row {row}: {str(e)}")
                return jsonify({"error": f"Invalid data format in row {row}: {str(e)}"}), 400
        
        # Bulk insert
        if not energy_records:
            return jsonify({"error": "No valid energy data to insert"}), 400
        db.session.bulk_save_objects(energy_records)
        db.session.commit()
        app.logger.debug(f"Uploaded {len(energy_records)} energy records for project {project_id}")
        return jsonify({"message": f"Uploaded {len(energy_records)} energy records for project {project_id}"}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error uploading energy data: {str(e)}")
        return jsonify({"error": str(e)}), 500


# API to get consumption data for a project
@app.route('/consumption_data/<int:project_id>', methods=['GET'])
def get_consumption_data(project_id):
    try:
        # Validate project_id exists
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": f"Project with id {project_id} does not exist"}), 404
        
        # Get query parameters for date range
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # Build query
        query = EnergyData.query.filter_by(project_id=project_id)
        if start_date:
            query = query.filter(EnergyData.timestamp >= start_date)
        if end_date:
            query = query.filter(EnergyData.timestamp <= end_date)

        # Fetch data
        data = query.order_by(EnergyData.timestamp).all()
        return jsonify([
            {
                'timestamp': record.timestamp.isoformat(),
                'demand_kw': record.demand_kw
            }
            for record in data
        ])
    except Exception as e:
        app.logger.error(f"Error fetching consumption data: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/simulate_generation', methods=['POST'])
def simulate_generation():
    try:
        from pvlib.location import Location
        from pvlib.pvsystem import PVSystem
        from pvlib.modelchain import ModelChain
        from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
        import pandas as pd

        data = request.get_json()
        latitude = data['lat']
        longitude = data['lon']
        panel_kw = float(data['panel_kw'])

        if not panel_kw or panel_kw <= 0:
            return jsonify({"error": "Invalid panel size"}), 400

        # Define simulation location
        site = Location(latitude, longitude, tz='Africa/Johannesburg')

        # Create a time series for 2025 at 30-minute intervals
        times = pd.date_range(start='2025-01-01', end='2025-12-31 23:30:00', freq='30min', tz=site.tz)

        # Get solar position and irradiance
        solar_position = site.get_solarposition(times)
        clearsky = site.get_clearsky(times)  # GHI, DNI, DHI

        # Define system with fixed tilt and basic assumptions
        temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']

        system = PVSystem(
            surface_tilt=30,
            surface_azimuth=0,
            module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
            inverter_parameters={'pdc0': panel_kw * 1000},
            temperature_model_parameters=temperature_params,
            racking_model='open_rack',
            module_type='glass_glass'
        )

        mc = ModelChain(
            system=system,
            location=site,
            aoi_model='no_loss',
            spectral_model='no_loss',
            losses_model='no_loss'
        )

        mc.run_model(clearsky)

        # Convert output to kW
        ac_output_kw = mc.results.ac.fillna(0) / 1000

        return jsonify({
            "timestamps": list(ac_output_kw.index.strftime('%Y-%m-%dT%H:%M:%S')),
            "generation_kw": list(ac_output_kw.round(2))
        })

    except Exception as e:
        app.logger.error(f"Error in simulate_generation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/simulate', methods=['POST'])
def simulate_system():
    try:
        import pandas as pd
        from pvlib.location import Location
        from pvlib.pvsystem import PVSystem
        from pvlib.modelchain import ModelChain
        from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS

        data = request.get_json()
        project_id = data.get("project_id")
        panel_kw = data["system"]["panel_kw"]
        battery_kwh = data["system"]["battery_kwh"] or 0
        system_type = data["system"]["system_type"]

        # Get project + energy data
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return jsonify({"error": "No energy data found"}), 404

        # Static lat/lon for now
        latitude = -29.7538   # Hopetown
        longitude = 24.0859

        # Create simulation times (based on demand data timestamps)
        times = pd.to_datetime([r.timestamp for r in records]).tz_localize('Africa/Johannesburg')

        site = Location(latitude, longitude, tz='Africa/Johannesburg')
        clearsky = site.get_clearsky(times)

        temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']

        system = PVSystem(
            surface_tilt=30,
            surface_azimuth=0,
            module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
            inverter_parameters={'pdc0': panel_kw * 1000},
            temperature_model_parameters=temperature_params,
            racking_model='open_rack',
            module_type='glass_glass'
        )

        mc = ModelChain(system, site, aoi_model='no_loss', spectral_model='no_loss', losses_model='no_loss')
        mc.run_model(clearsky)

        # Convert to kW and match to demand
        generation_kw = mc.results.ac.fillna(0) / 1000
        demand_kw = [r.demand_kw for r in records]

        # Simulation loop
        battery_max = battery_kwh * 1000  # convert to Wh
        battery_soc = 0
        soc_trace = []
        import_from_grid = []
        export_to_grid = []

        for i in range(len(demand_kw)):
            gen = generation_kw.iloc[i]
            demand = demand_kw[i]
            net = gen - demand

            if system_type in ['hybrid', 'off-grid']:
                battery_soc += net * 1000 * 0.5  # 50% assumed round-trip efficiency
                battery_soc = max(0, min(battery_soc, battery_max))
            else:
                battery_soc = 0

            soc_trace.append(round(battery_soc / battery_max * 100, 2) if battery_max > 0 else 0)
            import_from_grid.append(max(0, -net) if system_type != 'off-grid' else 0)
            export_to_grid.append(max(0, net) if system_type != 'off-grid' else 0)

        return jsonify({
            "timestamps": [r.timestamp.isoformat() for r in records],
            "demand": demand_kw,
            "generation": list(generation_kw.round(2)),
            "battery_soc": soc_trace,
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid
        })

    except Exception as e:
        app.logger.error(f"Simulation error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/financial_model', methods=['POST'])
def financial_model():
    try:
        data = request.get_json()
        project_id = data.get("project_id")
        eskom_tariff = float(data.get("tariff", 2.2))
        export_enabled = data.get("export_enabled", False)
        feed_in_tariff = float(data.get("feed_in_tariff", 1.0))

        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        sim_response = simulate_system_inner(project_id, project.panel_kw, project.battery_kwh or 0, project.system_type)
        if "error" in sim_response:
            return jsonify(sim_response), 500

        demand = sim_response["demand"]
        generation = sim_response["generation"]
        export = sim_response["export_to_grid"]
        import_kw = sim_response["import_from_grid"]
        timestamps = sim_response["timestamps"]

        degradation_rate = 0.005  # 0.5%/year
        system_cost = project.project_value_excl_vat or 0

        base_savings = 0
        monthly_costs = {}

        for i in range(len(demand)):
            ts = datetime.fromisoformat(timestamps[i])
            month = ts.strftime('%Y-%m')

            # ⚠️ kW × 0.5h = kWh for 30-minute intervals
            base_cost = demand[i] * 0.5 * eskom_tariff
            import_cost = import_kw[i] * 0.5 * eskom_tariff
            savings = base_cost - import_cost
            if export_enabled:
                savings += export[i] * 0.5 * feed_in_tariff

            base_savings += savings

            if month not in monthly_costs:
                monthly_costs[month] = {"old_cost": 0, "new_cost": 0}
            monthly_costs[month]["old_cost"] += base_cost
            monthly_costs[month]["new_cost"] += import_cost - (export[i] * 0.5 * feed_in_tariff if export_enabled else 0)

        yearly_savings = []
        total_savings = 0
        for year in range(2025, 2025 + 20):
            degradation_factor = (1 - degradation_rate) ** (year - 2025)
            degraded_savings = base_savings * degradation_factor
            yearly_savings.append({"year": year, "savings": round(degraded_savings)})
            total_savings += degraded_savings

        roi_20yr = ((total_savings / system_cost) - 1) * 100 if system_cost > 0 else 0
        payback_years = system_cost / base_savings if base_savings > 0 else 0

        cost_comparison = [
            {"period": month, "old_cost": round(v["old_cost"], 2), "new_cost": round(v["new_cost"], 2)}
            for month, v in sorted(monthly_costs.items())
        ]

        return jsonify({
            "annual_savings": round(base_savings),
            "payback_years": payback_years,
            "roi_20yr": roi_20yr,
            "yearly_savings": yearly_savings,
            "cost_comparison": cost_comparison
        })

    except Exception as e:
        app.logger.error(f"Financial model error: {str(e)}")
        return jsonify({"error": str(e)}), 500


# Helper: internal simulation call to avoid double API
def simulate_system_inner(project_id, panel_kw, battery_kwh, system_type):
    try:
        from pvlib.location import Location
        from pvlib.pvsystem import PVSystem
        from pvlib.modelchain import ModelChain
        from pvlib.temperature import TEMPERATURE_MODEL_PARAMETERS
        import pandas as pd

        records = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        if not records:
            return {"error": "No energy data found for project"}

        # Hardcoded location for now
        latitude = -29.7538
        longitude = 24.0859

        times = pd.to_datetime([r.timestamp for r in records]).tz_localize('Africa/Johannesburg')
        site = Location(latitude, longitude, tz='Africa/Johannesburg')
        clearsky = site.get_clearsky(times)

        temperature_params = TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_glass']
        system = PVSystem(
            surface_tilt=30,
            surface_azimuth=0,
            module_parameters={'pdc0': panel_kw * 1000, 'gamma_pdc': -0.004},
            inverter_parameters={'pdc0': panel_kw * 1000},
            temperature_model_parameters=temperature_params,
            racking_model='open_rack',
            module_type='glass_glass'
        )

        mc = ModelChain(system, site, aoi_model='no_loss', spectral_model='no_loss', losses_model='no_loss')
        mc.run_model(clearsky)

        generation_kw = mc.results.ac.fillna(0) / 1000
        demand_kw = [r.demand_kw for r in records]

        battery_max = battery_kwh * 1000
        battery_soc = 0
        soc_trace = []
        import_from_grid = []
        export_to_grid = []

        for i in range(len(demand_kw)):
            gen = generation_kw.iloc[i]
            demand = demand_kw[i]
            net = gen - demand

            if system_type in ['hybrid', 'off-grid']:
                battery_soc += net * 1000 * 0.5
                battery_soc = max(0, min(battery_soc, battery_max))
            else:
                battery_soc = 0

            soc_trace.append(round(battery_soc / battery_max * 100, 2) if battery_max > 0 else 0)
            import_from_grid.append(max(0, -net) if system_type != 'off-grid' else 0)
            export_to_grid.append(max(0, net) if system_type != 'off-grid' else 0)

        return {
            "timestamps": [r.timestamp.isoformat() for r in records],
            "demand": demand_kw,
            "generation": list(generation_kw.round(2)),
            "battery_soc": soc_trace,
            "import_from_grid": import_from_grid,
            "export_to_grid": export_to_grid
        }

    except Exception as e:
        return {"error": str(e)}


if __name__ == '__main__':
    app.run(debug=True)