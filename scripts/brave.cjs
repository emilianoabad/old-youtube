// A separate profile keeps extension development out of your everyday browser.
const { chromium } = require('@playwright/test');
const { existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

(async () => {
  const executablePath = process.env.BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  if (!existsSync(executablePath)) throw new Error('Set BROWSER_PATH to your Brave executable.');
  const extension = path.resolve(__dirname, '../extension');
  const profile = path.join(tmpdir(), 'old-youtube-brave-preview');
  const context = await chromium.launchPersistentContext(profile, {
    executablePath, headless: false, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run'],
  });
  const manager = await context.newPage();
  await manager.goto('chrome://extensions');
  const item = manager.locator('extensions-item').filter({hasText:'Old YouTube'});
  await item.waitFor();
  const id = await item.getAttribute('id');
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/results?search_query=how+to+make+bread', {waitUntil:'domcontentloaded'});
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator('#enabled:not([disabled])').waitFor();
  console.log(`Old YouTube: ${await popup.locator('#status').innerText()}`);
  await manager.close();
  for (const tab of context.pages()) if (tab.url() === 'about:blank') await tab.close();
  await page.bringToFront();
  console.log(`Old YouTube loaded in Brave.\nExtension: ${id}\nSeparate test profile: ${profile}\nClose the Brave test window to stop. No changes were made to your everyday profile.`);
  process.on('SIGINT', () => context.close());
  process.on('SIGTERM', () => context.close());
  await context.waitForEvent('close', {timeout:0});
})().catch(error => { console.error(error.message); process.exitCode = 1; });
