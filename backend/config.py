import os

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
    # SECRET_KEY = 'your-secret-key'  # Optional: for future auth, sessions