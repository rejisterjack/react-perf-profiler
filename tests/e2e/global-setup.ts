/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */

import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');
  
  // Verify the extension is built
  const fs = await import('fs');
  const path = await import('path');
  
  const extensionPath = path.resolve('./dist');
  if (!fs.existsSync(extensionPath)) {
    console.warn('⚠️ Extension dist folder not found. Run `npm run build` first.');
  } else {
    console.log('✓ Extension dist folder found');
  }
  
  // Create test results directory if it doesn't exist
  const resultsDir = path.resolve('./test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  console.log('Global setup complete');
}

export default globalSetup;
