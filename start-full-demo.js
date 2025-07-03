#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 CM Diagnostics Full Stack Demo');
console.log('==================================\n');

// Check if .env.development exists
if (!fs.existsSync('.env.development')) {
  console.error('❌ .env.development file not found!');
  console.log('Please create .env.development file with required configuration.');
  process.exit(1);
}

// Function to run command with logging
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkDependencies() {
  console.log('🔍 Checking dependencies...\n');
  
  try {
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Installing root dependencies...');
      await runCommand('npm', ['install']);
    }
    
    // Check package dependencies
    const packages = [
      'packages/core',
      'packages/database',
      'packages/logger',
      'packages/cm-connector',
      'packages/diagnostics',
      'packages/idol-connector',
      'packages/es-connector',
      'packages/api',
      'packages/api-client',
      'packages/ui',
      'apps/web'
    ];
    
    for (const pkg of packages) {
      if (!fs.existsSync(path.join(pkg, 'node_modules'))) {
        console.log(`📦 Installing dependencies for ${pkg}...`);
        await runCommand('npm', ['install'], { cwd: pkg });
      }
    }
    
    console.log('✅ All dependencies installed!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

async function buildPackages() {
  console.log('🔨 Building packages...\n');
  
  try {
    await runCommand('npm', ['run', 'build']);
    console.log('✅ All packages built successfully!\n');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function startServices() {
  console.log('🚀 Starting services...\n');
  
  const services = [];
  
  // Start API server
  console.log('🌐 Starting API server on http://localhost:4000');
  const apiProcess = spawn('npm', ['run', 'dev'], {
    cwd: 'packages/api',
    stdio: 'pipe',
    shell: true
  });
  
  apiProcess.stdout.on('data', (data) => {
    console.log(`[API] ${data.toString().trim()}`);
  });
  
  apiProcess.stderr.on('data', (data) => {
    console.error(`[API] ${data.toString().trim()}`);
  });
  
  services.push(apiProcess);
  
  // Wait a bit for API to start
  setTimeout(() => {
    // Start web app
    console.log('\n🌐 Starting Web App on http://localhost:3000');
    const webProcess = spawn('npm', ['run', 'dev'], {
      cwd: 'apps/web',
      stdio: 'pipe',
      shell: true
    });
    
    webProcess.stdout.on('data', (data) => {
      console.log(`[WEB] ${data.toString().trim()}`);
    });
    
    webProcess.stderr.on('data', (data) => {
      console.error(`[WEB] ${data.toString().trim()}`);
    });
    
    services.push(webProcess);
    
    console.log('\n✅ All services started!');
    console.log('\n📋 Available URLs:');
    console.log('   - Web App: http://localhost:3000');
    console.log('   - API: http://localhost:4000');
    console.log('   - GraphQL: http://localhost:4000/graphql');
    console.log('   - Health: http://localhost:4000/health');
    console.log('\n📝 Login Credentials:');
    console.log('   - Username: demo');
    console.log('   - Password: demo123');
    console.log('\n🛑 Press Ctrl+C to stop all services\n');
  }, 3000);
  
  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down services...');
    services.forEach(service => service.kill());
    process.exit(0);
  });
}

async function runDemo() {
  try {
    // Check and install dependencies
    await checkDependencies();
    
    // Build packages
    await buildPackages();
    
    // Start services
    startServices();
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Show demo overview
console.log('This demo will showcase:');
console.log('✅ Checkpoint 1: Project Foundation - UI Components & Architecture');
console.log('✅ Checkpoint 2: CM Connector - Multi-version Content Manager integration');
console.log('✅ Checkpoint 3: Diagnostic Engine - Rules-based scanning & remediation');
console.log('✅ Checkpoint 4: API Layer - GraphQL & REST endpoints');
console.log('✅ Checkpoint 5: Frontend Dashboard - React/Next.js application');
console.log('✅ Checkpoint 6: IDOL Integration - Search & analytics');
console.log('✅ Checkpoint 7: ES Integration - Workflow automation & reporting');
console.log('\n');

// Run the demo
runDemo();