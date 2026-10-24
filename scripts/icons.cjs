// Render the editable SVG into the PNG sizes required by Chromium's toolbar.
const { chromium } = require('@playwright/test');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  const executablePath = process.env.BROWSER_PATH || (existsSync(brave) ? brave : undefined);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const icons = path.resolve(__dirname, '../extension/icons');
    const svg = readFileSync(path.join(icons, 'toolbar.svg'), 'utf8');
    for (const size of [16, 24, 32]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
      await page.screenshot({ path: path.join(icons, `toolbar-${size}.png`), omitBackground: true });
    }
  } finally {
    await browser.close();
  }
  console.log('Toolbar PNGs generated from extension/icons/toolbar.svg.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
