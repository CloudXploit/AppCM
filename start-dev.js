const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting CM Diagnostics Development Environment...\n');

// Start mock API server
const apiProcess = spawn('node', [path.join(__dirname, 'packages/api/src/index.dev.ts')], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '4000' }
});

// Wait a bit for API to start
setTimeout(() => {
  console.log('\n🌐 Starting Next.js frontend...\n');
  
  // Start Next.js
  const webProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'apps/web'),
    stdio: 'inherit',
    shell: true
  });

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    apiProcess.kill();
    webProcess.kill();
    process.exit();
  });
}, 2000);

console.log(`
📝 Development Environment Starting:
   - API Server: http://localhost:4000
   - Web App: http://localhost:3000
   
   Login credentials:
   - Username: demo
   - Password: demo123
`);