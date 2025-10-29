from flask import Blueprint, current_app, jsonify, request
from markupsafe import escape
from services.mailer import send_email
from models import User, JobCard, DocumentVersion
from datetime import datetime
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

        subject = f"New Job Card: {job_card.title}"

        html_body = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }}
                .container {{ max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #dddddd; }}
                /* MODIFIED: Added font-size and line-height for Outlook compatibility */
                .header {{ background-color: #002347; padding: 15px 20px; font-size: 1px; line-height: 1px; }}
                .content {{ padding: 30px; color: #333333; line-height: 1.6; }}
                .content h1 {{ color: #002347; font-size: 24px; margin-top: 0; }}
                .details-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                .details-table td {{ padding: 10px; border-bottom: 1px solid #eeeeee; }}
                .details-table td:first-child {{ font-weight: bold; color: #555555; width: 120px; }}
                .button-container {{ text-align: center; margin: 30px 0; }}
                .button {{ background-color: #007bff; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; }}
                .footer {{ background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #777777; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">&nbsp;</div>
                <div class="content">
                    <h1>New Job Card Assignment</h1>
                    <p>Hi {bum.first_name},</p>
                    <p>You have been assigned as the Business Unit Manager for a new job card. Please find the details below:</p>
                    
                    <table class="details-table">
                        <tr>
                            <td>Job Card:</td>
                            <td>{job_card.title}</td>
                        </tr>
                        <tr>
                            <td>Client:</td>
                            <td>{job_card.client_name_snapshot}</td>
                        </tr>
                        <tr>
                            <td>Technician:</td>
                            <td>{job_card.owner.full_name if job_card.owner else 'N/A'}</td>
                        </tr>
                    </table>

                    <div class="button-container">
                        <a href="{job_card_url}" class="button" style="color: #ffffff !important; text-decoration: none;">View Job Card</a>
                    </div>
                    
                    <p>Thank you,<br>Gevaarlike Orka Solar App</p>
                </div>
                <div class="footer">
                    &copy; {datetime.now().year} Orka Solar. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        """

        send_email(
            subject=subject,
            recipients=[bum.email],
            html=html_body
        )
        current_app.logger.info(f"Successfully sent job card assignment notification to {bum.email} for JC-{job_card.id}")

    except Exception as e:
        current_app.logger.error(f"Failed to send job card assignment email for JC-{job_card.id}: {e}")

def send_quote_review_request_to_bums(version: DocumentVersion, requester: User, bums: list[User]):
    """Notifies all BUMs that a quote is ready for their review."""
    if not bums:
        return

    doc = version.document
    project = doc.project
    frontend_url = current_app.config.get("FRONTEND_URL", "https://app.orkasolar.co.za")
    quote_url = f"{frontend_url}/projects/{project.id}/quotes/{doc.id}"

    subject = f"Quote Review Request: {doc.number} for {project.name}"
    recipients = [bum.email for bum in bums if bum.email]

    for bum in bums:
        html_body = f"""
        <p>Hi {bum.first_name},</p>
        <p>{requester.full_name} has requested a review for quote <strong>{doc.number}</strong>.</p>
        <ul>
            <li><strong>Project:</strong> {project.name}</li>
            <li><strong>Client:</strong> {project.client.client_name if project.client else 'N/A'}</li>
            <li><strong>Quote Total:</strong> R {version.totals_json.get('total_incl_vat', 0):,.2f}</li>
        </ul>
        <p>Please review the quote by clicking the link below:</p>
        <p><a href="{quote_url}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Review Quote Now</a></p>
        """
        try:
            send_email(subject=subject, recipients=[bum.email], html=html_body)
        except Exception as e:
            current_app.logger.error(f"Failed to send review request email to {bum.email}: {e}")


def send_quote_review_outcome_to_salesperson(version: DocumentVersion, reviewer: User):
    """Notifies the original requester of the BUM's decision."""
    requester = version.review_requested_by
    if not requester or not requester.email:
        return

    doc = version.document
    project = doc.project
    frontend_url = current_app.config.get("FRONTEND_URL", "https://app.orkasolar.co.za")
    quote_url = f"{frontend_url}/projects/{project.id}/quotes/{doc.id}"

    decision_upper = version.review_status.value.replace('_', ' ').upper()
    subject = f"Quote {decision_upper}: {doc.number}"

    html_body = f"""
    <p>Hi {requester.first_name},</p>
    <p>Your quote <strong>{doc.number}</strong> has been reviewed by {reviewer.full_name}.</p>
    <p><strong>Outcome: {decision_upper}</strong></p>
    """
    if version.reviewer_comments:
        html_body += f"""
        <p><strong>Reviewer's Comments:</strong></p>
        <div style="padding: 10px; border: 1px solid #ccc; border-radius: 4px; background-color: #f9f9f9;">
            <p>{version.reviewer_comments}</p>
        </div>
        """
    html_body += f"""
    <p>You can view the quote by clicking the link below:</p>
    <p><a href="{quote_url}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Quote</a></p>
    """
    try:
        send_email(subject=subject, recipients=[requester.email], html=html_body)
    except Exception as e:
        current_app.logger.error(f"Failed to send review outcome email to {requester.email}: {e}")
