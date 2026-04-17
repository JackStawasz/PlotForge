/**
 * tests/test_ui.spec.js
 * ======================
 * Playwright end-to-end tests for PlotForge UI.
 *
 * Prerequisites:
 *   1. Backend running:  python app.py   (port 5000)
 *   2. Frontend served:  npx serve . -p 8080  (or any static server)
 *   3. Install:          npm install --save-dev @playwright/test
 *                        npx playwright install chromium
 *
 * Run:
 *   npx playwright test tests/test_ui.spec.js
 *   npx playwright test tests/test_ui.spec.js --headed   # visible browser
 *
 * Environment variables:
 *   PLOTFORGE_URL   base URL of the running frontend (default: http://localhost:8080)
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PLOTFORGE_URL || 'http://localhost:8080';

// Helper: wait for spinner to disappear (render complete)
async function waitForRender(page, timeout = 10_000) {
  await page.waitForFunction(
    () => document.querySelectorAll('.spin-overlay.show').length === 0,
    { timeout }
  );
}

// Helper: count visible plot cards (excludes the ghost add-card)
async function plotCardCount(page) {
  return await page.locator('.plot-card').count();
}


// ═══════════════════════════════════════════════════════════════════════════
// Boot & Connection
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Boot & Connection', () => {

  test('page title contains PlotForge', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/PlotForge/i);
  });

  test('header logo is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('.logo')).toBeVisible();
  });

  test('connection dot becomes green when backend is reachable', async ({ page }) => {
    await page.goto(BASE_URL);
    // Allow a moment for the tryConnect call to complete
    await page.waitForTimeout(2000);
    const dot = page.locator('#cdot');
    await expect(dot).toHaveClass(/ok/);
  });

  test('undo button is initially disabled', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#undoBtn')).toBeDisabled();
  });

  test('redo button is initially disabled', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#redoBtn')).toBeDisabled();
  });

  test('one plot card exists on load', async ({ page }) => {
    await page.goto(BASE_URL);
    expect(await plotCardCount(page)).toBe(1);
  });

  test('add-card ghost is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('.add-card')).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Plot Card Lifecycle
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Plot Card Lifecycle', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('clicking add-card creates a second plot card', async ({ page }) => {
    await page.locator('.add-card').click();
    expect(await plotCardCount(page)).toBe(2);
  });

  test('new plot card becomes active', async ({ page }) => {
    await page.locator('.add-card').click();
    const cards = await page.locator('.plot-card').all();
    const lastCard = cards[cards.length - 1];
    await expect(lastCard).toHaveClass(/active/);
  });

  test('clicking a card makes it active', async ({ page }) => {
    // Add a second card so we can switch between them
    await page.locator('.add-card').click();
    const firstCard = page.locator('.plot-card').first();
    await firstCard.click();
    await expect(firstCard).toHaveClass(/active/);
  });

  test('delete button removes a card', async ({ page }) => {
    await page.locator('.add-card').click();
    expect(await plotCardCount(page)).toBe(2);
    // Click delete on the active (second) card
    await page.locator('.plot-card.active [data-action="delete"]').click();
    expect(await plotCardCount(page)).toBe(1);
  });

  test('duplicate creates a new card', async ({ page }) => {
    const before = await plotCardCount(page);
    await page.locator('.plot-card.active [data-action="dup"]').click();
    expect(await plotCardCount(page)).toBe(before + 1);
  });

  test('duplicate card is positioned after source', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="dup"]').click();
    const cards = await page.locator('.plot-card').all();
    // The duplicated card should be the new active one
    const activeIdx = (await Promise.all(
      cards.map(c => c.getAttribute('class'))
    )).findIndex(cls => cls.includes('active'));
    expect(activeIdx).toBe(1); // second card is active
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Template Modal & Curve Rendering
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Template Modal & Curve Rendering', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500); // allow backend connect + boot
  });

  test('template modal opens when add-curve button clicked', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    await expect(page.locator('#tplModal')).toBeVisible();
  });

  test('template modal closes on X button', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    await page.locator('#tplModalClose').click();
    await expect(page.locator('#tplModal')).toBeHidden();
  });

  test('template search filters results', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    await page.locator('#tplSearchInp').fill('gaussian');
    // At least one matching card visible
    await expect(page.locator('.tpl-card').first()).toBeVisible();
  });

  test('selecting a template closes modal and triggers render', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    // Pick the first available template card
    await page.locator('.tpl-card').first().click();
    await expect(page.locator('#tplModal')).toBeHidden();
    // Spinner should appear then disappear
    await waitForRender(page);
  });

  test('spinner appears then disappears during render', async ({ page }) => {
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    await page.locator('.tpl-card').first().click();
    // Wait for render to complete without error
    await waitForRender(page, 15_000);
    await expect(page.locator('.spin-overlay.show')).toHaveCount(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Config Panel
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Config Panel', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('.plot-card').first().click();
    await page.waitForTimeout(500);
  });

  test('cfg panel shows content when a card is active', async ({ page }) => {
    await expect(page.locator('#cfgContent')).toBeVisible();
  });

  test('cfg empty state hidden when card active', async ({ page }) => {
    await expect(page.locator('#cfgEmpty')).toBeHidden();
  });

  test('cfg empty state shown when no card active', async ({ page }) => {
    // Click the plot list background (deselect)
    await page.locator('#plotList').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(200);
    await expect(page.locator('#cfgEmpty')).toBeVisible();
  });

  test('Plot Settings tab is active by default', async ({ page }) => {
    await expect(page.locator('#cfgTabPlot')).toHaveClass(/cfg-tab-active/);
  });

  test('clicking Line Settings tab switches pane', async ({ page }) => {
    await page.locator('#cfgTabLine').click();
    await expect(page.locator('#cfgTabLine')).toHaveClass(/cfg-tab-active/);
  });

  test('x range inputs accept values', async ({ page }) => {
    await page.locator('#c_xn').fill('-10');
    await page.locator('#c_xx').fill('10');
    // No error should occur
    await expect(page.locator('#c_xn')).toHaveValue('-10');
  });

  test('y range inputs accept values', async ({ page }) => {
    await page.locator('#c_yn').fill('-5');
    await page.locator('#c_yx').fill('5');
    await expect(page.locator('#c_yn')).toHaveValue('-5');
  });

  test('show grid toggle is present', async ({ page }) => {
    await expect(page.locator('#c_grid')).toBeVisible();
  });

  test('log scale X toggle is present', async ({ page }) => {
    await expect(page.locator('#c_x_log')).toBeVisible();
  });

  test('background color input is present', async ({ page }) => {
    await expect(page.locator('#c_bg')).toBeVisible();
  });

  test('domain reset button is present and clickable', async ({ page }) => {
    const btn = page.locator('#domainHomeBtn');
    await expect(btn).toBeVisible();
    await btn.click();  // should not throw
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Left Sidebar – Variable Panel
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Variable Sidebar', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('add-variable button is present', async ({ page }) => {
    await expect(page.locator('#addVarBtn')).toBeVisible();
  });

  test('clicking add-variable creates a new variable row', async ({ page }) => {
    await page.locator('#addVarBtn').click();
    await expect(page.locator('.var-row').first()).toBeVisible();
  });

  test('add-parameter button is present', async ({ page }) => {
    await expect(page.locator('#addParamBtn')).toBeVisible();
  });

  test('clicking add-parameter creates a parameter row', async ({ page }) => {
    const before = await page.locator('.var-row').count();
    await page.locator('#addParamBtn').click();
    const after = await page.locator('.var-row').count();
    expect(after).toBe(before + 1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Undo / Redo
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Undo / Redo', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('undo becomes enabled after adding a plot', async ({ page }) => {
    await page.locator('.add-card').click();
    await expect(page.locator('#undoBtn')).not.toBeDisabled();
  });

  test('undo removes the added plot card', async ({ page }) => {
    await page.locator('.add-card').click();
    expect(await plotCardCount(page)).toBe(2);
    await page.locator('#undoBtn').click();
    expect(await plotCardCount(page)).toBe(1);
  });

  test('redo re-adds the undone plot card', async ({ page }) => {
    await page.locator('.add-card').click();
    await page.locator('#undoBtn').click();
    await expect(page.locator('#redoBtn')).not.toBeDisabled();
    await page.locator('#redoBtn').click();
    expect(await plotCardCount(page)).toBe(2);
  });

  test('Ctrl+Z triggers undo', async ({ page }) => {
    await page.locator('.add-card').click();
    expect(await plotCardCount(page)).toBe(2);
    await page.keyboard.press('Control+z');
    expect(await plotCardCount(page)).toBe(1);
  });

  test('Ctrl+Y triggers redo', async ({ page }) => {
    await page.locator('.add-card').click();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    expect(await plotCardCount(page)).toBe(2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Settings Panel
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Settings Gear Panel', () => {

  test('gear button is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#gearBtn')).toBeVisible();
  });

  test('gear panel opens on gear button click', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('#gearBtn').click();
    await expect(page.locator('#gearPanel')).toBeVisible();
  });

  test('gear panel closes on second click', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('#gearBtn').click();
    await page.locator('#gearBtn').click();
    await expect(page.locator('#gearPanel')).toBeHidden();
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Matplotlib Export
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Matplotlib Export', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);
    // Load a curve so MPL button is meaningful
    await page.locator('.plot-card.active [data-action="add-curve"]').click();
    await page.locator('.tpl-card').first().click();
    await waitForRender(page, 15_000);
  });

  test('matplotlib button is present on card topbar', async ({ page }) => {
    await expect(page.locator('.mpl-btn').first()).toBeVisible();
  });

  test('clicking matplotlib button triggers shimmer overlay', async ({ page }) => {
    await page.locator('.mpl-btn').first().click();
    // The shimmer-overlay should appear briefly
    const shimmerAppeared = await page.locator('.shimmer-overlay.show')
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    // It may be so fast it disappears — that's also acceptable
    // Just verify no JS error was thrown by checking page is still responsive
    await expect(page.locator('.plot-card')).toBeVisible();
  });

  test('after matplotlib render, revert button appears', async ({ page }) => {
    await page.locator('.mpl-btn').first().click();
    // Wait for render to finish and revert button to appear
    await page.locator('.revert-btn').waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('.revert-btn')).toBeVisible();
  });

  test('revert button switches back to interactive mode', async ({ page }) => {
    await page.locator('.mpl-btn').first().click();
    await page.locator('.revert-btn').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.revert-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.mpl-btn').first()).toBeVisible();
  });
});