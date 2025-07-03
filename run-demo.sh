#!/bin/bash

echo "========================================"
echo "CM Diagnostics - Running Demo"
echo "========================================"
echo ""

# Check if Python is available for simple HTTP server
if command -v python3 &> /dev/null; then
    echo "Starting demo server..."
    echo ""
    echo "➡️  Open http://localhost:8000/standalone-demo.html in your browser"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "Starting demo server..."
    echo ""
    echo "➡️  Open http://localhost:8000/standalone-demo.html in your browser"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer 8000
else
    echo "Python not found. Opening standalone demo file directly..."
    echo ""
    
    # Try to open in default browser
    if command -v xdg-open &> /dev/null; then
        xdg-open standalone-demo.html
    elif command -v open &> /dev/null; then
        open standalone-demo.html
    elif command -v start &> /dev/null; then
        start standalone-demo.html
    else
        echo "Please open standalone-demo.html in your web browser manually."
        echo "Full path: $(pwd)/standalone-demo.html"
    fi
fi