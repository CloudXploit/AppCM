import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(json());

// Mock user data
const mockUser = {
  id: '1',
  username: 'demo',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'ADMIN'
};

// Mock systems data
const mockSystems = [
  {
    id: '1',
    name: 'Production CM',
    version: '23.4',
    edition: 'Enterprise',
    lastConnected: new Date().toISOString(),
    health: {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      issues: 2,
      score: 95
    },
    connection: {
      connected: true,
      lastError: null,
      latency: 45
    },
    database: {
      type: 'SQLSERVER',
      version: '2019',
      name: 'CM_PROD',
      server: 'sql01.corp.local'
    },
    features: ['IDOL', 'Records Manager', 'Web Client'],
    modules: ['Core', 'Workflow', 'Security']
  },
  {
    id: '2',
    name: 'Development CM',
    version: '23.4',
    edition: 'Standard',
    lastConnected: new Date(Date.now() - 3600000).toISOString(),
    health: {
      status: 'warning',
      lastCheck: new Date().toISOString(),
      issues: 8,
      score: 72
    },
    connection: {
      connected: true,
      lastError: null,
      latency: 120
    },
    database: {
      type: 'SQLSERVER',
      version: '2019',
      name: 'CM_DEV',
      server: 'sql-dev.corp.local'
    },
    features: ['Web Client'],
    modules: ['Core', 'Workflow']
  }
];

// Mock scans data
const mockScans = [
  {
    id: '1',
    name: 'Daily Health Check',
    systemId: '1',
    status: 'COMPLETED',
    progress: 100,
    triggeredBy: 'demo',
    triggerType: 'SCHEDULED',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 1800000).toISOString(),
    duration: 1800000,
    findingsCount: {
      total: 5,
      bySeverity: {
        low: 2,
        medium: 2,
        high: 1,
        critical: 0
      }
    },
    system: mockSystems[0]
  }
];

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'demo' && password === 'demo123') {
    res.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: mockUser
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  res.json({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: { ...mockUser, ...req.body }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json(mockUser);
});

// Systems endpoints
app.get('/api/systems', (req, res) => {
  res.json(mockSystems);
});

app.post('/api/systems', (req, res) => {
  const newSystem = {
    id: Date.now().toString(),
    ...req.body,
    version: '23.4',
    edition: 'Enterprise',
    lastConnected: new Date().toISOString(),
    health: {
      status: 'unknown',
      lastCheck: new Date().toISOString(),
      issues: 0,
      score: 100
    },
    connection: {
      connected: false,
      lastError: null,
      latency: null
    },
    features: [],
    modules: []
  };
  mockSystems.push(newSystem);
  res.status(201).json(newSystem);
});

// Diagnostics endpoints
app.get('/api/diagnostics/scans', (req, res) => {
  res.json({
    data: mockScans,
    pagination: {
      page: 1,
      limit: 20,
      total: mockScans.length,
      totalPages: 1
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      database: 'connected',
      redis: 'connected'
    }
  });
});

// GraphQL endpoint (mock)
app.post('/graphql', (req, res) => {
  const { query } = req.body;
  
  // Simple mock GraphQL responses
  if (query.includes('GetSystems')) {
    res.json({
      data: {
        systems: mockSystems
      }
    });
  } else if (query.includes('DashboardStats')) {
    res.json({
      data: {
        systems: mockSystems,
        statistics: {
          totalScans: 24,
          totalFindings: 45,
          totalRemediations: 12,
          averageScanDuration: 1800,
          healthScoreTrend: [
            { date: new Date(Date.now() - 6 * 24 * 3600000).toISOString(), value: 85 },
            { date: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), value: 87 },
            { date: new Date(Date.now() - 4 * 24 * 3600000).toISOString(), value: 82 },
            { date: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), value: 88 },
            { date: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), value: 90 },
            { date: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), value: 92 },
            { date: new Date().toISOString(), value: 95 }
          ],
          topFindings: [
            { ruleId: 'perf-001', ruleName: 'High CPU Usage', count: 8 },
            { ruleId: 'sec-002', ruleName: 'Weak Password Policy', count: 6 },
            { ruleId: 'conf-003', ruleName: 'Missing Backup', count: 5 }
          ]
        },
        scans: mockScans.slice(0, 5),
        findings: [
          {
            id: '1',
            title: 'High CPU usage detected',
            systemId: '1',
            severity: 'CRITICAL',
            category: 'PERFORMANCE',
            detectedAt: new Date().toISOString(),
            remediable: true
          }
        ]
      }
    });
  } else if (query.includes('GetScans')) {
    res.json({
      data: {
        scans: mockScans,
        systems: mockSystems
      }
    });
  } else {
    res.json({ data: {} });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Mock API server ready at http://localhost:${PORT}`);
  console.log(`📝 Login with username: demo, password: demo123`);
});