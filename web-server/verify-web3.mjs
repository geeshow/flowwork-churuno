// Workspace-mode verification: dropdown lists branch workspaces, switching
// swaps collections, saving a request auto-commits to the right branch.
import { chromium } from 'playwright';

const log = (...args) => console.log('[verify3]', ...args);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => log('pageerror:', error.message));

await page.goto('http://localhost:8008/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 });
await page.waitForTimeout(2000);

let text = await page.evaluate(() => document.body.innerText);
log('collections of first workspace visible:', text.includes('flowwork-apis'), text.includes('Sample API'));
await page.screenshot({ path: '/tmp/bruno-web-8-ws1.png' });

// open the workspace switcher (top-left dropdown)
const wsSwitcher = page.locator('[data-testid="workspace-selector"], .workspace-selector').first();
if (await wsSwitcher.count()) {
  await wsSwitcher.click();
} else {
  await page.getByText('demo', { exact: false }).first().click().catch(async () => {
    await page.locator('header, [class*=titlebar]').getByText(/demo|kyutae/i).first().click();
  });
}
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/bruno-web-9-ws-dropdown.png' });
text = await page.evaluate(() => document.body.innerText);
log('dropdown shows both workspaces:', text.includes('demo') && text.includes('kyutae'));

// switch to the other workspace
const target = page.getByText('kyutae', { exact: true }).first();
if (await target.count()) {
  await target.click();
  await page.waitForTimeout(2500);
}
text = await page.evaluate(() => document.body.innerText);
log('after switch, collections visible:', text.includes('flowwork-apis'));
await page.screenshot({ path: '/tmp/bruno-web-10-ws2.png' });

// open flowwork-apis > core > 사용자 > request, edit URL and save (⌘S)
await page.getByText('flowwork-apis', { exact: false }).first().click();
await page.waitForTimeout(1200);
const coreFolder = page.locator('.collection-item-name', { hasText: 'core' }).first();
if (await coreFolder.count()) {
  await coreFolder.click();
  await page.waitForTimeout(700);
}
const userFolder = page.locator('.collection-item-name', { hasText: '사용자' }).first();
if (await userFolder.count()) {
  await userFolder.click();
  await page.waitForTimeout(700);
}
const req = page.locator('.collection-item-name', { hasText: '사용자 정보 조회' }).first();
if (await req.count()) {
  await req.click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: '/tmp/bruno-web-11-request.png' });

// type into the url bar to create a draft, then save
const urlInput = page.locator('#request-url .CodeMirror, .input-container .CodeMirror').first();
if (await urlInput.count()) {
  await urlInput.click();
  await page.keyboard.press('End');
  await page.keyboard.type('&edited=1');
  await page.waitForTimeout(500);
  await page.keyboard.press('Meta+s');
  log('edited and saved request');
  await page.waitForTimeout(4000);
} else {
  log('WARN: url input not found');
}
await page.screenshot({ path: '/tmp/bruno-web-12-saved.png' });

await browser.close();
