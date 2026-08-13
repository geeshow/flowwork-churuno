// Reproduce reload-with-saved-snapshot: first load saves a snapshot to
// localStorage, the reload then hydrates from it.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (error) => console.log('[pageerror]', error.message, '\n', (error.stack || '').split('\n').slice(0, 4).join('\n')));

await page.goto('http://localhost:8008/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 }).catch(() => console.log('[warn] load 1 not reached'));
// open a request so tabs/snapshot get content, then let the 1s-debounced snapshot save fire
await page.getByText('Sample API', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(4000);
const snapshot = await page.evaluate(() => window.localStorage.getItem('bruno-web:snapshot'));
console.log('[snapshot saved]', snapshot ? `${snapshot.length} bytes` : 'NONE');
if (snapshot) console.log('[snapshot]', snapshot.slice(0, 600));

console.log('--- reloading ---');
await page.reload({ waitUntil: 'domcontentloaded' });
const loaded = await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 }).then(() => true).catch(() => false);
console.log('[reload loaded]', loaded);
await page.waitForTimeout(2000);
console.log('[root]', (await page.evaluate(() => document.getElementById('root')?.innerText.slice(0, 120) || '(empty)')));
await page.screenshot({ path: '/tmp/bruno-web-reload.png' });
await browser.close();
