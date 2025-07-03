#!/usr/bin/env node

// Test Setup Script
// Verifies that all packages can be imported without errors

const chalk = require('chalk');

console.log(chalk.blue.bold('🧪 CM Diagnostics - Testing Package Imports'));
console.log(chalk.blue('==========================================\n'));

const packages = [
  { name: 'core', path: '../packages/core/src' },
  { name: 'logger', path: '../packages/logger/src' },
  { name: 'auth', path: '../packages/auth/src' },
  { name: 'cache', path: '../packages/cache/src' },
  { name: 'notifications', path: '../packages/notifications/src' },
  { name: 'monitoring', path: '../packages/monitoring/src' },
  { name: 'diagnostics', path: '../packages/diagnostics/src' },
  { name: 'remediation', path: '../packages/remediation/src' },
  { name: 'workflow', path: '../packages/workflow/src' },
  { name: 'integrations', path: '../packages/integrations/src' },
  { name: 'scheduler', path: '../packages/scheduler/src' },
  { name: 'advanced-diagnostics', path: '../packages/advanced-diagnostics/src' },
  { name: 'analytics', path: '../packages/analytics/src' }
];

let successCount = 0;
let failureCount = 0;

console.log(chalk.yellow('Testing package imports...\n'));

for (const pkg of packages) {
  try {
    // Try to require the package
    require(pkg.path);
    console.log(chalk.green(`✅ ${pkg.name.padEnd(20)} - OK`));
    successCount++;
  } catch (error) {
    console.log(chalk.red(`❌ ${pkg.name.padEnd(20)} - FAILED`));
    console.log(chalk.red(`   Error: ${error.message}`));
    failureCount++;
  }
}

console.log('\n' + chalk.blue('=========================================='));
console.log(chalk.blue('Summary:'));
console.log(chalk.green(`✅ Successful imports: ${successCount}`));
console.log(chalk.red(`❌ Failed imports: ${failureCount}`));
console.log(chalk.blue('=========================================='));

if (failureCount > 0) {
  console.log(chalk.red('\n⚠️  Some packages failed to import.'));
  console.log(chalk.yellow('This might be due to:'));
  console.log(chalk.yellow('1. Missing dependencies - Run: npm install'));
  console.log(chalk.yellow('2. TypeScript files not compiled - Run: npm run build:packages'));
  console.log(chalk.yellow('3. Syntax errors in the code'));
  process.exit(1);
} else {
  console.log(chalk.green('\n✨ All packages imported successfully!'));
  console.log(chalk.green('The application is ready to run.'));
  process.exit(0);
}