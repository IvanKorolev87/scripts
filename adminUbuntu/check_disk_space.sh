#script monitors disk space usage and sends an alert if less than 25% of the disk space is available, along with monitoring CPU and memory usage

#!/bin/bash

# Settings
EMAIL="youremail@example.com"  # Your email address
THRESHOLD=25  # Threshold percentage
LOG_FILE="/tmp/disk_usage.log"  # Log file to record status
SUBJECT="Disk Space Alert"

# Get the disk usage for the root partition
disk_usage=$(df / | grep / | awk '{ print $5 }' | sed 's/%//g')

# Log the current disk usage
echo "$(date) - Disk space used: $disk_usage%" >> $LOG_FILE

# Check if less than 25% disk space is available
if [ $disk_usage -ge $((100 - THRESHOLD)) ]; then
    # Send email alert
    echo "Warning: Less than 25% disk space remaining on the root partition!" | mail -s "$SUBJECT" "$EMAIL"
    echo "$(date) - Warning: Less than 25% disk space remaining." >> $LOG_FILE
fi

# Monitor CPU and memory usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
MEMORY_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
DISK_USAGE=$(df / | grep / | awk '{ print $5 }' | sed 's/%//g')

# Thresholds for CPU, memory, and disk usage
CPU_THRESHOLD=90
MEMORY_THRESHOLD=90
DISK_THRESHOLD=90

# Log the current usage
echo "$(date) - CPU usage: $CPU_USAGE%" >> $LOG_FILE
echo "$(date) - Memory usage: $MEMORY_USAGE%" >> $LOG_FILE
echo "$(date) - Disk usage: $DISK_USAGE%" >> $LOG_FILE

# Check if CPU usage is above the threshold
if (( $(echo "$CPU_USAGE > $CPU_THRESHOLD" | bc -l) )); then
    echo "$(date) - WARNING: CPU usage is above $CPU_THRESHOLD%" | mail -s "$SUBJECT" "$EMAIL"
    echo "$(date) - WARNING: CPU usage is above $CPU_THRESHOLD%" >> $LOG_FILE
fi

# Check if memory usage is above the threshold
if (( $(echo "$MEMORY_USAGE > $MEMORY_THRESHOLD" | bc -l) )); then
    echo "$(date) - WARNING: Memory usage is above $MEMORY_THRESHOLD%" | mail -s "$SUBJECT" "$EMAIL"
    echo "$(date) - WARNING: Memory usage is above $MEMORY_THRESHOLD%" >> $LOG_FILE
fi

# Check if disk usage is above the threshold
if [ $DISK_USAGE -ge $DISK_THRESHOLD ]; then
    echo "$(date) - WARNING: Disk usage is above $DISK_THRESHOLD%" | mail -s "$SUBJECT" "$EMAIL"
    echo "$(date) - WARNING: Disk usage is above $DISK_THRESHOLD%" >> $LOG_FILE
fi
