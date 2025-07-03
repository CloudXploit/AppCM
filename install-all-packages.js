const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Installing dependencies for all packages...\n');

const packages = [
  'packages/core',
  'packages/database', 
  'packages/logger',
  'packages/auth',
  'packages/cm-connector',
  'packages/diagnostics',
  'packages/idol-connector',
  'packages/es-connector',
  'packages/api',
  'packages/ui',
  'packages/i18n',
  'apps/web'
];

packages.forEach(pkg => {
  const pkgPath = path.join(__dirname, pkg);
  if (fs.existsSync(pkgPath)) {
    console.log(`\n📦 Installing dependencies for ${pkg}...`);
    try {
      execSync('npm install --legacy-peer-deps', { 
        cwd: pkgPath,
        stdio: 'inherit'
      });
      console.log(`✅ ${pkg} dependencies installed`);
    } catch (error) {
      console.error(`❌ Failed to install dependencies for ${pkg}`);
    }
  }
});

console.log('\n✅ All package dependencies installed!');