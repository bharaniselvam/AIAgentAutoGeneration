import { test as base } from '@playwright/test';

export const test = base.extend({
  // storageState is applied per-project in playwright.config.ts (see `storageState`),
  // so the default `page` fixture is already authenticated for every test.
});

export { expect } from '@playwright/test';
