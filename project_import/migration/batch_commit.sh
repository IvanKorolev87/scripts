#!/bin/bash

# Usage: ./batch_commit.sh <batch_number> [batch_size]
# Example: ./batch_commit.sh 0 300

# Ensure at least one parameter is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <batch_number> [batch_size (default: 300)]"
    exit 1
fi

BATCH_NUMBER=$1
BATCH_SIZE=${2:-300}  # Default batch size to 300 if not provided

# Get the list of subfolders
SUBFOLDERS=($(ls -d ./export/uploads/*/ | sed 's:/$::'))

# Compute start and end indices
FROM=$((BATCH_NUMBER * BATCH_SIZE))
TO=$((FROM + BATCH_SIZE))

# Validate range
if [ "$FROM" -ge "${#SUBFOLDERS[@]}" ]; then
    echo "Error: Start index $FROM is out of bounds. Only ${#SUBFOLDERS[@]} subfolders exist."
    exit 1
fi

# Adjust TO if it exceeds the total number of subfolders
if [ "$TO" -gt "${#SUBFOLDERS[@]}" ]; then
    TO="${#SUBFOLDERS[@]}"
fi

# Select the subset of subfolders
BATCH=("${SUBFOLDERS[@]:$FROM:$((TO - FROM))}")

# Add the selected subfolders to Git
git add "${BATCH[@]}"

# Commit the changes
git commit -m "Batch commit: $FROM to $TO"

# Push to the repository
git push origin main  # Change 'main' if your branch has a different name

echo "Committed and pushed batch: $FROM to $TO"
