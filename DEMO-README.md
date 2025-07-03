# CM Diagnostics - Demo Application

## 🚀 Quick Start

We've created multiple ways to run the demo application:

### Option 1: Standalone HTML Demo (Recommended)

This is the easiest way to see the application in action without any dependencies:

```bash
# Run the demo server
./run-demo.sh

# Or open directly in your browser
# Open the file: standalone-demo.html
```

The standalone demo shows:
- Landing page with feature overview
- Simulated connection to CM 23.4
- Dashboard with multiple tabs:
  - **Overview**: System stats and status
  - **Diagnostics**: Run scans and see auto-fix options
  - **Users**: Active user management
  - **Performance**: Resource usage and metrics

### Option 2: Full Next.js Application

If you want to run the full application:

```bash
# Install dependencies (may have some warnings)
npm install --legacy-peer-deps --force

# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

## 📸 What You'll See

### Landing Page
- Overview of CM Diagnostics features
- Multi-version support (9.4 - 25.2)
- Auto-remediation capabilities
- Real-time monitoring

### Demo Dashboard
After clicking "Launch Demo Application":

1. **Connection Simulation**
   - Shows connecting animation
   - Detects CM version 23.4 Enterprise

2. **System Information**
   - Version details
   - Active features
   - Database type

3. **Overview Tab**
   - Key metrics (Records, Users, Storage, Health)
   - System service status
   - Real-time monitoring

4. **Diagnostics Tab**
   - Click "Run Full Scan" to simulate diagnostics
   - Shows detected issues with severity levels
   - One-click "Auto Fix" buttons
   - Categorized by Performance, Security, Configuration

5. **Users Tab**
   - Active user list
   - User types (Admin, User, System)
   - Last activity tracking

6. **Performance Tab**
   - Resource usage meters (CPU, Memory, Disk, Network)
   - Database performance metrics
   - Performance recommendations

## 🏗️ Architecture Demonstrated

The demo showcases:
- **CM Connector Package**: Connection to multiple CM versions
- **Unified Data Models**: Consistent data structures
- **Real-time Monitoring**: Live system metrics
- **Auto-remediation**: One-click fixes for issues
- **Multi-version Support**: Works with CM 9.4 through 25.2

## 🔧 Technical Stack

- **Frontend**: React with Tailwind CSS
- **Backend Ready**: GraphQL API (Apollo Server)
- **Database**: Prisma ORM with PostgreSQL support
- **Monitoring**: OpenTelemetry integration
- **CM Connector**: TypeScript package with:
  - Database connectors (SQL Server & Oracle)
  - REST/SOAP API support
  - Version detection
  - Connection pooling
  - Secure credential management

## 📝 Next Steps

After exploring the demo, you can:
1. Connect to a real CM instance using the connection configuration
2. Run actual diagnostics on your CM system
3. Implement custom diagnostic rules
4. Set up automated remediation workflows

## 🤝 Ready for Production

The architecture is ready for:
- Enterprise deployments
- High-availability configurations
- Integration with existing monitoring systems
- Custom diagnostic plugins
- Automated remediation workflows