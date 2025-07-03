'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [systems, setSystems] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSystems: 0,
    healthySystems: 0,
    activeScans: 0,
    totalFindings: 0
  });

  useEffect(() => {
    // Check authentication
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/auth/login');
      return;
    }
    setUser(JSON.parse(userStr));

    // Fetch data
    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/systems', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystems(data);
        setStats({
          totalSystems: data.length,
          healthySystems: data.filter((s: any) => s.health.status === 'healthy').length,
          activeScans: 1,
          totalFindings: 5
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/auth/login');
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">CM Diagnostics Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user.name}</span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Systems</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{stats.totalSystems}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Healthy Systems</div>
            <div className="mt-2 text-3xl font-semibold text-green-600">{stats.healthySystems}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active Scans</div>
            <div className="mt-2 text-3xl font-semibold text-blue-600">{stats.activeScans}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Findings</div>
            <div className="mt-2 text-3xl font-semibold text-orange-600">{stats.totalFindings}</div>
          </div>
        </div>

        {/* Systems List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Content Manager Systems</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {systems.map((system) => (
              <div key={system.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{system.name}</h3>
                    <p className="text-sm text-gray-500">
                      {system.edition} {system.version} - {system.database.type}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      system.health.status === 'healthy' 
                        ? 'bg-green-100 text-green-800'
                        : system.health.status === 'warning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {system.health.status}
                    </span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/systems"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-2">Manage Systems</h3>
            <p className="text-gray-600">Add, edit, or remove Content Manager systems</p>
          </Link>
          <Link
            href="/dashboard/diagnostics"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-2">Run Diagnostics</h3>
            <p className="text-gray-600">Start a new diagnostic scan on your systems</p>
          </Link>
          <Link
            href="/dashboard/reports"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-2">View Reports</h3>
            <p className="text-gray-600">Generate and download system health reports</p>
          </Link>
        </div>
      </main>
    </div>
  );
}