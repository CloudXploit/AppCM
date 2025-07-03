'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RemediationAction {
  id: string;
  findingId: string;
  findingTitle: string;
  actionName: string;
  description: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedDuration: number;
  requiresApproval: boolean;
  requiresDowntime: boolean;
  steps: string[];
}

interface RemediationAttempt {
  id: string;
  findingId: string;
  actionId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  startedAt: string;
  completedAt?: string;
  executedBy: string;
  success: boolean;
  output?: string;
  error?: string;
}

export default function RemediationPage() {
  const router = useRouter();
  const [availableActions, setAvailableActions] = useState<RemediationAction[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<RemediationAttempt[]>([]);
  const [selectedAction, setSelectedAction] = useState<RemediationAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDryRun, setShowDryRun] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('user')) {
      router.push('/auth/login');
      return;
    }
    fetchRemediationData();
  }, [router]);

  const fetchRemediationData = () => {
    // Mock remediation actions
    const mockActions: RemediationAction[] = [
      {
        id: '1',
        findingId: '1',
        findingTitle: 'High CPU Usage Detected',
        actionName: 'Restart Application Pool',
        description: 'Restart the IIS application pool to clear any memory leaks or stuck processes',
        risk: 'LOW',
        estimatedDuration: 60,
        requiresApproval: false,
        requiresDowntime: true,
        steps: [
          'Stop the application pool',
          'Clear temporary files',
          'Start the application pool',
          'Verify service availability'
        ]
      },
      {
        id: '2',
        findingId: '2',
        findingTitle: 'Outdated SSL Certificate',
        actionName: 'Auto-Renew SSL Certificate',
        description: 'Automatically renew and install the SSL certificate using Let\'s Encrypt',
        risk: 'MEDIUM',
        estimatedDuration: 300,
        requiresApproval: true,
        requiresDowntime: false,
        steps: [
          'Generate new certificate request',
          'Validate domain ownership',
          'Download new certificate',
          'Install certificate',
          'Update bindings',
          'Test HTTPS connectivity'
        ]
      },
      {
        id: '3',
        findingId: '3',
        findingTitle: 'Database Connection Pool Exhaustion',
        actionName: 'Increase Connection Pool Size',
        description: 'Automatically adjust the connection pool settings to handle more concurrent connections',
        risk: 'LOW',
        estimatedDuration: 30,
        requiresApproval: false,
        requiresDowntime: false,
        steps: [
          'Backup current configuration',
          'Update connection string',
          'Restart database connections',
          'Monitor pool usage'
        ]
      },
      {
        id: '4',
        findingId: '5',
        findingTitle: 'Slow Query Performance',
        actionName: 'Create Missing Indexes',
        description: 'Analyze query execution plans and create recommended indexes',
        risk: 'MEDIUM',
        estimatedDuration: 600,
        requiresApproval: true,
        requiresDowntime: false,
        steps: [
          'Analyze query execution plans',
          'Identify missing indexes',
          'Generate CREATE INDEX statements',
          'Execute index creation',
          'Update statistics',
          'Verify query performance'
        ]
      }
    ];

    // Mock recent attempts
    const mockAttempts: RemediationAttempt[] = [
      {
        id: '1',
        findingId: '4',
        actionId: '1',
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 86340000).toISOString(),
        executedBy: 'demo',
        success: true,
        output: 'Successfully configured security headers'
      },
      {
        id: '2',
        findingId: '6',
        actionId: '2',
        status: 'FAILED',
        startedAt: new Date(Date.now() - 172800000).toISOString(),
        completedAt: new Date(Date.now() - 172740000).toISOString(),
        executedBy: 'demo',
        success: false,
        error: 'Failed to connect to remote server'
      }
    ];

    setAvailableActions(mockActions);
    setRecentAttempts(mockAttempts);
  };

  const executeRemediation = async (action: RemediationAction, dryRun: boolean = false) => {
    setIsExecuting(true);
    
    // Simulate remediation execution
    const steps = action.steps;
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Executing step ${i + 1}: ${steps[i]}`);
    }

    const newAttempt: RemediationAttempt = {
      id: Date.now().toString(),
      findingId: action.findingId,
      actionId: action.id,
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executedBy: 'demo',
      success: true,
      output: dryRun ? 'Dry run completed successfully' : 'Remediation completed successfully'
    };

    setRecentAttempts([newAttempt, ...recentAttempts]);
    setIsExecuting(false);
    setSelectedAction(null);
    setShowDryRun(false);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Remediation Center</h1>
              <p className="mt-1 text-sm text-gray-600">
                Automated fixes for detected issues
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available Remediation Actions */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Available Remediation Actions</h2>
              </div>
              <div className="divide-y">
                {availableActions.map((action) => (
                  <div key={action.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{action.actionName}</h3>
                        <p className="text-sm text-gray-600 mt-1">For: {action.findingTitle}</p>
                        <p className="text-sm text-gray-500 mt-2">{action.description}</p>
                        
                        <div className="flex items-center gap-4 mt-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(action.risk)}`}>
                            {action.risk} RISK
                          </span>
                          <span className="text-xs text-gray-500">
                            ~{action.estimatedDuration}s duration
                          </span>
                          {action.requiresApproval && (
                            <span className="text-xs text-orange-600">Requires approval</span>
                          )}
                          {action.requiresDowntime && (
                            <span className="text-xs text-red-600">Requires downtime</span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setSelectedAction(action)}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Remediation History */}
          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Recent Activity</h2>
              </div>
              <div className="divide-y">
                {recentAttempts.length === 0 ? (
                  <p className="p-6 text-gray-500 text-center">No recent activity</p>
                ) : (
                  recentAttempts.map((attempt) => (
                    <div key={attempt.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Finding #{attempt.findingId}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            By {attempt.executedBy} • {new Date(attempt.startedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(attempt.status)}`}>
                          {attempt.status}
                        </span>
                      </div>
                      {attempt.output && (
                        <p className="text-xs text-green-600 mt-2">{attempt.output}</p>
                      )}
                      {attempt.error && (
                        <p className="text-xs text-red-600 mt-2">{attempt.error}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Execution Modal */}
      {selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Execute Remediation</h3>
              <p className="text-gray-600 mt-1">{selectedAction.actionName}</p>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-medium mb-2">Execution Steps:</h4>
                <ol className="list-decimal list-inside space-y-2">
                  {selectedAction.steps.map((step, index) => (
                    <li key={index} className="text-sm text-gray-600">{step}</li>
                  ))}
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This action {selectedAction.requiresDowntime ? 'requires downtime and ' : ''}
                  has {selectedAction.risk} risk. {selectedAction.requiresApproval ? 'Approval is required.' : ''}
                </p>
              </div>

              <div className="flex items-center mb-6">
                <input
                  type="checkbox"
                  id="dryRun"
                  checked={showDryRun}
                  onChange={(e) => setShowDryRun(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="dryRun" className="text-sm text-gray-700">
                  Perform dry run first (recommended)
                </label>
              </div>

              {isExecuting && (
                <div className="mb-6">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                    <p className="text-sm text-gray-600">Executing remediation...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedAction(null);
                  setShowDryRun(false);
                }}
                disabled={isExecuting}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {showDryRun && (
                <button
                  onClick={() => executeRemediation(selectedAction, true)}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  Run Dry Test
                </button>
              )}
              <button
                onClick={() => executeRemediation(selectedAction, false)}
                disabled={isExecuting || (selectedAction.requiresApproval && !showDryRun)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Execute Remediation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}