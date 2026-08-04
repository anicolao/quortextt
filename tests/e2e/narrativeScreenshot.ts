import type { Page, PageScreenshotOptions } from '@playwright/test';

/**
 * Whether this run was explicitly asked to regenerate user-story screenshots.
 */
export const updatesNarrativeScreenshots =
  process.env.QUORTEX_UPDATE_NARRATIVE_SCREENSHOTS === '1';

/**
 * Capture a documentation screenshot only during an explicit story update run.
 */
export async function captureNarrativeScreenshot(
  page: Page,
  options: PageScreenshotOptions,
): Promise<void> {
  if (!updatesNarrativeScreenshots) return;
  await page.screenshot(options);
}
