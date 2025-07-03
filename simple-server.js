#!/usr/bin/env node

const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (Mock for demo)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mock auth endpoint
app.post('/api/auth/login', (req, res) => {
  res.json({
    token: 'demo-token-' + Date.now(),
    user: {
      email: req.body.email,
      name: 'Demo User'
    }
  });
});

// Mock monitoring endpoint
app.get('/api/monitoring/metrics/:systemId', (req, res) => {
  res.json({
    cpu: {
      usage: Math.random() * 0.8,
      cores: 4
    },
    memory: {
      usagePercent: Math.random() * 0.7,
      total: 16 * 1024 * 1024 * 1024,
      free: 8 * 1024 * 1024 * 1024
    },
    disk: {
      usagePercent: Math.random() * 0.6
    }
  });
});

// Mock diagnostics endpoint
app.post('/api/diagnostics/run', (req, res) => {
  setTimeout(() => {
    res.json({
      id: 'diag-' + Date.now(),
      systemId: req.body.systemId,
      status: 'completed',
      findings: [
        {
          id: 'finding-1',
          title: 'High Memory Usage',
          severity: 'warning',
          category: 'performance',
          description: 'Memory usage is above 80% threshold'
        },
        {
          id: 'finding-2',
          title: 'Security Updates Available',
          severity: 'info',
          category: 'security',
          description: '3 security patches are available'
        }
      ]
    });
  }, 1000);
});

// Mock analytics data
app.get('/api/analytics/dashboards', (req, res) => {
  res.json({
    dashboards: [
      {
        id: 'dash-1',
        name: 'System Performance',
        type: 'performance',
        widgets: []
      }
    ]
  });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
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
║   Press Ctrl+C to stop the server                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Simple WebSocket support
try {
  const { Server: SocketIOServer } = require('socket.io');
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('WebSocket client connected:', socket.id);
    
    // Send periodic metrics
    const metricsInterval = setInterval(() => {
      socket.emit('metrics', {
        cpu: { usage: Math.random() * 0.8 },
        memory: { usagePercent: Math.random() * 0.7 }
      });
    }, 5000);

    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected:', socket.id);
      clearInterval(metricsInterval);
    });
  });
} catch (e) {
  console.log('WebSocket support not available - continuing without real-time updates');
}

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});