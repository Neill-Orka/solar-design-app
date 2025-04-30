# config.py

class Config:
    SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:1234@localhost/client_onboarding'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'your-secret-key'  # Optional: for future auth, sessions
