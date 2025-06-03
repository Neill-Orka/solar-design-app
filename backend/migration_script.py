# migration_script.py
from app import app, db
from models import Projects

with app.app_context():
    projects = Projects.query.all()
    for p in projects:
        # Convert inverters
        if p.inverter_kva and not isinstance(p.inverter_kva, dict):
            p.inverter_kva = {
                'capacity': p.inverter_kva,
                'quantity': 1
            }
        
        # Convert batteries
        if p.battery_kwh and not isinstance(p.battery_kwh, dict):
            p.battery_kwh = {
                'capacity': p.battery_kwh,
                'quantity': 1
            }
    
    db.session.commit()