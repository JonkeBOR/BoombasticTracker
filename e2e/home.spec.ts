import { expect, test } from '@playwright/test';
import { appStrings } from '@/lib/strings/app';

test('landing page serves the application name and description', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: appStrings.name })).toBeVisible();
  await expect(page.getByText(appStrings.description)).toBeVisible();
});
