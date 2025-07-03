#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // API Routes
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (pathname === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Mock auth endpoint
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200);
        res.end(JSON.stringify({
          token: 'demo-token-' + Date.now(),
          user: { email: 'demo@example.com', name: 'Demo User' }
        }));
      });
      return;
    }

    // Mock metrics
    if (pathname.match(/^\/api\/monitoring\/metrics/)) {
      res.writeHead(200);
      res.end(JSON.stringify({
        cpu: { usage: Math.random() * 0.8 },
        memory: { usagePercent: Math.random() * 0.7 },
        disk: { usagePercent: Math.random() * 0.6 }
      }));
      return;
    }

    // 404 for unknown API routes
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  // Serve static files
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, 'public', pathname);
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'text/plain';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Try to serve index.html for SPA routing
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content) => {
          if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(content);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Error: ' + error.code);
      }
    } else {
      res.setHeader('Content-Type', contentType);
      res.writeHead(200);
      res.end(content);
    }
  });
});

// Simple WebSocket implementation
const clients = new Set();

server.on('upgrade', (request, socket, head) => {
  // Simple WebSocket handshake
  const key = request.headers['sec-websocket-key'];
  const acceptKey = require('crypto')
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n');

  socket.write(responseHeaders);
  clients.add(socket);

  socket.on('close', () => {
    clients.delete(socket);
  });

  // Send periodic updates
  const interval = setInterval(() => {
    if (socket.readyState === 'open') {
      const frame = Buffer.alloc(2);
      frame[0] = 0x81; // FIN + text frame
      frame[1] = 0x02; // payload length
      socket.write(Buffer.concat([frame, Buffer.from('{}')]));
    }
  }, 5000);

  socket.on('close', () => clearInterval(interval));
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 CM Diagnostics Server Running!                          ║
║                                                               ║
║   🌐 URL: http://localhost:${PORT}                              ║
║   📊 Dashboard: http://localhost:${PORT}/                        ║
║   🔧 API: http://localhost:${PORT}/api                          ║
║                                                               ║
║   ✨ All features are available in demo mode                 ║
║   🔄 Real-time updates are simulated                         ║
║                                                               ║
║   Press Ctrl+C to stop the server                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});