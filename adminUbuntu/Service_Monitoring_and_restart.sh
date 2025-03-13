#A script for monitoring services, automatically restarting them, and sending an email notification if the service does not start after two attempts"

#!/bin/bash

# Email settings
EMAIL="youremail@example.com"
SUBJECT="Service Restart Failure"
LOG_FILE="/tmp/service_monitor.log"

# List of services to monitor
SERVICES=("nginx" "mysql")

# Number of restart attempts
MAX_RETRIES=2

# Function to send email
send_email() {
    local service=$1
    local message=$2
    echo -e "$message" | mail -s "$service $SUBJECT" "$EMAIL"
}

# Function to check the service status
check_service() {
    local service=$1
    systemctl is-active --quiet $service
}

# Function to restart the service
restart_service() {
    local service=$1
    echo "Restarting $service..." >> $LOG_FILE
    systemctl restart $service
}

# Function to monitor and restart services
monitor_services() {
    for service in "${SERVICES[@]}"; do
        retries=0

        # Check if the service is active
        if ! check_service $service; then
            echo "$service is down, attempting to restart..." >> $LOG_FILE

            while [ $retries -lt $MAX_RETRIES ]; do
                # Restart the service
                restart_service $service

                # Wait before rechecking
                sleep 5

                # Check if the service was successfully restarted
                if check_service $service; then
                    echo "$service successfully restarted." >> $LOG_FILE
                    break
                else
                    retries=$((retries + 1))
                    echo "$service restart attempt $retries failed." >> $LOG_FILE
                fi
            done

            # If the service fails to restart after two attempts, send a notification
            if [ $retries -eq $MAX_RETRIES ]; then
                echo "$service failed to restart after $MAX_RETRIES attempts." >> $LOG_FILE
                send_email $service "Service $service failed to restart after $MAX_RETRIES attempts. Manual intervention required."
            fi
        fi
    done
}

# Main monitoring function
monitor_services
