import pandas as pd
from sqlalchemy import (create_engine, Column, Integer, String, Float, DateTime, ForeignKey)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
import numpy as np

Base = declarative_base()
DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/client_onboarding'

class LoadProfiles(Base):
    __tablename__ = 'load_profiles'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(200), nullable=True)
    profile_type = Column(String(50), nullable=False)  # 'residential', 'commercial'
    annual_kwh = Column(Float, nullable=True)
    profile_data = Column(JSONB, nullable=False)  # JSONB to store time series data

# Database Engine and Session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_db_tables():
    Base.metadata.create_all(engine)
    print("Database tables created successfully.")

def import_profile_from_excel(
    db_session,
    file_path: str,
    profile_name: str,
    profile_type: str,
    description: str,
    timestamp_col: str = 'Timestamp',
    demand_col: str = 'Demand_kW',
    interval_hours: float = 0.5
):
    print(f"Processing '{profile_name}' profile from {file_path}")
    try:
        # Read File
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        # Check required columns
        if not all(col in df.columns for col in [timestamp_col, demand_col]):
            missing = [col for col in [timestamp_col, demand_col] if col not in df.columns]
            raise ValueError(f"Missing required columns: {', '.join(missing)}")
        
        # Process Data
        df[timestamp_col] = pd.to_datetime(df[timestamp_col]).dt.strftime('%Y-%m-%dT%H:%M:%S')
        df[demand_col] = df[demand_col].astype(float)

        # Calculate Annual kWh
        annual_kwh = float(df[demand_col].sum() * interval_hours)

        # Prepare JSONB data
        profile_data_json = df[[timestamp_col, demand_col]].to_dict(orient='records')

        # Update or create Load Profile
        existing_profile = db_session.query(LoadProfiles).filter_by(name=profile_name).first()

        if existing_profile:
            print(f"Updating existing profile: {profile_name}")
            existing_profile.description = description
            existing_profile.profile_type = profile_type
            existing_profile.annual_kwh = annual_kwh
            existing_profile.profile_data = profile_data_json
        else:
            print(f"Creating new profile: {profile_name}")
            new_profile = LoadProfiles(
                name=profile_name,
                description=description,
                profile_type=profile_type,
                annual_kwh=annual_kwh,
                profile_data=profile_data_json
            )
            db_session.add(new_profile)

        db_session.commit()
        print(f"Profile '{profile_name}' imported successfully with {len(df)} records.")
    except Exception as e:
        print(f"Error importing profile '{profile_name}': {e}")
        db_session.rollback()

if __name__ == "__main__":
    create_db_tables()
    db = SessionLocal()
    
    try:
        # Residential - Anton Ackerman
        import_profile_from_excel(
            db_session=db,
            file_path='./utils/anton_ackerman_load_profile.xlsx',
            profile_name='Anton Ackerman Residential',
            profile_type='Residential',
            description='Residential load profile',
            interval_hours=0.5
        )

        # Commercial - QTyres
        import_profile_from_excel(
            db_session=db,
            file_path='./utils/qtyres_load_profile.xlsx',
            profile_name='QTyres Commercial',
            profile_type='Commercial',
            description='Commercial load profile',
            interval_hours=0.5
        )
    finally:
        db.close()
        print("Database session closed.")