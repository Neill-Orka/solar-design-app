# routes/load_profiles.py
from flask import Blueprint, request, jsonify
from models import db, LoadProfiles, User, UserRole
from flask_jwt_extended import jwt_required, get_jwt_identity
import pandas as pd
import io

load_profiles_bp = Blueprint('load_profiles', __name__)

def process_profile_file(file_stream, interval_hours=0.5):
    """
    Helper function to process an uploaded file stream (CSV or XLSX)
    and return the calculated annual kWh and the JSON data.
    """
    try:
        # Determine file type and read into pandas DataFrame
        if file_stream.filename.endswith('.csv'):
            df = pd.read_csv(file_stream)
        elif file_stream.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file_stream)
        else:
            raise ValueError("Unsupported file format. Please use CSV or XLSX.")

        # Find timestamp and demand columns (case-insensitive)
        timestamp_col = next((col for col in df.columns if col.lower() == 'timestamp'), None)
        demand_col = next((col for col in df.columns if col.lower() in ['demand_kw', 'demand-kw', 'demand (kw)']), None)
        
        if not timestamp_col or not demand_col:
            raise ValueError("File must contain 'Timestamp' and 'Demand_kW' columns.")

        # Process data
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        df[demand_col] = pd.to_numeric(df[demand_col], errors='coerce').fillna(0)

        # Ensure 8760 hours (17520 half-hours)
        if len(df) != 17520:
             return {"error": f"Invalid data length. The file must contain exactly 17520 rows for a full year of 30-minute intervals, but found {len(df)}."}

        # Normalization logic
        #1. Calculate the actual total annual consumption from the file
        actual_annual_kwh = float(df[demand_col].sum() * interval_hours)

        #2. Handle case where consumption is zero to avoid division by zero
        if actual_annual_kwh == 0:
            return {"error": "The total annual consumption is zero. Please check the data."}
        
        # Calculate original metrics before normalization
        monthly_avg_kwh_original = actual_annual_kwh / 12.0
        max_peak_demand_kw = float(df[demand_col].max())
        
        #3. Define the target annual consumption (1 kWh/month * 12 months)
        target_annual_kwh = 12.0

        #4. Calculate the normalization factor
        normalization_factor = target_annual_kwh / actual_annual_kwh

        #5. Apply the factor to the demand column to normalize the data
        df[demand_col] = df[demand_col] * normalization_factor
        # --- Normalization complete ---

        # Standardize column names for saving
        df.rename(columns={timestamp_col: 'timestamp', demand_col: 'demand_kw'}, inplace=True)
        
        # Format timestamp for JSON compatibility
        df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')

        # New annual kwh for the profile is our normalized target value
        normalized_annual_kwh = target_annual_kwh

        # Prepare JSONB data
        profile_data_json = df[['timestamp', 'demand_kw']].to_dict(orient='records')
        
        return {
            "annual_kwh": normalized_annual_kwh, 
            "monthly_avg_kwh_original": monthly_avg_kwh_original,
            "max_peak_demand_kw": max_peak_demand_kw,
            "profile_data": profile_data_json, 
            "error": None
        }

    except Exception as e:
        return {"error": str(e)}

@load_profiles_bp.route('/load_profiles', methods=['POST'])
def create_load_profile():
    """ Creates a new LoadProfile from a file upload. """
    if 'profile_file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['profile_file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400

    try:
        # Process the file using the helper function
        processed_data = process_profile_file(file)
        if processed_data.get("error"):
            return jsonify({"error": processed_data["error"]}), 400
            
        # Create new profile entry in the database
        new_profile = LoadProfiles(
            name=request.form.get('name', 'Unnamed Profile'),
            description=request.form.get('description', ''),
            profile_type=request.form.get('profile_type', 'Residential'),
            annual_kwh=processed_data["annual_kwh"],
            monthly_avg_kwh_original=processed_data["monthly_avg_kwh_original"],
            max_peak_demand_kw=processed_data["max_peak_demand_kw"],
            profile_data=processed_data["profile_data"]
        )
        db.session.add(new_profile)
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Load profile created successfully",
            "profile": { "id": new_profile.id, "name": new_profile.name }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500

@load_profiles_bp.route('/load_profiles/<int:profile_id>', methods=['PUT'])
def update_load_profile(profile_id):
    """ Updates a load profile's name and description. """
    profile = LoadProfiles.query.get_or_404(profile_id)
    data = request.get_json()

    if 'name' in data: profile.name = data['name']
    if 'description' in data: profile.description = data['description']

    try:
        db.session.commit()
        return jsonify({"success": True, "message": "Profile updated successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@load_profiles_bp.route('/load_profiles/<int:profile_id>', methods=['DELETE'])
@jwt_required()
def delete_load_profile(profile_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({
            'error': 'forbidden',
            'message': 'Access Restricted: Only administrators can delete load profiles.'
        }), 403
    """ Deletes a load profile. """
    profile = LoadProfiles.query.get_or_404(profile_id)
    try:
        db.session.delete(profile)
        db.session.commit()
        return jsonify({"success": True, "message": "Profile deleted successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Note: The GET route for /load_profiles is already in your projects.py
# For better organization, you could move it here. If so, remember to remove it from projects.py.
