import { test } from '@playwright/test';

// Bootstraps the Planner/Generator agents into an authenticated session.
// The `qa` project's storageState (see playwright.config.ts) already carries
// a logged-in session, so this just lands on the app's landing page.
test.describe('Seed', () => {
  test('authenticated landing page', async ({ page }) => {
    await page.goto('/');
  });
});
