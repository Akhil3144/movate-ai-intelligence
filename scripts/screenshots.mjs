// Run from project root with both services started. Uses synthetic demo records only.
import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const capture = async (path, name, heading, fullPage = true) => {
    await page.goto('http://127.0.0.1:5173' + path);
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; });
    // Wait for Motion's finite opacity reveal to finish, without waiting on ambient loops.
    await page.locator('main > div').evaluate(async el => {
      if (getComputedStyle(el).opacity !== '1') {
        await new Promise(resolve => {
          const check = () => getComputedStyle(el).opacity === '1' ? resolve() : requestAnimationFrame(check);
          check();
        });
      }
    });
    await page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage, animations: 'disabled', style: '[data-sonner-toaster]{display:none !important}' });
  };
  await capture('/', 'overview-light', 'Clarity for every decision.');
  await capture('/agents/OPP-001?compare=1', 'comparison', 'Three paths. One informed choice.');
  await capture('/assistant', 'assistant', 'Meet your operations copilot.');
  await capture('/agents', 'ai-agents-solutions', 'AI Agents & Solutions', false);
  await page.goto('http://127.0.0.1:5173/agents/OPP-008');
  await page.locator('.page-title').getByRole('button', { name: 'Run Agent', exact: true }).click();
  await page.getByTestId('agent-results').waitFor();
  await page.locator('#agent-results').screenshot({ path: 'docs/screenshots/qa-agent-results.png', animations: 'disabled', style: '[data-sonner-toaster]{display:none !important}' });
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await capture('/', 'overview-dark', 'Clarity for every decision.');
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('/', 'mobile-overview', 'Clarity for every decision.');
  console.log('Saved seven screenshots in docs/screenshots.');
} finally { await browser.close(); }
