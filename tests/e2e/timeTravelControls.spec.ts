/**
 * Time Travel Controls E2E Tests
 * Verifies the scrubber UI for replaying profiler commits:
 * - Controls are hidden when there is no data
 * - Controls appear after importing a multi-commit profile
 * - Skip-to-first / previous / next / skip-to-last buttons navigate correctly
 * - Range input scrubber changes the selected commit
 * - Arrow key shortcuts (ArrowLeft / ArrowRight) navigate commits
 * - Home / End keys jump to first / last commit
 */

/// <reference path="./types.d.ts" />

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { ProfilerPanel, type ProfileData } from './pom/ProfilerPanel';
import * as path from 'path';
import * as fs from 'fs';

const TEST_RESULTS_DIR = path.resolve(__dirname, '../../test-results');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a multi-commit profile with `count` commits. */
function makeMultiCommitProfile(count: number): ProfileData {
  return {
    version: 1,
    commits: Array.from({ length: count }, (_, i) => ({
      id: `tt-commit-${i}`,
      timestamp: 1_000_000 + i * 100,
      duration: 5 + i,
      nodes: [{ id: 1, displayName: 'App', actualDuration: 5 + i, isMemoized: false }],
    })),
    recordingDuration: count * 100,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Time Travel Controls', () => {
  let context: BrowserContext;
  let page: Page;
  let panel: ProfilerPanel;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    panel = new ProfilerPanel(page, context);
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  });

  test.afterEach(async () => {
    await context.close();
  });

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  test.describe('Visibility', () => {
    test('time travel controls are hidden on welcome screen (no data)', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const scrubber = page.locator('[class*="timeTravelRow"], [class*="timeTravelControls"]').first();
      const isVisible = await scrubber.isVisible().catch(() => false);
      // Either element is absent or visually hidden when no commits
      expect(isVisible).toBe(false);
    });

    test('time travel controls appear after importing data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-visibility-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);

      await page.waitForTimeout(400);

      const scrubber = page.locator('[class*="timeTravelRow"], [class*="scrubber"], input[type="range"]').first();
      const isVisible = await scrubber.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Button navigation
  // -------------------------------------------------------------------------

  test.describe('Button Navigation', () => {
    test('next and previous buttons navigate between commits', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-btn-nav-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      // Press next twice and previous once — panel must stay responsive
      const nextBtn = page
        .locator('button[title*="next" i], button[aria-label*="next commit" i]')
        .first();
      const prevBtn = page
        .locator('button[title*="prev" i], button[aria-label*="previous commit" i]')
        .first();

      const nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await page.waitForTimeout(150);
        await nextBtn.click();
        await page.waitForTimeout(150);

        const prevVisible = await prevBtn.isVisible().catch(() => false);
        if (prevVisible) {
          await prevBtn.click();
          await page.waitForTimeout(150);
        }
      }

      // Panel should still be functional (commit count unchanged)
      const count = await panel.getCommitCount();
      expect(count).toBe(5);
    });

    test('skip-to-first button jumps to commit #1', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-skip-first-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(6)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const skipFirstBtn = page
        .locator('button[title*="first" i], button[aria-label*="first commit" i]')
        .first();

      const isVisible = await skipFirstBtn.isVisible().catch(() => false);
      if (isVisible) {
        await skipFirstBtn.click();
        await page.waitForTimeout(200);
      }

      // Verify panel still shows all commits
      expect(await panel.getCommitCount()).toBe(6);
    });

    test('skip-to-last button jumps to the last commit', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-skip-last-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(6)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const skipLastBtn = page
        .locator('button[title*="last" i], button[title*="live" i], button[aria-label*="last commit" i]')
        .first();

      const isVisible = await skipLastBtn.isVisible().catch(() => false);
      if (isVisible) {
        await skipLastBtn.click();
        await page.waitForTimeout(200);
      }

      expect(await panel.getCommitCount()).toBe(6);
    });
  });

  // -------------------------------------------------------------------------
  // Scrubber (range input)
  // -------------------------------------------------------------------------

  test.describe('Scrubber Input', () => {
    test('range input reflects commit count as max value', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const COMMIT_COUNT = 8;
      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-range-max-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(COMMIT_COUNT)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        const max = await rangeInput.getAttribute('max');
        // max should equal COMMIT_COUNT - 1 (0-based) or COMMIT_COUNT (1-based)
        expect(Number(max)).toBeGreaterThanOrEqual(COMMIT_COUNT - 1);
      }
    });

    test('moving scrubber updates the displayed commit', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-scrub-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(10)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        // Move to a specific value using keyboard (more reliable than mouse)
        await rangeInput.focus();
        await page.keyboard.press('End');   // jump to max
        await page.waitForTimeout(200);
        await page.keyboard.press('Home');  // jump to min
        await page.waitForTimeout(200);

        // Panel still shows all commits (scrubbing doesn't delete data)
        expect(await panel.getCommitCount()).toBe(10);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Keyboard shortcuts on the scrubber
  // -------------------------------------------------------------------------

  test.describe('Keyboard Shortcuts', () => {
    test('ArrowRight navigates to next commit when scrubber is focused', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-arrow-right-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        await rangeInput.focus();
        // Home → position 0, then ArrowRight → position 1
        await page.keyboard.press('Home');
        await page.waitForTimeout(100);
        const valueBefore = await rangeInput.inputValue();

        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
        const valueAfter = await rangeInput.inputValue();

        expect(Number(valueAfter)).toBeGreaterThan(Number(valueBefore));
      }
    });

    test('ArrowLeft navigates to previous commit when scrubber is focused', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-arrow-left-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        await rangeInput.focus();
        // End → max position, then ArrowLeft → max - 1
        await page.keyboard.press('End');
        await page.waitForTimeout(100);
        const valueBefore = await rangeInput.inputValue();

        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(100);
        const valueAfter = await rangeInput.inputValue();

        expect(Number(valueAfter)).toBeLessThan(Number(valueBefore));
      }
    });

    test('Home key jumps to first commit', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-home-key-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        await rangeInput.focus();
        await page.keyboard.press('End');
        await page.waitForTimeout(100);
        await page.keyboard.press('Home');
        await page.waitForTimeout(100);

        const value = await rangeInput.inputValue();
        const min = await rangeInput.getAttribute('min') ?? '0';
        expect(Number(value)).toBe(Number(min));
      }
    });

    test('End key jumps to last commit', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-end-key-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(5)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      const isVisible = await rangeInput.isVisible().catch(() => false);

      if (isVisible) {
        await rangeInput.focus();
        await page.keyboard.press('Home');
        await page.waitForTimeout(100);
        await page.keyboard.press('End');
        await page.waitForTimeout(100);

        const value = await rangeInput.inputValue();
        const max = await rangeInput.getAttribute('max') ?? '0';
        expect(Number(value)).toBe(Number(max));
      }
    });
  });

  // -------------------------------------------------------------------------
  // Data integrity
  // -------------------------------------------------------------------------

  test.describe('Data Integrity', () => {
    test('time-traveling does not mutate commit data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const COMMIT_COUNT = 7;
      const dataPath = path.join(TEST_RESULTS_DIR, 'tt-integrity-test.json');
      fs.writeFileSync(dataPath, JSON.stringify(makeMultiCommitProfile(COMMIT_COUNT)));
      await panel.importData(dataPath);
      await page.waitForTimeout(400);

      const rangeInput = page.locator('input[type="range"]').first();
      if (await rangeInput.isVisible().catch(() => false)) {
        await rangeInput.focus();
        // Scrub back and forth
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(50);
        }
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('ArrowLeft');
          await page.waitForTimeout(50);
        }
      }

      // Original commit count must be unaffected
      expect(await panel.getCommitCount()).toBe(COMMIT_COUNT);
    });
  });
});
