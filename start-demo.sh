#!/bin/bash

echo "========================================"
echo "CM Diagnostics Demo Application"
echo "========================================"
echo ""
echo "Starting the application..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (this may take a few minutes)..."
    npm install --legacy-peer-deps --force || {
        echo "⚠️  Some dependencies failed to install, but continuing..."
    }
fi

# Navigate to web app
cd apps/web

# Check if node_modules exists in web app
if [ ! -d "node_modules" ]; then
    echo "📦 Installing web app dependencies..."
    npm install --legacy-peer-deps --force || {
        echo "⚠️  Some dependencies failed to install, but continuing..."
    }
fi

echo ""
echo "🚀 Starting development server..."
echo ""
echo "➡️  Open http://localhost:3000 in your browser"
echo "➡️  Click 'Launch Demo Application' to see the CM Diagnostics interface"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev