import smtplib
from email.message import EmailMessage

from app.config import settings


def email_configured() -> bool:
    return bool(settings.smtp_user and settings.smtp_password)


def send_email(subject: str, text: str, html: str | None = None) -> None:
    """Sends a message from my Gmail to myself."""
    if not email_configured():
        raise RuntimeError("SMTP_USER and SMTP_PASSWORD are not configured")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = settings.alert_email_to or settings.smtp_user
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
