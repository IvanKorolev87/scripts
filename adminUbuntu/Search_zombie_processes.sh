#a script that finds zombie processes, collects information about them and their parent processes, and then sends this information by email

#!/bin/bash

# Settings for sending email
EMAIL="youremail@example.com"
SUBJECT="Zombie Process Alert"
LOG_FILE="/tmp/zombie_processes.log"

# Function to send email
send_email() {
    local message=$1
    echo -e "$message" | mail -s "$SUBJECT" "$EMAIL"
}

# Search for zombie processes
zombies=$(ps aux | awk '{ if ($8 == "Z") print $0 }')

# If zombie processes are found
if [ ! -z "$zombies" ]; then
    echo "Zombie processes found:" > $LOG_FILE
    echo "$zombies" >> $LOG_FILE

    # Get information about the parent processes of zombies
    echo -e "\nParent processes info:" >> $LOG_FILE
    for pid in $(ps aux | awk '{ if ($8 == "Z") print $2 }'); do
        parent_pid=$(ps -o ppid= -p $pid)
        parent_info=$(ps -p $parent_pid -o pid,ppid,cmd)
        echo "Zombie PID: $pid, Parent PID: $parent_pid" >> $LOG_FILE
        echo "Parent Process Info: $parent_info" >> $LOG_FILE
    done

    # Send email with the log
    send_email "$(cat $LOG_FILE)"
else
    echo "No zombie processes found."
fi
