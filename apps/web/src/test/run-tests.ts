#!/usr/bin/env node

/**
 * QuickStage Test Runner
 * 
 * This script provides different testing modes for the QuickStage application:
 * - Fast: Run only critical tests (under 30 seconds)
 * - Full: Run all tests with coverage
 * - Watch: Run tests in watch mode for development
 * - UI: Run tests with visual test runner
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const packageJsonPath = resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

console.log('🧪 QuickStage Test Runner');
console.log('========================\n');

const args = process.argv.slice(2);
const mode = args[0] || 'fast';

const testScripts = {
  fast: 'pnpm test:critical',
  full: 'pnpm test',
  watch: 'pnpm test:watch',
  ui: 'pnpm test:ui',
  deploy: 'pnpm predeploy'
};

if (!testScripts[mode]) {
  console.log('Available modes:');
  console.log('  fast    - Run critical tests only (30s)');
  console.log('  full    - Run all tests with coverage');
  console.log('  watch   - Run tests in watch mode');
  console.log('  ui      - Run tests with visual runner');
  console.log('  deploy  - Run critical tests + build');
  console.log('\nUsage: pnpm run-tests [mode]');
  process.exit(1);
}

console.log(`Running tests in ${mode} mode...\n`);

try {
  execSync(testScripts[mode], { 
    stdio: 'inherit',
    cwd: resolve(__dirname, '../..')
  });
  
  if (mode === 'fast') {
    console.log('\n✅ Critical tests passed! Ready for deployment.');
  } else if (mode === 'deploy') {
    console.log('\n✅ All checks passed! Ready to deploy.');
  }
  
} catch (error) {
  console.error('\n❌ Tests failed!');
  
  if (mode === 'fast') {
    console.log('\n💡 Try running: pnpm test:watch');
    console.log('   This will help you debug the failing tests.');
  }
  
  process.exit(1);
}
