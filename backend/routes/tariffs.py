from flask import Blueprint, request, jsonify
from models import db, Tariffs, TariffRates, User, UserRole
from flask_jwt_extended import jwt_required, get_jwt_identity

tariffs_bp = Blueprint('tariffs', __name__)

# --- Helper function to format tariff data ---
def serialize_tariff(tariff):
    """Converts a Tariff object into a JSON-friendly dictionary."""
    return {
        'id': tariff.id,
        'name': tariff.name,
        'power_user_type': tariff.power_user_type,
        'tariff_category': tariff.tariff_category,
        'transmission_zone': tariff.transmission_zone,
        'supply_voltage': tariff.supply_voltage,
        'code': tariff.code,
        'matrix_code': tariff.matrix_code,
        'structure': tariff.structure,
        'rates': [
            {
                'id': rate.id,
                'charge_name': rate.charge_name,
                'charge_category': rate.charge_category,
                'season': rate.season,
                'time_of_use': rate.time_of_use,
                'rate_unit': rate.rate_unit,
                'rate_value': str(rate.rate_value), # Convert Decimal to string
                'block_threshold_kwh': str(rate.block_threshold_kwh) if rate.block_threshold_kwh is not None else None
            } for rate in tariff.rates
        ]
    }

# --- GET /api/tariffs (List all tariffs with filtering) ---
@tariffs_bp.route('/tariffs', methods=['GET'])
def get_tariffs():
    """Returns a list of all tariffs, with optional filtering."""
    query = Tariffs.query

    # Example filter (you can add more)
    name_filter = request.args.get('name')
    if name_filter:
        query = query.filter(Tariffs.name.ilike(f"%{name_filter}%"))

    tariffs = query.order_by(Tariffs.name).all()
    return jsonify([serialize_tariff(t) for t in tariffs])

# --- GET /api/tariffs/<id> (Get a single tariff) ---
@tariffs_bp.route('/tariffs/<int:id>', methods=['GET'])
def get_tariff(id):
    """Returns a single tariff by its ID."""
    tariff = Tariffs.query.get_or_404(id)
    return jsonify(serialize_tariff(tariff))

# --- POST /api/tariffs (Create a new tariff) ---
@tariffs_bp.route('/tariffs', methods=['POST'])
def create_tariff():
    """Creates a new tariff from JSON data."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400

    new_tariff = Tariffs(
        name=data.get('name'),
        power_user_type=data.get('power_user_type'),
        tariff_category=data.get('tariff_category'),
        code=data.get('code'),
        matrix_code=data.get('matrix_code'),
        structure=data.get('structure')
    )
    db.session.add(new_tariff)
    db.session.flush() # Flush to get the new_tariff.id

    for rate_data in data.get('rates', []):
        new_rate = TariffRates(
            tariff_id=new_tariff.id,
            charge_name=rate_data.get('charge_name'),
            charge_category=rate_data.get('charge_category'),
            season=rate_data.get('season'),
            time_of_use=rate_data.get('time_of_use'),
            rate_unit=rate_data.get('rate_unit'),
            rate_value=rate_data.get('rate_value'),
            block_threshold_kwh=rate_data.get('block_threshold_kwh')
        )
        db.session.add(new_rate)

    db.session.commit()
    return jsonify(serialize_tariff(new_tariff)), 201

# --- PUT /api/tariffs/<id> (Update an existing tariff) ---
@tariffs_bp.route('/tariffs/<int:id>', methods=['PUT'])
def update_tariff(id):
    """Updates an existing tariff."""
    tariff = Tariffs.query.get_or_404(id)
    data = request.get_json()

    # Update main tariff attributes from incoming JSON data
    tariff.name = data.get('name', tariff.name)
    tariff.power_user_type = data.get('power_user_type', tariff.power_user_type)
    tariff.tariff_category = data.get('tariff_category', tariff.tariff_category)
    tariff.transmission_zone = data.get('transmission_zone', tariff.transmission_zone)
    tariff.supply_voltage = data.get('supply_voltage', tariff.supply_voltage)
    tariff.code = data.get('code', tariff.code)
    tariff.matrix_code = data.get('matrix_code', tariff.matrix_code)
    tariff.structure = data.get('structure', tariff.structure)
    
    # Easiest way to handle nested rates is to delete and recreate
    TariffRates.query.filter_by(tariff_id=id).delete()

    for rate_data in data.get('rates', []):
        new_rate = TariffRates(
            tariff_id=id,
            charge_name=rate_data.get('charge_name'),
            charge_category=rate_data.get('charge_category'),
            season=rate_data.get('season'),
            time_of_use=rate_data.get('time_of_use'),
            rate_unit=rate_data.get('rate_unit'),
            rate_value=rate_data.get('rate_value'),
            block_threshold_kwh=rate_data.get('block_threshold_kwh')
        )
        db.session.add(new_rate)

    db.session.commit()
    return jsonify(serialize_tariff(tariff))

# --- DELETE /api/tariffs/<id> (Delete a tariff) ---
@tariffs_bp.route('/tariffs/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_tariff(id):
    """Deletes a tariff and its associated rates (admin only)."""
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({
            'error': 'forbidden',
            'message': 'Access Restricted: Only administrators can delete tariffs.'
        }), 403
    tariff = Tariffs.query.get_or_404(id)
    db.session.delete(tariff)  # The 'cascade' setting in the model will delete all related rates
    db.session.commit()
    return jsonify({'message': f'Tariff {id} deleted successfully.'})