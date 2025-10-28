import os, base64, requests, msal, json
from typing import Any, Dict, List, Optional, Sequence, Union

TENANT = os.getenv("MS_TENANT_ID")
CLIENT_ID = os.getenv("MS_CLIENT_ID")
CLIENT_SECRET = os.getenv("MS_CLIENT_SECRET")
AUTHORITY = f"https://login.microsoftonline.com/{TENANT}"
SCOPES = ["https://graph.microsoft.com/.default"]
DEFAULT_SENDER = os.getenv("MS_SENDER")
IS_PRODUCTION = os.getenv("FLASK_ENV") == "production"

_msal_app: Optional[Any] = None

# --- Token Functions ---
def _get_app_token() -> str:
    """PROD AND DEV: Acquires an application token via client credentials."""
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

    # Get the app token
    token = _get_app_token()
    
    # Always send from the specified sender's mailbox (e.g., hello@orkasolar.co.za)
    url = f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail"

    res = requests.post(url, json=payload,
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        timeout=15)

    if res.status_code != 202:
        raise RuntimeError(f"Graph sendMail failed: {res.status_code} {res.text}")
    return {"ok": True}