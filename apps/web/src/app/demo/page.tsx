'use client';

import { useState, useEffect } from 'react';

// Demo page to showcase CM Diagnostics functionality
export default function DemoPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Simulate connection to CM system
  const simulateConnection = () => {
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('connected');
      setSystemInfo({
        version: '23.4.1.9012',
        edition: 'Enterprise',
        database: 'SQL Server 2019',
        features: ['Records Management', 'IDOL Integration', 'Enterprise Studio']
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">CM Diagnostics</h1>
              <span className="ml-3 text-sm text-gray-500">v0.1.0</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {connectionStatus === 'connected' ? '● Connected' :
                 connectionStatus === 'connecting' ? '◐ Connecting...' :
                 '○ Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Panel */}
        {connectionStatus === 'disconnected' && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Connect to Content Manager</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Type
                </label>
                <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                  <option>Direct Database (SQL Server)</option>
                  <option>Direct Database (Oracle)</option>
                  <option>REST API</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Host
                </label>
                <input
                  type="text"
                  placeholder="localhost"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Database/URL
                </label>
                <input
                  type="text"
                  placeholder="ContentManager"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="cm_user"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={simulateConnection}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Connect
            </button>
          </div>
        )}

        {/* Connected View */}
        {connectionStatus === 'connected' && systemInfo && (
          <>
            {/* System Info Card */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">System Information</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Version</p>
                  <p className="font-semibold">{systemInfo.version}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Edition</p>
                  <p className="font-semibold">{systemInfo.edition}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Database</p>
                  <p className="font-semibold">{systemInfo.database}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Features</p>
                  <p className="font-semibold">{systemInfo.features.length} Active</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {['overview', 'diagnostics', 'users', 'performance'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'diagnostics' && <DiagnosticsTab />}
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'performance' && <PerformanceTab />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Overview Tab Component
function OverviewTab() {
  const stats = [
    { label: 'Total Records', value: '1,234,567', change: '+2.3%' },
    { label: 'Active Users', value: '389', change: '+12' },
    { label: 'Storage Used', value: '2.4 TB', change: '+0.1 TB' },
    { label: 'System Health', value: '98%', change: '+3%' }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
            <p className="text-sm text-green-600 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { time: '2 minutes ago', event: 'User john.doe logged in', type: 'info' },
            { time: '15 minutes ago', event: 'Backup completed successfully', type: 'success' },
            { time: '1 hour ago', event: 'High memory usage detected (85%)', type: 'warning' },
            { time: '2 hours ago', event: 'System configuration updated', type: 'info' }
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{activity.event}</p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                activity.type === 'success' ? 'bg-green-100 text-green-800' :
                activity.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {activity.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Diagnostics Tab Component
function DiagnosticsTab() {
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);

  const runDiagnostics = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setIssues([
        {
          severity: 'high',
          category: 'Performance',
          issue: 'Database query timeout threshold too low',
          recommendation: 'Increase timeout from 30s to 60s',
          autoFix: true
        },
        {
          severity: 'medium',
          category: 'Security',
          issue: 'Password policy allows weak passwords',
          recommendation: 'Enable complex password requirements',
          autoFix: true
        },
        {
          severity: 'low',
          category: 'Configuration',
          issue: 'Audit log retention set to 30 days',
          recommendation: 'Consider increasing to 90 days for compliance',
          autoFix: false
        }
      ]);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">System Diagnostics</h3>
          <button
            onClick={runDiagnostics}
            disabled={scanning}
            className={`px-4 py-2 rounded-md transition-colors ${
              scanning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </button>
        </div>

        {scanning && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Analyzing system configuration...</p>
          </div>
        )}

        {!scanning && issues.length > 0 && (
          <div className="space-y-4">
            {issues.map((issue, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                        issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">{issue.category}</span>
                    </div>
                    <p className="font-medium">{issue.issue}</p>
                    <p className="text-sm text-gray-600 mt-1">{issue.recommendation}</p>
                  </div>
                  {issue.autoFix && (
                    <button className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                      Auto Fix
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Users Tab Component
function UsersTab() {
  const users = [
    { username: 'admin', name: 'System Administrator', type: 'Admin', status: 'Active', lastLogin: '10 minutes ago' },
    { username: 'john.doe', name: 'John Doe', type: 'User', status: 'Active', lastLogin: '2 hours ago' },
    { username: 'jane.smith', name: 'Jane Smith', type: 'User', status: 'Active', lastLogin: '1 day ago' },
    { username: 'service.account', name: 'Service Account', type: 'System', status: 'Active', lastLogin: 'Never' }
  ];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold">User Management</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Login
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.username} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.username}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.type === 'Admin' ? 'bg-purple-100 text-purple-800' :
                  user.type === 'System' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {user.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  {user.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.lastLogin}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Performance Tab Component
function PerformanceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold mb-4">Resource Usage</h4>
          <div className="space-y-4">
            {[
              { label: 'CPU Usage', value: 35, color: 'bg-green-500' },
              { label: 'Memory Usage', value: 62, color: 'bg-yellow-500' },
              { label: 'Disk I/O', value: 28, color: 'bg-green-500' },
              { label: 'Network I/O', value: 45, color: 'bg-green-500' }
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{metric.label}</span>
                  <span className="font-medium">{metric.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${metric.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${metric.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold mb-4">Database Performance</h4>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Active Connections</span>
              <span className="font-medium">127 / 500</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Query Cache Hit Rate</span>
              <span className="font-medium">94.2%</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Avg Query Time</span>
              <span className="font-medium">124ms</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-600">Deadlocks (24h)</span>
              <span className="font-medium">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}