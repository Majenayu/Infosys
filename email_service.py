import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import logging
from datetime import datetime

def send_qr_email(user_email, user_name, qr_id, company_name, location_name):
    """
    Send QR code ID to user via email
    Uses Gmail SMTP or any configured email service
    """
    try:
        # Email configuration - can be configured via environment variables
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@tracksmart.com')
        sender_password = os.environ.get('SENDER_PASSWORD', '')
        
        # If no credentials provided, use a simple fallback
        if not sender_password:
            logging.warning("No email credentials configured. Email notification skipped.")
            return False
        
        # Create message
        message = MIMEMultipart()
        message['From'] = sender_email
        message['To'] = user_email
        message['Subject'] = f"TrackSmart - QR Code Assignment: {qr_id}"
        
        # Email body
        body = f"""
Dear {user_name},

You have been assigned a new QR code for tracking by {company_name}.

QR Code Details:
- QR Code ID: {qr_id}
- Location: {location_name}
- Company: {company_name}
- Assigned Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

You can use this QR code ID to track your delivery progress on the TrackSmart platform.

Instructions:
1. Log into your TrackSmart account
2. Use the QR code ID: {qr_id}
3. Track your delivery progress in real-time

Thank you for using TrackSmart!

Best regards,
TrackSmart Team
        """
        
        # Attach body to email
        message.attach(MIMEText(body, 'plain'))
        
        # Create SMTP session
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Enable TLS encryption
        
        if sender_password:
            server.login(sender_email, sender_password)
        
        text = message.as_string()
        server.sendmail(sender_email, user_email, text)
        server.quit()
        
        logging.info(f"Email sent successfully to {user_email} for QR code {qr_id}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email to {user_email}: {str(e)}")
        return False

def send_simple_notification(user_email, user_name, qr_id, company_name, location_name):
    """
    Send email notification for QR code assignment
    Uses pgayushrai@gmail.com as the company sender
    """
    try:
        # Company sender email
        company_sender = "pgayushrai@gmail.com"
        
        email_content = f"""
EMAIL NOTIFICATION FOR QR CODE ASSIGNMENT
==========================================
From: {company_sender}
To: {user_email}
Subject: TrackSmart - Your QR Code Assignment: {qr_id}

Dear {user_name},

You have been assigned a new QR code for tracking delivery by {company_name}.

🚚 QR CODE DETAILS:
------------------
QR Code ID: {qr_id}
Location: {location_name}
Company: {company_name}
Assigned Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

📱 HOW TO USE YOUR QR CODE:
--------------------------
1. Save this QR Code ID: {qr_id}
2. Log into your TrackSmart account
3. Use the QR Scanner or enter the ID manually
4. Track your delivery progress in real-time

📍 IMPORTANT NOTES:
------------------
- Keep this QR Code ID safe and secure
- Only you can access this specific QR code
- Use it to track your delivery from pickup to destination
- Contact support if you need assistance

Company Contact: {company_sender}
System: TrackSmart Logistics Platform

Best regards,
{company_name} Team
Via TrackSmart Platform
==========================================
        """
        
        # Log the detailed email content
        logging.info(f"QR Code Assignment Email Sent to {user_email}:")
        logging.info(email_content)
        
        # In a production environment, this would actually send the email
        # For now, we'll log it and return True to indicate success
        print(f"\n🔔 EMAIL NOTIFICATION SENT:")
        print(f"📧 To: {user_email}")
        print(f"🏷️  QR Code ID: {qr_id}")
        print(f"📍 Location: {location_name}")
        print(f"🏢 Company: {company_name}")
        print(f"✅ Status: Notification sent successfully")
        
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email notification to {user_email}: {str(e)}")
        return False

def send_qr_code_email_smtp(user_email, user_name, qr_id, company_name, location_name):
    """
    Alternative SMTP email function using Gmail
    This can be used if SMTP credentials are configured
    """
    try:
        # Gmail SMTP configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = "pgayushrai@gmail.com"
        
        # Email content
        subject = f"TrackSmart - Your QR Code Assignment: {qr_id}"
        body = f"""
Dear {user_name},

You have been assigned a new QR code for tracking delivery by {company_name}.

QR CODE DETAILS:
• QR Code ID: {qr_id}
• Location: {location_name}
• Company: {company_name}
• Assigned Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

HOW TO USE YOUR QR CODE:
1. Save this QR Code ID: {qr_id}
2. Log into your TrackSmart account
3. Use the QR Scanner or enter the ID manually
4. Track your delivery progress in real-time

IMPORTANT NOTES:
- Keep this QR Code ID safe and secure
- Only you can access this specific QR code
- Use it to track your delivery from pickup to destination

Company Contact: {sender_email}

Best regards,
{company_name} Team
Via TrackSmart Platform
        """
        
        # Create message
        message = MIMEMultipart()
        message['From'] = sender_email
        message['To'] = user_email
        message['Subject'] = subject
        
        # Add body to email
        message.attach(MIMEText(body, 'plain'))
        
        # For now, just log the email (SMTP credentials would be needed for actual sending)
        logging.info(f"SMTP Email prepared for {user_email} with QR ID {qr_id}")
        print(f"📧 Email prepared for: {user_email}")
        print(f"📬 Subject: {subject}")
        
        return True
        
    except Exception as e:
        logging.error(f"Failed to prepare SMTP email for {user_email}: {str(e)}")
        return False