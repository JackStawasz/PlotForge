#!/bin/bash

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    printf "Creating virtual environment..."
    python3 -m venv venv
    printf " Done\n"
fi
printf "Activating virtual environment..."
source venv/bin/activate
printf " Done\n"

# Only reinstall if requirements.txt has changed
HASH_FILE="venv/.req_hash"
REQ_PATH=$(find . -type f -iname "requirements.txt" | head -n 1)
CURRENT_HASH=$(md5sum "$REQ_PATH" | awk '{print $1}')

if [ ! -f "$HASH_FILE" ] || [ "$CURRENT_HASH" != "$(cat $HASH_FILE)" ]; then
    printf "Installing dependencies..."
    pip3 install -r "$REQ_PATH" --quiet
    echo "$CURRENT_HASH" > "$HASH_FILE"
    printf " Done\n"
fi

# Start the server
printf "Starting server...\n"
python3 src/app.py
