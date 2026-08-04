import { expect, test } from '@playwright/test';
import { getReduxState, waitForAnimationFrame } from './helpers';

test('loads the tabletop and accepts its primary interaction', async ({ page }, testInfo) => {
  await page.goto('/quortextt/tabletop.html');

  const canvas = page.locator('canvas#game-canvas');
  await expect(canvas).toBeVisible();

  const viewportFits = await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  ));
  expect(viewportFits).toBe(true);

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Canvas not found');

  const blueButton = await page.evaluate(() => {
    const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const minDimension = Math.min(gameCanvas.width, gameCanvas.height);
    const buttonSize = Math.max(60, minDimension * 0.08);
    const edgeMargin = minDimension * 0.05;
    const buttonSpacing = buttonSize * 0.3;
    const totalWidth = 6 * buttonSize + 5 * buttonSpacing;

    return {
      x: (gameCanvas.width - totalWidth) / 2 + buttonSize / 2,
      y: gameCanvas.height - edgeMargin - buttonSize / 2,
    };
  });

  const x = canvasBox.x + blueButton.x;
  const y = canvasBox.y + blueButton.y;
  if (testInfo.project.use.hasTouch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
  await waitForAnimationFrame(page);

  const state = await getReduxState(page);
  expect(state.game.configPlayers).toHaveLength(1);
  expect(state.game.configPlayers[0].color).toBe('#0173B2');
});
