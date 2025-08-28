#!/usr/bin/env npx tsx

import { execSync } from 'child_process';

// Test runner script for QuickStage Worker
const args = process.argv.slice(2);
const command = args[0] || 'help';

const commands = {
  // Quick tests - validation and helpers only
  quick: () => {
    console.log('🚀 Running quick tests (utilities only)...');
    execSync('npx vitest run src/test/helpers src/test/validation src/test/middleware', { stdio: 'inherit' });
  },

  // Core tests - auth, tokens, snapshots
  core: () => {
    console.log('🔑 Running core route tests...');
    execSync('npx vitest run src/test/routes/auth.test.ts src/test/routes/tokens.test.ts src/test/routes/snapshots.test.ts', { stdio: 'inherit' });
  },

  // All tests
  all: () => {
    console.log('🧪 Running all tests...');
    execSync('npx vitest run', { stdio: 'inherit' });
  },

  // Watch mode for development
  watch: () => {
    console.log('👀 Running tests in watch mode...');
    execSync('npx vitest', { stdio: 'inherit' });
  },

  // Coverage report
  coverage: () => {
    console.log('📊 Running tests with coverage...');
    execSync('npx vitest run --coverage', { stdio: 'inherit' });
  },

  // UI mode for interactive testing
  ui: () => {
    console.log('🎨 Starting test UI...');
    execSync('npx vitest --ui', { stdio: 'inherit' });
  },

  // Pre-commit tests (quick validation)
  precommit: () => {
    console.log('✅ Running pre-commit tests...');
    execSync('npx vitest run src/test/helpers src/test/validation', { stdio: 'inherit' });
  },

  // CI tests (all tests, coverage, no watch)
  ci: () => {
    console.log('🤖 Running CI tests...');
    execSync('npx vitest run --coverage --reporter=junit --outputFile=test-results.xml', { stdio: 'inherit' });
  },

  // Help
  help: () => {
    console.log(`
🧪 QuickStage Worker Test Runner

Usage: npm run test-runner <command>

Commands:
  quick      - Run utility tests only (~5 seconds)
  core       - Run core route tests (auth, tokens, snapshots)
  all        - Run all tests
  watch      - Run tests in watch mode for development
  coverage   - Run tests with coverage report
  ui         - Open interactive test UI
  precommit  - Run pre-commit validation tests
  ci         - Run tests for CI/CD pipeline
  help       - Show this help message

Examples:
  npm run test-runner quick
  npm run test-runner watch
  npm run test-runner coverage
    `);
  }
};

if (commands[command as keyof typeof commands]) {
  try {
    commands[command as keyof typeof commands]();
  } catch (error) {
    console.error(`❌ Test command '${command}' failed:`, error);
    process.exit(1);
  }
} else {
  console.error(`❌ Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}