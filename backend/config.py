import os
from datetime import timedelta
from dotenv import load_dotenv
from pathlib import Path

# Load .env based on FLASK_ENV
env = os.environ.get("FLASK_ENV", "development")
env_file = f".env.{env}"
load_dotenv(dotenv_path=Path(__file__).parent / env_file)

print('Loaded env file: ', env_file)
print('FLASK_ENV:', env)

def _csv(name: str, default: str):
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]

class Config:
    # Shared configurations
    SECRET_KEY = os.environ.get("SECRET_KEY")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=180)
    JWT_ALGORITHM = "HS256"
    SQLALCHEMY_TRACK_MODIFICATIONS = False


    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in ["true", "on", "1"]
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get(
        "MAIL_DEFAULT_SENDER", "noreply@orkasolar.co.za"
    )

    ALLOWED_EMAIL_DOMAIN = "@orkasolar.co.za"
    ADMIN_EMAIL = os.environ.get(
        "ADMIN_EMAIL", "neill@orkasolar.co.za"
    )

    FRONTEND_URL = os.environ.get(
        "FRONTEND_URL", "http://localhost:5173"
    )

    ALLOWED_ORIGINS = _csv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )

    ENV = env  # Use the detected env

class DevelopmentConfig(Config):
    DEBUG = True
    # Use local DB URI (override via DEV_DATABASE_URI in .env.development if needed)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DEV_DATABASE_URI", "postgresql://postgres:1234@localhost/client_onboarding"
    )

class ProductionConfig(Config):
    DEBUG = False
    # Prefer app subdomain by defauly in prod
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://app.orkasolar.co.za")
    ALLOWED_ORIGINS = _csv(
        "CORS_ORIGINS", "https://app.orkasolar.co.za"
    )
    
    # Use prod db from DATABASE_URL (as provided by Render)
    database_url = os.environ.get("DATABASE_URL")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = database_url