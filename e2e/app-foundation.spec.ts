import { expect, test } from '@playwright/test';
import { appStrings } from '@/lib/strings/app';
import { authStrings } from '@/lib/strings/auth';
import { featureStrings } from '@/lib/strings/features';
import { fitnessStrings } from '@/lib/strings/fitness';
import { signIn } from './session';

const signInErrors = [
  ['cancelled', authStrings.errors.cancelled],
  ['not-allowed', authStrings.errors.notAllowed],
  ['expired', authStrings.errors.expired],
  ['unavailable', authStrings.errors.unavailable],
] as const;

test.describe('sign-in and session', () => {
  for (const path of ['/', '/fitness-tracker']) {
    test(`signed out, ${path} shows the sign-in screen`, async ({ page }) => {
      await page.goto(path);

      const signInLink = page.getByRole('link', { name: authStrings.signInWithGoogle });
      await expect(signInLink).toBeVisible();
      await expect(signInLink).toHaveAttribute('href', /^\/api\/auth\/google/);
    });
  }

  for (const [code, message] of signInErrors) {
    test(`the sign-in screen explains the ${code} error`, async ({ page }) => {
      await page.goto(`/sign-in?error=${code}`);

      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    });
  }

  test('signed in, the sign-in screen sends the owner to the landing page', async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto('/sign-in');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: appStrings.name })).toBeVisible();
  });

  test('signing out returns to the sign-in screen and protects the app again', async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto('/');
    await page.getByRole('button', { name: authStrings.signOut }).click();

    await expect(page.getByRole('link', { name: authStrings.signInWithGoogle })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('link', { name: authStrings.signInWithGoogle })).toBeVisible();
  });
});

test.describe('landing page and features', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test('the landing page lists exactly the fitness tracker', async ({ page }) => {
    await page.goto('/');

    const featureList = page.getByRole('list', { name: featureStrings.heading });
    await expect(featureList.getByRole('link')).toHaveCount(1);
    await expect(
      featureList.getByRole('link', { name: new RegExp(featureStrings.fitnessTracker.title) }),
    ).toBeVisible();
  });

  test('the fitness tracker opens from the landing page and links back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: new RegExp(featureStrings.fitnessTracker.title) }).click();

    await expect(page).toHaveURL('/fitness-tracker');

    await page.getByRole('link', { name: featureStrings.backToFeatures }).click();
    await expect(page).toHaveURL('/');
  });

  test('the fitness tracker opens directly from its address', async ({ page }) => {
    await page.goto('/fitness-tracker');

    await expect(
      page.getByRole('heading', { level: 1, name: featureStrings.fitnessTracker.title }),
    ).toBeVisible();
  });

  test('an unknown feature address is not found', async ({ page }) => {
    const response = await page.goto('/no-such-feature');

    expect(response?.status()).toBe(404);
  });
});

test.describe('fitness tracker home', () => {
  test('signed in, the fitness tracker offers the weigh-in and the programs link', async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto('/fitness-tracker');

    await expect(page.getByRole('button', { name: fitnessStrings.home.weighIn })).toBeVisible();
    await expect(page.getByRole('link', { name: fitnessStrings.home.programsLink })).toBeVisible();
  });
});
