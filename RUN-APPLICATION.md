# 🚀 Running CM Diagnostics Application

This application showcases all features from Checkpoints 1-7. Choose the option that works best for your environment:

## Option 1: Standalone Demo (Recommended - No Dependencies!)

The easiest way to see everything in action:

```bash
# Using the script
./run-demo-simple.sh

# Or manually with Python
python3 -m http.server 8000
# Then open http://localhost:8000/demo-standalone.html

# Or just open the file directly
open demo-standalone.html
```

**Features in Standalone Demo:**
- ✅ All UI components and layouts
- ✅ System management interface
- ✅ Diagnostic engine simulation
- ✅ Workflow automation demos
- ✅ IDOL integration features
- ✅ ES integration features
- ✅ Reports and analytics

## Option 2: Docker Compose (Full Application)

Run the complete application with all services:

```bash
# Start all services
docker-compose -f docker-compose.full.yml up

# Access:
# - Web App: http://localhost:3000
# - API: http://localhost:4000
# - GraphQL: http://localhost:4000/graphql
# - Database Admin: http://localhost:8080
```

## Option 3: Manual Setup (For Development)

If you want to run services individually:

### Prerequisites
- Node.js 18+ and npm 9+
- PostgreSQL (optional, uses mock data if not available)
- Redis (optional)

### Steps:

1. **Fix Dependencies & Install**
```bash
# Fix the logger package first
sed -i 's/"@opentelemetry\/api": ".*"/"winston": "^3.11.0"/' packages/logger/package.json

# Install with legacy peer deps
npm install --legacy-peer-deps

# Install for each package
for dir in packages/* apps/*; do
  if [ -d "$dir" ]; then
    echo "Installing $dir"
    (cd "$dir" && npm install --legacy-peer-deps)
  fi
done
```

2. **Run Services**
```bash
# Terminal 1: Start API
cd packages/api
npm run dev

# Terminal 2: Start Web App
cd apps/web
npm run dev
```

## 🎯 What's Included

### Checkpoint Progress:
1. ✅ **Project Foundation** - Monorepo, TypeScript, UI Components
2. ✅ **CM Connector** - Multi-version support (10.x - 23.x)
3. ✅ **Diagnostic Engine** - Scanners, rules, auto-remediation
4. ✅ **API Layer** - GraphQL, REST, WebSocket subscriptions
5. ✅ **Frontend Dashboard** - Next.js, real-time updates
6. ✅ **IDOL Integration** - Search, analytics, monitoring
7. ✅ **ES Integration** - Workflows, automation, reporting

### Key Features:
- 📊 Real-time system monitoring
- 🔍 Diagnostic scanning with progress tracking
- 🚨 Issue detection and remediation
- 🔄 Workflow automation
- 📈 Analytics and reporting
- 🔐 Authentication and authorization
- 🌐 Multi-tenant support ready

## 📝 Login Credentials
- Username: `demo`
- Password: `demo123`

## 🐛 Troubleshooting

### Dependency Issues
```bash
# Clear everything and start fresh
rm -rf node_modules package-lock.json
find . -name "node_modules" -type d -prune -exec rm -rf {} \;
find . -name "package-lock.json" -type f -delete
npm cache clean --force
```

### Port Conflicts
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Windows Users
- Use Git Bash or WSL2
- Ensure line endings are LF not CRLF
- Run scripts with `bash script.sh`

## 📁 Project Structure
```
cm-diagnostics/
├── apps/web/              # Next.js frontend
├── packages/
│   ├── api/              # GraphQL/REST API
│   ├── cm-connector/     # CM integration
│   ├── diagnostics/      # Diagnostic engine
│   ├── idol-connector/   # IDOL integration
│   ├── es-connector/     # ES integration
│   └── ...              # Other packages
├── demo-standalone.html  # No-dependency demo
├── docker-compose.full.yml
└── run-demo-simple.sh
```

## 🎉 Success!

Once running, you'll have access to:
- Complete system management dashboard
- Diagnostic scanning and remediation
- Workflow automation interface
- Real-time monitoring
- Comprehensive reporting
- All integrations (CM, IDOL, ES)

The standalone demo (`demo-standalone.html`) provides the full UI experience without any setup required!