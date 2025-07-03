const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Mock API responses
const mockData = {
  systems: [
    {
      id: '1',
      name: 'Production CM',
      version: '23.4',
      edition: 'Enterprise',
      lastConnected: new Date().toISOString(),
      health: { status: 'healthy', score: 95, issues: 2 },
      database: { type: 'SQLSERVER', name: 'CM_PROD', server: 'sql01.corp.local' }
    },
    {
      id: '2',
      name: 'Development CM',
      version: '23.4',
      edition: 'Standard',
      lastConnected: new Date(Date.now() - 3600000).toISOString(),
      health: { status: 'warning', score: 72, issues: 8 },
      database: { type: 'SQLSERVER', name: 'CM_DEV', server: 'sql-dev.corp.local' }
    }
  ]
};

// Create an integrated demo HTML
const demoHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CM Diagnostics - Full Application Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .fade-in { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        // Simple routing system
        class Router {
            constructor() {
                this.routes = {};
                this.currentRoute = null;
                window.addEventListener('popstate', () => this.handleRoute());
            }
            
            register(path, component) {
                this.routes[path] = component;
            }
            
            navigate(path) {
                window.history.pushState({}, '', path);
                this.handleRoute();
            }
            
            handleRoute() {
                const path = window.location.pathname;
                const component = this.routes[path] || this.routes['/'];
                document.getElementById('root').innerHTML = component();
            }
        }

        const router = new Router();

        // Mock authentication
        let currentUser = null;

        // Components
        function LoginPage() {
            return \`
                <div class="min-h-screen flex items-center justify-center bg-gray-50">
                    <div class="max-w-md w-full space-y-8">
                        <div>
                            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                                Sign in to CM Diagnostics
                            </h2>
                            <p class="mt-2 text-center text-sm text-gray-600">
                                Use demo/demo123 for testing
                            </p>
                        </div>
                        <form class="mt-8 space-y-6" onsubmit="handleLogin(event)">
                            <div class="rounded-md shadow-sm -space-y-px">
                                <div>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                        placeholder="Username"
                                        value="demo"
                                    />
                                </div>
                                <div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                        placeholder="Password"
                                        value="demo123"
                                    />
                                </div>
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Sign in
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            \`;
        }

        function DashboardPage() {
            if (!currentUser) {
                router.navigate('/login');
                return '';
            }

            const systems = ${JSON.stringify(mockData.systems)};
            
            return \`
                <div class="min-h-screen bg-gray-100">
                    <header class="bg-white shadow">
                        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div class="flex justify-between items-center py-6">
                                <h1 class="text-3xl font-bold text-gray-900">CM Diagnostics Dashboard</h1>
                                <div class="flex items-center space-x-4">
                                    <span class="text-gray-700">Welcome, \${currentUser.name}</span>
                                    <button onclick="handleLogout()" class="text-gray-500 hover:text-gray-700">
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div class="bg-white rounded-lg shadow p-6 fade-in">
                                <div class="text-sm font-medium text-gray-500">Total Systems</div>
                                <div class="mt-2 text-3xl font-semibold text-gray-900">\${systems.length}</div>
                            </div>
                            <div class="bg-white rounded-lg shadow p-6 fade-in">
                                <div class="text-sm font-medium text-gray-500">Healthy Systems</div>
                                <div class="mt-2 text-3xl font-semibold text-green-600">
                                    \${systems.filter(s => s.health.status === 'healthy').length}
                                </div>
                            </div>
                            <div class="bg-white rounded-lg shadow p-6 fade-in">
                                <div class="text-sm font-medium text-gray-500">Active Scans</div>
                                <div class="mt-2 text-3xl font-semibold text-blue-600">1</div>
                            </div>
                            <div class="bg-white rounded-lg shadow p-6 fade-in">
                                <div class="text-sm font-medium text-gray-500">Total Findings</div>
                                <div class="mt-2 text-3xl font-semibold text-orange-600">10</div>
                            </div>
                        </div>

                        <div class="bg-white shadow rounded-lg fade-in">
                            <div class="px-6 py-4 border-b border-gray-200">
                                <h2 class="text-xl font-semibold text-gray-900">Content Manager Systems</h2>
                            </div>
                            <div class="divide-y divide-gray-200">
                                \${systems.map(system => \`
                                    <div class="px-6 py-4">
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <h3 class="text-lg font-medium text-gray-900">\${system.name}</h3>
                                                <p class="text-sm text-gray-500">
                                                    \${system.edition} \${system.version} - \${system.database.type}
                                                </p>
                                                <div class="mt-2">
                                                    <div class="text-sm text-gray-600">Health Score: \${system.health.score}%</div>
                                                    <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                        <div class="bg-\${system.health.status === 'healthy' ? 'green' : 'yellow'}-500 h-2 rounded-full" 
                                                             style="width: \${system.health.score}%"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-4">
                                                <span class="px-3 py-1 rounded-full text-xs font-medium bg-\${
                                                    system.health.status === 'healthy' ? 'green' : 'yellow'
                                                }-100 text-\${
                                                    system.health.status === 'healthy' ? 'green' : 'yellow'
                                                }-800">
                                                    \${system.health.status}
                                                </span>
                                                <button onclick="router.navigate('/systems/\${system.id}')" 
                                                        class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>

                        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <button onclick="router.navigate('/systems')" 
                                    class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left fade-in">
                                <h3 class="text-lg font-medium text-gray-900 mb-2">Manage Systems</h3>
                                <p class="text-gray-600">Add, edit, or remove Content Manager systems</p>
                            </button>
                            <button onclick="router.navigate('/diagnostics')" 
                                    class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left fade-in">
                                <h3 class="text-lg font-medium text-gray-900 mb-2">Run Diagnostics</h3>
                                <p class="text-gray-600">Start a new diagnostic scan on your systems</p>
                            </button>
                            <button onclick="router.navigate('/reports')" 
                                    class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left fade-in">
                                <h3 class="text-lg font-medium text-gray-900 mb-2">View Reports</h3>
                                <p class="text-gray-600">Generate and download system health reports</p>
                            </button>
                        </div>
                    </main>
                </div>
            \`;
        }

        // Event handlers
        window.handleLogin = function(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (username === 'demo' && password === 'demo123') {
                currentUser = { name: 'Demo User', username: 'demo' };
                router.navigate('/dashboard');
            } else {
                alert('Invalid credentials');
            }
        };

        window.handleLogout = function() {
            currentUser = null;
            router.navigate('/login');
        };

        // Register routes
        router.register('/', LoginPage);
        router.register('/login', LoginPage);
        router.register('/dashboard', DashboardPage);

        // Initialize
        router.handleRoute();
    </script>
</body>
</html>`;

// Create server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle API mock endpoints
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
    return;
  }

  // Serve the demo HTML
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(demoHTML);
});

server.listen(PORT, () => {
  console.log(`
🚀 CM Diagnostics Development Server Running!

   Application URL: http://localhost:${PORT}
   
   Login Credentials:
   - Username: demo
   - Password: demo123

   Features Demonstrated:
   - Authentication flow
   - Dashboard with system statistics
   - System health monitoring
   - Responsive design
   - Navigation between sections

   Press Ctrl+C to stop the server.
  `);
});