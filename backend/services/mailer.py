import os
from flask import current_app
from services.ms_graph_mailer import send_via_graph

def _default_recipients():
    cfg = (current_app and current_app.config.get("NOTIFY_DEFAULT_TO")) or os.getenv("NOTIFY_DEFAULT_TO", "")
    return [e.strip() for e in cfg.split(",") if e.strip()]

def send_email(subject, recipients=None, html="", text=None, reply_to=None, attachments=None):
    recipients = recipients or _default_recipients()
    if not recipients:
        if current_app:
            current_app.logger.warning("send_email skipped — no recipients configured.")
        return
    # Allow REPLY_TO default from env
    if not reply_to:
        rt = os.getenv("REPLY_TO")
        reply_to = [rt] if rt else None
    return send_via_graph(subject, recipients, html=html, text=text, reply_to=reply_to, attachments=attachments)
