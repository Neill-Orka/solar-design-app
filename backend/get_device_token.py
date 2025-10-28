import msal
import os
import json

# Load from your .env file
from dotenv import load_dotenv
load_dotenv('.env.development')

CLIENT_ID = os.getenv("MS_CLIENT_ID")
TENANT_ID = os.getenv("MS_TENANT_ID")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
# FIX: Removed "offline_access" from this list
SCOPES = ["Mail.Send", "User.Read"] 

# This file will store your token
TOKEN_CACHE_FILE = 'ms_token_cache.json'

def get_token_via_device_flow():
    """Gets a token interactively using the device flow."""
    app = msal.PublicClientApplication(client_id=CLIENT_ID, authority=AUTHORITY)
    flow = app.initiate_device_flow(scopes=SCOPES)

    if "user_code" not in flow:
        raise ValueError("Failed to create device flow. Error: %s" % json.dumps(flow, indent=4))

    print(flow["message"])
    
    # This will block until you log in and grant consent in your browser
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" in result:
        # Save the token to a file
        with open(TOKEN_CACHE_FILE, 'w') as f:
            json.dump(result, f, indent=4)
        print(f"\nSuccess! Token saved to {TOKEN_CACHE_FILE}")
    else:
        print("\nFailed to get token.")
        print(result.get("error"))
        print(result.get("error_description"))

if __name__ == "__main__":
    get_token_via_device_flow()