import os, base64, requests, msal, json
from typing import Any, Dict, List, Optional, Sequence, Union

TENANT = os.getenv("MS_TENANT_ID")
CLIENT_ID = os.getenv("MS_CLIENT_ID")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"
SCOPES = ["https://graph.microsoft.com/.default"]
DEFAULT_SENDER = os.getenv("MS_SENDER")
TOKEN_CACHE_FILE = 'ms_token_cache.json'
IS_PRODUCTION = os.getenv("FLASK_ENV") == "production"

_msal_app: Optional[Any] = None

# --- Token Functions ---

def _get_delegated_token_from_cache() -> str:
    """DEV ONLY: Acquires a delegated token using a file cache and refresh token."""
    global _msal_app
    if not _msal_app:
        _msal_app = msal.PublicClientApplication(client_id=CLIENT_ID, authority=AUTHORITY)

    try:
        with open(TOKEN_CACHE_FILE, 'r') as f:
            token_cache = json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"DEV MODE ERROR: Token cache file not found. Please run get_device_token.py first.")

    accounts = _msal_app.get_accounts()
    result = _msal_app.acquire_token_silent(scopes=["Mail.Send"], account=accounts[0]) if accounts else None

    if not result:
        result = _msal_app.acquire_token_by_refresh_token(token_cache["refresh_token"], scopes=["Mail.Send"])

    if "access_token" not in result:
        raise RuntimeError(f"Could not refresh token. Please run get_device_token.py again. Error: {result.get('error_description')}")

    with open(TOKEN_CACHE_FILE, 'w') as f:
        json.dump(result, f, indent=4)

    return result["access_token"]

def _get_app_token() -> str:
    """PROD ONLY: Acquires an application token via client credentials."""
    global _msal_app
    if not _msal_app:
        if not all([TENANT, CLIENT_ID, CLIENT_SECRET]):
            raise RuntimeError("MSAL configuration missing: ensure MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET are set")
        _msal_app = msal.ConfidentialClientApplication(
            client_id=CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET)
    
    result = _msal_app.acquire_token_silent(SCOPES, account=None)
    if not result:
        result = _msal_app.acquire_token_for_client(scopes=SCOPES)
    
    if not result or "access_token" not in result:
        err = result.get("error_description") if isinstance(result, dict) else str(result)
        raise RuntimeError(f"Graph application token error: {err}")
        
    return result["access_token"]

def send_via_graph(subject, recipients, html=None, text=None, reply_to=None, attachments=None, save_to_sent=True, sender=None):
    sender = sender or DEFAULT_SENDER
    if not sender:
        raise ValueError("MS_SENDER not configured")
    if not recipients:
        return

    # Build the message payload (no changes here)
    body = {"contentType": "HTML" if html else "Text", "content": html or text or ""}
    to = [{"emailAddress": {"address": r}} for r in recipients]
    reply_to_obj = [{"emailAddress": {"address": r}} for r in (reply_to or [])]
    atts = []
    for att in (attachments or []):
        data = att["data"]
        if isinstance(data, str):
            data = data.encode("utf-8")
        atts.append({
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": att["filename"],
            "contentType": att.get("content_type", "application/octet-stream"),
            "contentBytes": base64.b64encode(data).decode("ascii"),
        })
    message = {"subject": subject, "body": body, "toRecipients": to}
    if reply_to_obj: message["replyTo"] = reply_to_obj
    if atts: message["attachments"] = atts
    payload = {"message": message, "saveToSentItems": bool(save_to_sent)}

    # DYNAMICALLY CHOOSE TOKEN AND URL BASED ON ENVIRONMENT
    if IS_PRODUCTION:
        token = _get_app_token()
        # In production, we send from a specific user's mailbox (the shared mailbox)
        url = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
    else:
        # In development, we use the logged-in user's delegated token
        token = _get_delegated_token_from_cache()
        url = "https://graph.microsoft.com/v1.0/me/sendMail"

    res = requests.post(url, json=payload,
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        timeout=15)

    if res.status_code != 202:
        raise RuntimeError(f"Graph sendMail failed: {res.status_code} {res.text}")
    return {"ok": True}