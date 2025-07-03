import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          CM Diagnostics
        </h1>
        <p className="text-xl text-center mb-8 text-gray-600">
          Enterprise-grade diagnostic and auto-remediation for Content Manager systems
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="rounded-lg px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg px-8 py-3 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Register
          </Link>
        </div>
        <div className="mt-16 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left">
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
            <h2 className="mb-3 text-2xl font-semibold">
              Multi-Version Support
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Compatible with Content Manager versions 9.4 through 25.2
            </p>
          </div>
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
            <h2 className="mb-3 text-2xl font-semibold">
              Auto-Remediation
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Automatically detect and fix complex issues
            </p>
          </div>
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
            <h2 className="mb-3 text-2xl font-semibold">
              Real-time Monitoring
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              24/7 system health monitoring and alerts
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}