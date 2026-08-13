// Open the Devtools console (terminal tab) — the crash the user reported.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

await page.goto('http://localhost:8008/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 });
await page.waitForTimeout(1500);

await page.getByText('Dev Tools', { exact: false }).first().click();
await page.waitForTimeout(2500);
const text = await page.evaluate(() => document.body.innerText);
console.log('[devtools open]', text.includes('Console') || text.includes('Terminal') || text.includes('Network'));
await page.screenshot({ path: '/tmp/bruno-web-devtools.png' });

// reload with devtools state persisted in the snapshot
await page.waitForTimeout(2000);
await page.reload({ waitUntil: 'domcontentloaded' });
const loaded = await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 }).then(() => true).catch(() => false);
console.log('[reload with devtools-open snapshot]', loaded);
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/bruno-web-devtools-reload.png' });
await browser.close();
