# Backup and sync folder

#!/bin/bash

SOURCE_DIR="/path/to/source"
BACKUP_DIR="/path/to/backup"
LOG_FILE="/var/log/backup.log"

# Использование rsync для синхронизации данных
rsync -avh --delete $SOURCE_DIR $BACKUP_DIR > $LOG_FILE 2>&1

# Проверка результата выполнения rsync
if [ $? -eq 0 ]; then
    echo "Backup completed successfully on $(date)" >> $LOG_FILE
else
    echo "Backup failed on $(date)" >> $LOG_FILE
fi
