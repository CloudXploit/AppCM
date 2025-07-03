'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  systemId: string;
  systemName: string;
  detectedAt: string;
  resolved: boolean;
  remediable: boolean;
  component: string;
  impact: string;
  recommendation: string;
}

export default function FindingsPage() {
  const router = useRouter();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filteredFindings, setFilteredFindings] = useState<Finding[]>([]);
  const [filters, setFilters] = useState({
    severity: 'all',
    category: 'all',
    status: 'all',
    search: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check auth
    if (!localStorage.getItem('user')) {
      router.push('/auth/login');
      return;
    }
    fetchFindings();
  }, [router]);

  useEffect(() => {
    applyFilters();
  }, [filters, findings]);

  const fetchFindings = async () => {
    setIsLoading(true);
    try {
      // Mock findings data
      const mockFindings: Finding[] = [
        {
          id: '1',
          title: 'High CPU Usage Detected',
          description: 'CPU usage has been consistently above 90% for the last hour',
          severity: 'CRITICAL',
          category: 'PERFORMANCE',
          systemId: '1',
          systemName: 'Production CM',
          detectedAt: new Date(Date.now() - 3600000).toISOString(),
          resolved: false,
          remediable: true,
          component: 'Application Server',
          impact: 'System performance degradation affecting user experience',
          recommendation: 'Investigate running processes and consider scaling resources'
        },
        {
          id: '2',
          title: 'Outdated SSL Certificate',
          description: 'SSL certificate will expire in 30 days',
          severity: 'HIGH',
          category: 'SECURITY',
          systemId: '1',
          systemName: 'Production CM',
          detectedAt: new Date(Date.now() - 7200000).toISOString(),
          resolved: false,
          remediable: true,
          component: 'Web Server',
          impact: 'Potential security vulnerability and browser warnings',
          recommendation: 'Renew SSL certificate before expiration'
        },
        {
          id: '3',
          title: 'Database Connection Pool Exhaustion',
          description: 'Connection pool is at 95% capacity',
          severity: 'HIGH',
          category: 'PERFORMANCE',
          systemId: '2',
          systemName: 'Development CM',
          detectedAt: new Date(Date.now() - 1800000).toISOString(),
          resolved: false,
          remediable: true,
          component: 'Database',
          impact: 'Potential connection failures for new requests',
          recommendation: 'Increase connection pool size or optimize queries'
        },
        {
          id: '4',
          title: 'Missing Security Headers',
          description: 'Important security headers are not configured',
          severity: 'MEDIUM',
          category: 'SECURITY',
          systemId: '2',
          systemName: 'Development CM',
          detectedAt: new Date(Date.now() - 86400000).toISOString(),
          resolved: true,
          remediable: true,
          component: 'Web Server',
          impact: 'Reduced protection against common web vulnerabilities',
          recommendation: 'Configure X-Frame-Options, X-Content-Type-Options headers'
        },
        {
          id: '5',
          title: 'Slow Query Performance',
          description: 'Multiple queries taking over 5 seconds to execute',
          severity: 'MEDIUM',
          category: 'PERFORMANCE',
          systemId: '1',
          systemName: 'Production CM',
          detectedAt: new Date(Date.now() - 3600000).toISOString(),
          resolved: false,
          remediable: true,
          component: 'Database',
          impact: 'Degraded application response times',
          recommendation: 'Add missing indexes and optimize query execution plans'
        }
      ];
      setFindings(mockFindings);
    } catch (error) {
      console.error('Failed to fetch findings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...findings];

    // Filter by severity
    if (filters.severity !== 'all') {
      filtered = filtered.filter(f => f.severity === filters.severity);
    }

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(f => f.category === filters.category);
    }

    // Filter by status
    if (filters.status === 'active') {
      filtered = filtered.filter(f => !f.resolved);
    } else if (filters.status === 'resolved') {
      filtered = filtered.filter(f => f.resolved);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(f => 
        f.title.toLowerCase().includes(searchLower) ||
        f.description.toLowerCase().includes(searchLower) ||
        f.systemName.toLowerCase().includes(searchLower) ||
        f.component.toLowerCase().includes(searchLower)
      );
    }

    setFilteredFindings(filtered);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'PERFORMANCE': return 'bg-purple-100 text-purple-800';
      case 'SECURITY': return 'bg-red-100 text-red-800';
      case 'CONFIGURATION': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: findings.length,
    active: findings.filter(f => !f.resolved).length,
    critical: findings.filter(f => f.severity === 'CRITICAL' && !f.resolved).length,
    remediable: findings.filter(f => f.remediable && !f.resolved).length
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading findings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Findings</h1>
              <p className="mt-1 text-sm text-gray-600">
                Detected issues across all your Content Manager systems
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Findings</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active Issues</div>
            <div className="mt-2 text-3xl font-semibold text-orange-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Critical</div>
            <div className="mt-2 text-3xl font-semibold text-red-600">{stats.critical}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Auto-fixable</div>
            <div className="mt-2 text-3xl font-semibold text-green-600">{stats.remediable}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="PERFORMANCE">Performance</option>
                <option value="SECURITY">Security</option>
                <option value="CONFIGURATION">Configuration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search findings..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Findings List */}
        <div className="space-y-4">
          {filteredFindings.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No findings match your filters</p>
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <div key={finding.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(finding.severity)}`}>
                          {finding.severity}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(finding.category)}`}>
                          {finding.category}
                        </span>
                        {finding.resolved && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            RESOLVED
                          </span>
                        )}
                        {finding.remediable && !finding.resolved && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            AUTO-FIXABLE
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {finding.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-3">{finding.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">System:</span>
                          <p className="font-medium">{finding.systemName}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Component:</span>
                          <p className="font-medium">{finding.component}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Detected:</span>
                          <p className="font-medium">
                            {new Date(finding.detectedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Impact:</span>
                          <p className="font-medium text-orange-600">High</p>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Impact:</strong> {finding.impact}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                          <strong>Recommendation:</strong> {finding.recommendation}
                        </p>
                      </div>
                    </div>
                    
                    {!finding.resolved && (
                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/findings/${finding.id}`)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          View Details
                        </button>
                        {finding.remediable && (
                          <button
                            onClick={() => router.push(`/dashboard/remediation/${finding.id}`)}
                            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Auto-Fix
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}