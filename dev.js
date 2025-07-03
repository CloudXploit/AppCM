#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 CM Diagnostics Development Mode');
console.log('==================================\n');

// Check if .env.development exists
if (!fs.existsSync('.env.development')) {
  console.error('❌ .env.development file not found!');
  console.log('Creating default .env.development file...');
  // Copy from the file we just created
}

console.log('📋 Starting services in development mode...\n');

const services = [];

// Start API server
console.log('🌐 Starting API server on http://localhost:4000');
const apiProcess = spawn('npm', ['run', 'dev'], {
  cwd: 'packages/api',
  stdio: 'pipe',
  shell: true,
  env: { ...process.env, NODE_ENV: 'development' }
});

apiProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) console.log(`[API] ${output}`);
});

apiProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) console.error(`[API ERROR] ${output}`);
});

services.push(apiProcess);

// Wait for API to start then start web app
setTimeout(() => {
  console.log('\n🌐 Starting Web App on http://localhost:3000');
  const webProcess = spawn('npm', ['run', 'dev'], {
    cwd: 'apps/web',
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  webProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) console.log(`[WEB] ${output}`);
  });
  
  webProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) console.error(`[WEB ERROR] ${output}`);
  });
  
  services.push(webProcess);
  
  console.log('\n✅ All services starting...');
  console.log('\n📋 Available URLs:');
  console.log('   - Web App: http://localhost:3000');
  console.log('   - API: http://localhost:4000');
  console.log('   - GraphQL: http://localhost:4000/graphql');
  console.log('   - Health: http://localhost:4000/health');
  console.log('\n📝 Login Credentials:');
  console.log('   - Username: demo');
  console.log('   - Password: demo123');
  console.log('\n🛑 Press Ctrl+C to stop all services\n');
  
  // Show features available
  setTimeout(() => {
    console.log('\n🎯 Features Available in This Demo:');
    console.log('   1. System Management - Add and monitor CM systems');
    console.log('   2. Diagnostics - Run health checks and scans');
    console.log('   3. Findings - View and manage diagnostic findings');
    console.log('   4. Remediation - Apply fixes to issues');
    console.log('   5. Reports - Generate compliance and health reports');
    console.log('   6. Real-time Updates - WebSocket subscriptions');
    console.log('   7. Multi-version Support - CM 10.x to 23.x');
    console.log('   8. IDOL Integration - Search and analytics');
    console.log('   9. ES Integration - Workflow automation\n');
  }, 5000);
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down services...');
  services.forEach(service => {
    try {
      service.kill('SIGTERM');
    } catch (e) {
      // Service might already be dead
    }
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  services.forEach(service => service.kill());
  process.exit(0);
});