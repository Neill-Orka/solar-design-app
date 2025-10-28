from flask import Blueprint, jsonify, request
from markupsafe import escape
from services.mailer import send_email
import jwt

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.route("/notify/test", methods=["POST"])
def notify_test():
    data = request.get_json() or {}
    to = data.get("to")
    recipients = [e.strip() for e in to.split(",")] if to else None
    subject = data.get("subject", "Orka Solar — Graph email test")
    body = data.get("body", "If you can read this, Microsoft Graph mail is configured correctly.")
    send_email(subject, recipients, html=f"<p>{escape(body)}</p>", text=body)
    return jsonify({"ok": True})
