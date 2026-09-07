import { chromium, FullConfig } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { getEnvironmentConfig } from './config/environments';

async function globalSetup(_config: FullConfig): Promise<void> {
  const { baseUrl, username, password } = getEnvironmentConfig();

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: baseUrl });

  await page.goto('/');
  await new LoginPage(page).login(username, password);
  await page.context().storageState({ path: 'storage-state/qa-admin.json' });

  await browser.close();
}

export default globalSetup;
