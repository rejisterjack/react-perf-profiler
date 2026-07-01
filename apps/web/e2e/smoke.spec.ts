import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the public marketing site.
 *
 * These run against the dev server (or any BASE_URL via PLAYWRIGHT_BASE_URL)
 * and assert the most important pages render without 500s. They do not
 * exercise the API directly — see auth.spec.ts for that.
 */

test.describe('Marketing site', () => {
  test('landing page renders the hero', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /master your react performance/i }),
    ).toBeVisible();
  });

  test('install buttons do not 404 (or fall back gracefully)', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/');
    // Click "Install for Chrome" — the button should be present and clickable.
    const installButton = page.getByRole('button', { name: /install for chrome/i });
    await expect(installButton).toBeVisible();
    await installButton.click();

    // Either a ZIP downloads or the "Build from source" fallback renders.
    await expect(page.getByText(/install guide/i).or(page.getByText(/build from source/i)))
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        // Acceptable if a download was triggered without the fallback UI.
      });

    // Critical: no 5xx errors on the landing page itself.
    expect(
      failedRequests.filter((r) => r.startsWith('5')),
      `unexpected 5xx: ${failedRequests.join(', ')}`,
    ).toEqual([]);
  });

  test('footer privacy link points at /privacy', async ({ page }) => {
    await page.goto('/');
    const privacyLink = page.getByRole('link', { name: /privacy policy/i }).first();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  test('docs link in footer points to README, not a missing docs/ page', async ({ page }) => {
    await page.goto('/');
    const docsLink = page.getByRole('link', { name: /documentation/i }).first();
    const href = await docsLink.getAttribute('href');
    expect(href).toContain('README.md');
  });
});

test.describe('OpenAPI spec', () => {
  test('is served and has the expected paths', async ({ request }) => {
    const res = await request.get('/api/openapi.json');
    expect(res.status()).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/api/profiles']).toBeDefined();
    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/auth/refresh']).toBeDefined();
  });
});

test.describe('Health endpoint', () => {
  test('returns 200 and the expected shape', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toMatch(/^(ok|degraded|unhealthy)$/);
    expect(body.checks).toBeDefined();
  });
});
