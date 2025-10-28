import os, base64, requests, msal, json
from typing import Any, Dict, List, Optional, Sequence, Union

TENANT = os.getenv("MS_TENANT_ID")
CLIENT_ID = os.getenv("MS_CLIENT_ID")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"
SCOPES = ["https://graph.microsoft.com/.default"]
DEFAULT_SENDER = os.getenv("MS_SENDER")
TOKEN_CACHE_FILE = 'ms_token_cache.json'

_msal_app: Optional[Any] = None

def _get_delegated_token_from_cache() -> str:
    """Acquires a delegated token using a file cache and refresh token."""
    global _msal_app
    if not _msal_app:
        _msal_app = msal.PublicClientApplication(client_id=CLIENT_ID, authority=AUTHORITY)

    try:
        with open(TOKEN_CACHE_FILE, 'r') as f:
            token_cache = json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"Token cache file not found. Please run get_device_token.py first.")

    accounts = _msal_app.get_accounts()
    result = None
    if accounts:
        # Try to get a token silently using the refresh token
        result = _msal_app.acquire_token_silent(scopes=["Mail.Send"], account=accounts[0])

    if not result:
        # If silent fails, use the refresh token explicitly
        result = _msal_app.acquire_token_by_refresh_token(
            token_cache["refresh_token"], scopes=["Mail.Send"])

    if "access_token" not in result:
        raise RuntimeError(f"Could not refresh token. Please run get_device_token.py again. Error: {result.get('error_description')}")

    # Update the cache with the new tokens (including a new refresh token)
    with open(TOKEN_CACHE_FILE, 'w') as f:
        json.dump(result, f, indent=4)

    return result["access_token"]

def _get_msal_app() -> Any:
    """Lazily initialize and return the msal ConfidentialClientApplication."""
    global _msal_app
    if _msal_app is not None:
        return _msal_app

    if not TENANT or not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("MSAL configuration missing: ensure MS_TENANT_ID, MS_CLIENT and MS_CLIENT_SECRET are set")

    _msal_app = msal.ConfidentialClientApplication(
        client_id=CLIENT_ID,
        authority=AUTHORITY,
        client_credential=CLIENT_SECRET,
    )
    return _msal_app

def _get_token() -> str:
    """
    Acquire an access token for Microsoft Graph via client credentials.
    """
    app = _get_msal_app()
    result = app.acquire_token_silent(SCOPES, account=None)
    if not result:
        result = app.acquire_token_for_client(scopes=SCOPES)
    if not result or "access_token" not in result:
        err = result.get("error_description") if isinstance(result, dict) else str(result)
        raise RuntimeError(f"Graph token error: {err or result}")
    
    # Debug: Print token scopes to verify permissions
    import jwt
    decoded = jwt.decode(result["access_token"], options={"verify_signature": False})
    print(f"Token scopes: {decoded.get('scp') or decoded.get('roles')}")
    
    return result["access_token"]

def send_via_graph(subject, recipients, html=None, text=None, reply_to=None, attachments=None, save_to_sent=True, sender=None):
    sender = sender or DEFAULT_SENDER
    if not sender:
        raise ValueError("MS_SENDER not configured")
    if not recipients:
        return

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

    token = _get_delegated_token_from_cache()
    url = f"https://graph.microsoft.com/v1.0/me/sendMail"
    res = requests.post(url, json=payload,
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=15)
    # sendMail should return 202 Accepted on success
    if res.status_code != 202:
        raise RuntimeError(f"Graph sendMail failed: {res.status_code} {res.text}")
    return {"ok": True}
