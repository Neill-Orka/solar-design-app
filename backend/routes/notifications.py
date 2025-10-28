from flask import Blueprint, current_app, jsonify, request
from markupsafe import escape
from services.mailer import send_email
from models import User, JobCard
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

def send_job_card_assignment_to_bum(job_card: JobCard, bum: User):
    """Send an email to a BUM when they are assigned to a job card."""
    if not bum or not bum.email:
        current_app.logger.warning(f"Cannot send BUM assignment notification for JC-{job_card.id}: BUM has no email.")
        return
    
    try:
        frontend_url = current_app.config.get("FRONTEND_URL", "https://app.orkasolar.co.za")
        job_card_url = f"{frontend_url}/jobcards/{job_card.id}"

        subject = f"New Job Card Assignment: {job_card.title}"

        html_body = f"""
        <p>Hi {bum.first_name},</p>
        <p>You have been assigned as the BUM for a new job card:</p>
        <ul>
            <li><strong>Job Card Title:</strong> {job_card.title}</li>
            <li><strong>Client:</strong> {job_card.client_name_snapshot}</li>
            <li><strong>Technician:</strong> {job_card.owner.full_name if job_card.owner else 'N/A'}</li>
        </ul>
        <p>Please review the details by clicking the link below:</p>
        <p><a href="{job_card_url}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Job Card</a></p>
        <br>
        <p>Thank you,<br>Orka Solar App</p>
        """

        send_email(
            subject=subject,
            recipients=[bum.email],
            html=html_body
        )
        current_app.logger.info(f"Successfully sent job card assignment notification to {bum.email} for JC-{job_card.id}")

    except Exception as e:
        current_app.logger.error(f"Failed to send job card assignment email for JC-{job_card.id}: {e}")
        
