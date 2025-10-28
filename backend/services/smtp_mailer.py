import os, ssl, smtplib, uuid
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

SMTP_HOST       = os.getenv("SMTP_HOST", "smtp.office365.com")
SMTP_PORT       = int(os.getenv("SMTP_PORT", "587"))
SMTP_STARTTLS   = os.getenv("SMTP_STARTTLS", "true").lower() == "true"
SMTP_USER       = os.getenv("SMTP_USER")
SMTP_PASS       = os.getenv("SMTP_PASS")
SMTP_TIMEOUT    = int(os.getenv("SMTP_TIMEOUT", "20"))
SMTP_DEBUG      = os.getenv("SMTP_DEBUG", "false").lower() == "true"

MAIL_FROM       = os.getenv("MAIL_FROM", SMTP_USER)
MAIL_FROM_NAME  = os.getenv("MAIL_FROM_NAME", "Orka Solar App")
DEFAULT_REPLYTO = os.getenv("REPLY_TO")

def _from_header():
    return f'{MAIL_FROM_NAME} <{MAIL_FROM}>' if MAIL_FROM_NAME else MAIL_FROM

def _normalize_reply_to(reply_to):
    if not reply_to:
        return None
    if isinstance(reply_to, (list, tuple, set)):
        return ", ".join([str(x).strip() for x in reply_to if str(x).strip()])
    return str(reply_to).strip()

def _build_message(subject, recipients, html=None, text=None, reply_to=None, attachments=None, tracking_id=None):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_header()
    msg["To"] = ", ".join(recipients)
    rt = _normalize_reply_to(reply_to or DEFAULT_REPLYTO)
    if rt:
        msg["Reply-To"] = rt
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=(MAIL_FROM.split("@")[-1] if MAIL_FROM else "orkasolar.co.za"))
    msg["X-Orka-App"] = "SolarDesignApp"
    if tracking_id:
        msg["X-Orka-Tracking-ID"] = tracking_id

    # Body
    if html and text:
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
    elif html:
        msg.set_content("This email contains HTML content.")
        msg.add_alternative(html, subtype="html")
    else:
        msg.set_content(text or "")

    # Attachments
    for att in attachments or []:
        data = att["data"]
        if isinstance(data, str):
            data = data.encode("utf-8")
        ct = att.get("content_type", "application/octet-stream")
        maintype, subtype = ct.split("/", 1) if "/" in ct else ("application", "octet-stream")
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=att.get("filename", "attachment"))
    return msg

def send_via_smtp(subject, recipients, html=None, text=None, reply_to=None, attachments=None, mail_from=None):
    if not recipients:
        raise RuntimeError("No recipients provided")
    if not (SMTP_HOST and SMTP_PORT and SMTP_USER and SMTP_PASS and MAIL_FROM):
        raise RuntimeError("SMTP configuration is incomplete. Check env vars.")

    tracking_id = str(uuid.uuid4())
    msg = _build_message(subject, recipients, html=html, text=text, reply_to=reply_to,
                         attachments=attachments, tracking_id=tracking_id)

    # Envelope MAIL FROM / Return-Path: for M365, keep it equal to the authenticated user
    envelope_from = SMTP_USER

    context = ssl.create_default_context()
    with smtplib.SMTP(host=SMTP_HOST, port=SMTP_PORT, timeout=SMTP_TIMEOUT) as server:
        if SMTP_DEBUG:
            server.set_debuglevel(1)  # prints SMTP dialogue to stdout (see journalctl logs on server)
        server.ehlo()
        if SMTP_STARTTLS:
            server.starttls(context=context)
            server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        failures = server.sendmail(envelope_from, recipients, msg.as_string())
        if failures:
            # At least one RCPT was not accepted
            raise RuntimeError(f"SMTP accepted some recipients but failed for: {failures}")
    return {"tracking_id": tracking_id, "recipients": recipients}