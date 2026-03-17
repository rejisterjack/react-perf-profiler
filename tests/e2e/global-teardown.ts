/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests
 */

import { type FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...');
  
  // Clean up any temporary test data
  // Close any open connections
  // Archive test results if needed
  
  console.log('Global teardown complete');
}

export default globalTeardown;
