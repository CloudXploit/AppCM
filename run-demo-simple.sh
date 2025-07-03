#!/bin/bash

echo "🚀 CM Diagnostics - Simple Demo Runner"
echo "====================================="
echo ""

# Start a simple HTTP server for the standalone demo
echo "📋 Starting standalone demo server..."
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3 HTTP server"
    echo "📌 Opening http://localhost:8000/demo-standalone.html"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Using Python 2 SimpleHTTPServer"
    echo "📌 Opening http://localhost:8000/demo-standalone.html"
    echo ""
    python -m SimpleHTTPServer 8000
elif command -v node &> /dev/null; then
    echo "✅ Using Node.js HTTP server"
    cat > simple-server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './demo-standalone.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(8000, () => {
  console.log('Server running at http://localhost:8000/');
  console.log('📌 Open http://localhost:8000/demo-standalone.html in your browser');
  console.log('🛑 Press Ctrl+C to stop');
});
EOF
    node simple-server.js
else
    echo "❌ No HTTP server available (Python or Node.js required)"
    echo ""
    echo "You can still open the demo directly:"
    echo "  1. Navigate to the project directory"
    echo "  2. Open demo-standalone.html in your browser"
    exit 1
fi