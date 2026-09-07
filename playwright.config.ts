import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import { getEnvironmentConfig } from './config/environments';

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: true,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'qa',
      use: {
        baseURL: getEnvironmentConfig('qa').baseUrl,
        storageState: 'storage-state/qa-admin.json',
      },
    },
  ],
});
