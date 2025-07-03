'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Report {
  id: string;
  name: string;
  type: 'HEALTH' | 'DIAGNOSTIC' | 'COMPLIANCE' | 'EXECUTIVE';
  systemId: string;
  systemName: string;
  generatedAt: string;
  generatedBy: string;
  format: 'PDF' | 'EXCEL' | 'JSON';
  size: number;
  status: 'GENERATING' | 'READY' | 'FAILED';
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    type: 'HEALTH',
    systemId: 'all',
    format: 'PDF',
    dateRange: 'last30days',
    includeFindings: true,
    includeRemediation: true,
    includeTrends: true
  });

  useEffect(() => {
    if (!localStorage.getItem('user')) {
      router.push('/auth/login');
      return;
    }
    fetchReports();
  }, [router]);

  const fetchReports = () => {
    // Mock reports data
    const mockReports: Report[] = [
      {
        id: '1',
        name: 'Monthly Health Report - November 2024',
        type: 'HEALTH',
        systemId: '1',
        systemName: 'Production CM',
        generatedAt: new Date(Date.now() - 86400000).toISOString(),
        generatedBy: 'demo',
        format: 'PDF',
        size: 2457600, // 2.4MB
        status: 'READY'
      },
      {
        id: '2',
        name: 'Security Compliance Report',
        type: 'COMPLIANCE',
        systemId: 'all',
        systemName: 'All Systems',
        generatedAt: new Date(Date.now() - 172800000).toISOString(),
        generatedBy: 'demo',
        format: 'EXCEL',
        size: 1048576, // 1MB
        status: 'READY'
      },
      {
        id: '3',
        name: 'Weekly Diagnostic Summary',
        type: 'DIAGNOSTIC',
        systemId: '2',
        systemName: 'Development CM',
        generatedAt: new Date(Date.now() - 604800000).toISOString(),
        generatedBy: 'demo',
        format: 'PDF',
        size: 3145728, // 3MB
        status: 'READY'
      },
      {
        id: '4',
        name: 'Executive Dashboard Report',
        type: 'EXECUTIVE',
        systemId: 'all',
        systemName: 'All Systems',
        generatedAt: new Date().toISOString(),
        generatedBy: 'demo',
        format: 'PDF',
        size: 0,
        status: 'GENERATING'
      }
    ];
    setReports(mockReports);
  };

  const generateReport = async () => {
    setIsGenerating(true);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newReport: Report = {
      id: Date.now().toString(),
      name: `${reportConfig.type} Report - ${new Date().toLocaleDateString()}`,
      type: reportConfig.type as any,
      systemId: reportConfig.systemId,
      systemName: reportConfig.systemId === 'all' ? 'All Systems' : 'Production CM',
      generatedAt: new Date().toISOString(),
      generatedBy: 'demo',
      format: reportConfig.format as any,
      size: Math.floor(Math.random() * 5000000),
      status: 'READY'
    };
    
    setReports([newReport, ...reports]);
    setIsGenerating(false);
    setShowGenerateModal(false);
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'HEALTH': return 'bg-green-100 text-green-800';
      case 'DIAGNOSTIC': return 'bg-blue-100 text-blue-800';
      case 'COMPLIANCE': return 'bg-purple-100 text-purple-800';
      case 'EXECUTIVE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadReport = (report: Report) => {
    // Simulate download
    alert(`Downloading ${report.name}...`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="mt-1 text-sm text-gray-600">
                Generate and download system reports
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Generate New Report
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-500 hover:text-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Templates */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer" onClick={() => {
            setReportConfig({ ...reportConfig, type: 'HEALTH' });
            setShowGenerateModal(true);
          }}>
            <div className="text-green-600 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold">Health Report</h3>
            <p className="text-sm text-gray-600 mt-1">System health overview and metrics</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer" onClick={() => {
            setReportConfig({ ...reportConfig, type: 'DIAGNOSTIC' });
            setShowGenerateModal(true);
          }}>
            <div className="text-blue-600 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-semibold">Diagnostic Report</h3>
            <p className="text-sm text-gray-600 mt-1">Detailed findings and analysis</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer" onClick={() => {
            setReportConfig({ ...reportConfig, type: 'COMPLIANCE' });
            setShowGenerateModal(true);
          }}>
            <div className="text-purple-600 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold">Compliance Report</h3>
            <p className="text-sm text-gray-600 mt-1">Security and compliance status</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer" onClick={() => {
            setReportConfig({ ...reportConfig, type: 'EXECUTIVE' });
            setShowGenerateModal(true);
          }}>
            <div className="text-yellow-600 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold">Executive Report</h3>
            <p className="text-sm text-gray-600 mt-1">High-level summary for management</p>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Reports</h2>
          </div>
          <div className="divide-y">
            {reports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReportTypeColor(report.type)}`}>
                        {report.type}
                      </span>
                      <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span>System: {report.systemName}</span>
                      <span className="mx-2">•</span>
                      <span>Generated by {report.generatedBy}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(report.generatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {report.status === 'READY' ? (
                      <>
                        <span className="text-sm text-gray-500">{formatFileSize(report.size)}</span>
                        <button
                          onClick={() => downloadReport(report)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Download
                        </button>
                      </>
                    ) : report.status === 'GENERATING' ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm">Generating...</span>
                      </div>
                    ) : (
                      <span className="text-sm text-red-600">Failed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold">Generate New Report</h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Type
                  </label>
                  <select
                    value={reportConfig.type}
                    onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="HEALTH">Health Report</option>
                    <option value="DIAGNOSTIC">Diagnostic Report</option>
                    <option value="COMPLIANCE">Compliance Report</option>
                    <option value="EXECUTIVE">Executive Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System
                  </label>
                  <select
                    value={reportConfig.systemId}
                    onChange={(e) => setReportConfig({ ...reportConfig, systemId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Systems</option>
                    <option value="1">Production CM</option>
                    <option value="2">Development CM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    value={reportConfig.dateRange}
                    onChange={(e) => setReportConfig({ ...reportConfig, dateRange: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="last7days">Last 7 Days</option>
                    <option value="last30days">Last 30 Days</option>
                    <option value="last90days">Last 90 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="PDF"
                        checked={reportConfig.format === 'PDF'}
                        onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                        className="mr-2"
                      />
                      PDF
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="EXCEL"
                        checked={reportConfig.format === 'EXCEL'}
                        onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                        className="mr-2"
                      />
                      Excel
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="JSON"
                        checked={reportConfig.format === 'JSON'}
                        onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                        className="mr-2"
                      />
                      JSON
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Include in Report
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeFindings}
                        onChange={(e) => setReportConfig({ ...reportConfig, includeFindings: e.target.checked })}
                        className="mr-2"
                      />
                      Detailed Findings
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeRemediation}
                        onChange={(e) => setReportConfig({ ...reportConfig, includeRemediation: e.target.checked })}
                        className="mr-2"
                      />
                      Remediation History
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeTrends}
                        onChange={(e) => setReportConfig({ ...reportConfig, includeTrends: e.target.checked })}
                        className="mr-2"
                      />
                      Trend Analysis
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                disabled={isGenerating}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={generateReport}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}