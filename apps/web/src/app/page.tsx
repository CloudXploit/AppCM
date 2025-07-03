import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            CM Diagnostics
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Enterprise-grade diagnostic and auto-remediation for Content Manager
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-blue-600 mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Multi-Version Support</h3>
            <p className="text-gray-600">
              Compatible with CM versions 9.4 through 25.2, supporting both SQL Server and Oracle databases.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-green-600 mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Auto-Remediation</h3>
            <p className="text-gray-600">
              Automatically detect and fix configuration issues, performance bottlenecks, and data integrity problems.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-purple-600 mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-gray-600">
              Monitor system health, performance metrics, and user activity with comprehensive dashboards.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/demo"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            Launch Demo Application
          </Link>
        </div>

        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">1</span>
              <div>
                <h4 className="font-semibold">Connect to your CM instance</h4>
                <p className="text-gray-600">Support for direct database connections or REST/SOAP APIs</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">2</span>
              <div>
                <h4 className="font-semibold">Run diagnostics</h4>
                <p className="text-gray-600">Comprehensive scanning for issues across all system components</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">3</span>
              <div>
                <h4 className="font-semibold">Apply auto-fixes</h4>
                <p className="text-gray-600">One-click remediation for detected issues with full audit trail</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
