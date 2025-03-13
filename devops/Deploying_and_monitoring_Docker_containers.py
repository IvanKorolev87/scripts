#The Python script automates the startup of Docker containers, checks their status, and restarts them if the container has crashed"

import subprocess
import smtplib
from email.mime.text import MIMEText

# Notification settings
EMAIL_FROM = 'your-email@example.com'
EMAIL_TO = 'admin@example.com'
SMTP_SERVER = 'smtp.example.com'
SMTP_PORT = 587
SMTP_USER = 'your-email@example.com'
SMTP_PASSWORD = 'your-password'

# Function to send email
def send_email(subject, message):
    msg = MIMEText(message)
    msg['Subject'] = subject
    msg['From'] = EMAIL_FROM
    msg['To'] = EMAIL_TO

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())

# Function to start a Docker container
def start_container(container_name, image_name):
    try:
        subprocess.run(['docker', 'run', '-d', '--name', container_name, image_name], check=True)
        print(f"Container {container_name} started successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to start container {container_name}: {e}")
        send_email(f"Failed to start {container_name}", f"Error: {e}")

# Function to check the container's status
def check_container(container_name):
    try:
        result = subprocess.run(['docker', 'inspect', '-f', '{{.State.Running}}', container_name], capture_output=True, text=True)
        return result.stdout.strip() == 'true'
    except subprocess.CalledProcessError as e:
        print(f"Failed to check status of {container_name}: {e}")
        return False

# Function to restart the container if it is down
def restart_container_if_down(container_name):
    if not check_container(container_name):
        print(f"Container {container_name} is down. Restarting...")
        send_email(f"Container {container_name} down", f"Attempting to restart {container_name}.")
        try:
            subprocess.run(['docker', 'restart', container_name], check=True)
            print(f"Container {container_name} restarted successfully.")
        except subprocess.CalledProcessError as e:
            print(f"Failed to restart container {container_name}: {e}")
            send_email(f"Failed to restart {container_name}", f"Error: {e}")

# Main function
def manage_containers(containers):
    for container_name, image_name in containers.items():
        if not check_container(container_name):
            start_container(container_name, image_name)
        restart_container_if_down(container_name)

if __name__ == "__main__":
    # List of con
