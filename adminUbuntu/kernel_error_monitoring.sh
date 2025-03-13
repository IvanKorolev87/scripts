#script, monitors kernel errors associated with killing a process due to lack of memory (OOM - Out Of Memory), and sends a message if the system kills #the same process three times in a row

#!/bin/bash

# Email settings
EMAIL="youremail@example.com"
SUBJECT="OOM Killer Alert"
LOG_FILE="/tmp/oom_killer.log"

# Function to send email
send_email() {
    local message=$1
    echo -e "$message" | mail -s "$SUBJECT" "$EMAIL"
}

# Function to monitor OOM Killer messages
monitor_oom() {
    # Searching for OOM messages in system logs
    messages=$(grep -i 'killed process' /var/log/syslog | tail -n 100)

    # Check if the same process has been killed three times in the last 100 lines of syslog
    process_count=$(echo "$messages" | grep -oP 'killed process \K\d+' | sort | uniq -c | awk '$1 >= 3 {print $2}')

    # If a process is found that was killed 3 or more times
    if [ ! -z "$process_count" ]; then
        echo "Process killed 3 times in a row due to OOM:" >> $LOG_FILE
        echo "Process ID: $process_count" >> $LOG_FILE
        send_email "The process with PID $process_count has been killed 3 times in a row due to out of memory issues." "$(cat $LOG_FILE)"
    else
        echo "No processes killed by OOM killer 3 times in a row."
    fi
}

# Main monitoring loop
while true; do
    monitor_oom
    sleep 60  # Check every minute
done
