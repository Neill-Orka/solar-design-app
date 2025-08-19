import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Get the database URL from the environment variable.
    # If the environment variable is not set, use the default local database URI.
    database_url = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:1234@localhost/client_onboarding'
    )

    # Render's database URLs start with 'postgres://', but SQLAlchemy requires 'postgresql://'.
    # This line ensures the URI is in the correct format.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    # Set the final URI for SQLAlchemy
    SQLALCHEMY_DATABASE_URI = database_url

    # Other configurations
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-this-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_ALGORITHM = 'HS256'
    
    # Security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-super-secret-key-change-this-in-production')
    
    # Email Configuration (for invitations)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', '587'))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@orkasolar.co.za')
    
    # Domain restriction
    ALLOWED_EMAIL_DOMAIN = '@orkasolar.co.za'
    
    # Application settings
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'your-email@orkasolar.co.za')  # Your admin email
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')  # Frontend URL for invitation links
    ENV = os.environ.get('FLASK_ENV', 'development')  # Environment (development/production)