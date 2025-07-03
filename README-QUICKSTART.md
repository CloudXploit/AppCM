# CM Diagnostics - Quick Start Guide

## 🚀 Running the Application

The application is now ready to run! Follow these simple steps:

### Option 1: Using the Start Script (Recommended)
```bash
./start.sh
```

### Option 2: Manual Start
```bash
# If port 3000 is available:
node standalone-server.js

# If port 3000 is in use:
PORT=3001 node standalone-server.js
```

## 🌐 Accessing the Application

Once the server is running, open your web browser and navigate to:

- **Main Application**: http://localhost:3001/ (or http://localhost:3000/ if port 3000 is available)
- **API Health Check**: http://localhost:3001/api/health

## ✨ Features Available

The application includes:

1. **Dashboard View**
   - Real-time system metrics (CPU, Memory, Disk usage)
   - Active systems monitoring
   - Recent activities feed
   - Performance charts

2. **Diagnostics Center**
   - Run diagnostic scans
   - View and manage findings
   - Auto-remediation options

3. **Analytics & ML**
   - Anomaly detection
   - Predictive analytics
   - Pattern recognition
   - ML model insights

4. **Integration Hub**
   - Pre-configured integrations (Slack, PagerDuty, JIRA)
   - Connection status
   - Configuration options

5. **Authentication**
   - Login/logout functionality
   - Session management
   - Demo mode available

## 📊 Demo Mode

The application runs in demo mode with simulated data, allowing you to explore all features without requiring external dependencies. Real-time metrics are generated randomly to demonstrate the live update functionality.

## 🛑 Stopping the Server

To stop the server, press `Ctrl+C` in the terminal where it's running.

## 🔧 Troubleshooting

### Port Already in Use
If you see an error about the port being in use, either:
1. Use the start script which automatically selects an available port
2. Manually specify a different port: `PORT=3002 node standalone-server.js`

### Display Issues
Make sure you're accessing the correct URL in your browser. The application should display immediately when you navigate to the root URL.

## 🎯 Next Steps

1. **Explore the Dashboard**: View real-time metrics and system status
2. **Run Diagnostics**: Click on "Diagnostics" and run a scan
3. **Check Analytics**: View ML-powered insights and predictions
4. **Test Integrations**: Configure connections to external services

Enjoy using CM Diagnostics!