#!/bin/bash

echo "Starting CM Diagnostics Application..."
echo ""

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use. Using port 3001 instead."
    export PORT=3001
else
    export PORT=3000
fi

# Start the server
echo "🚀 Starting server on port $PORT..."
node standalone-server.js