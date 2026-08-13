// Second pass: POST body (echo) and bearer-auth requests through the mock API.
import { chromium } from 'playwright';

const log = (...args) => console.log('[verify2]', ...args);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => log('pageerror:', error.message));

await page.goto('http://localhost:8008/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 });
await page.waitForTimeout(1500);

const openRequest = async (collectionName, folderName, requestName) => {
  const collapsed = await page.locator('.collection-item-name', { hasText: folderName }).count() === 0;
  if (collapsed) {
    await page.getByText(collectionName, { exact: false }).first().click();
    await page.waitForTimeout(800);
  }
  const folder = page.locator('.collection-item-name', { hasText: folderName }).first();
  const requestHidden = await page.locator('.collection-item-name', { hasText: requestName }).count() === 0;
  if (requestHidden) {
    await folder.click();
    await page.waitForTimeout(500);
  }
  await page.locator('.collection-item-name', { hasText: requestName }).first().click();
  await page.waitForTimeout(1200);
};

const selectEnv = async () => {
  const noEnv = page.getByText('No Environment', { exact: false }).first();
  if (await noEnv.count()) {
    await noEnv.click();
    await page.waitForTimeout(600);
    await page.getByText('local', { exact: true }).first().click();
    await page.waitForTimeout(600);
  }
};

const send = async () => {
  await page.getByRole('button', { name: 'Send', exact: true }).first().click();
  await page.waitForTimeout(3000);
};

await openRequest('Mock API', 'Misc', 'Echo Request');
await selectEnv();
await send();
let text = await page.evaluate(() => document.body.innerText);
log('echo ok:', text.includes('hello mock server') && text.includes('X-Custom-Header') === false);
await page.screenshot({ path: '/tmp/bruno-web-5-echo.png' });

await openRequest('Mock API', 'Auth', 'Get Current User');
await send();
text = await page.evaluate(() => document.body.innerText);
log('bearer auth ok:', text.includes('Ada Lovelace'));
await page.screenshot({ path: '/tmp/bruno-web-6-auth.png' });

await openRequest('Mock API', 'Misc', 'Status 500');
await send();
text = await page.evaluate(() => document.body.innerText);
log('500 shown:', text.includes('500'));
await page.screenshot({ path: '/tmp/bruno-web-7-500.png' });

await browser.close();
