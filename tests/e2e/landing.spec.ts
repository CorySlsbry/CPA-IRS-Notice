import { expect, test } from '@playwright/test';

test('landing page renders all key sections + CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/IRS Notice Responses/i);
  await expect(page.getByText(/Triple Guarantee/)).toBeVisible();
  await expect(page.getByText(/value of the bundle/i)).toBeVisible();
  await expect(page.getByText(/How it works/i)).toBeVisible();
  await expect(page.getByText(/Built by a CPA/i)).toBeVisible();
  await expect(page.getByText(/Founding/i)).toBeVisible();
});

test('CTA opens trial modal with two tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start 14-Day Free Trial/ }).first().click();
  await expect(page.getByText(/Start your 14-day trial/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Solo opt-in/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Refer 2/ })).toBeVisible();
});

test('pricing page lists three tiers', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Founding')).toBeVisible();
  await expect(page.getByText('Standard')).toBeVisible();
  await expect(page.getByText('Pro')).toBeVisible();
});
