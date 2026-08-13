// Browser smoke test for Bruno web mode: boot, sidebar, open a request, send it.
import { chromium } from 'playwright';

const log = (...args) => console.log('[verify]', ...args);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

await page.goto('http://localhost:8008/', { waitUntil: 'domcontentloaded' });

try {
  await page.waitForSelector('[data-app-state="loaded"]', { timeout: 15000 });
  log('app state: loaded');
} catch (_e) {
  log('WARN: data-app-state=loaded not reached');
}

await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/bruno-web-1-boot.png' });

const sidebarText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
log('collections visible:', sidebarText.includes('Mock API'), sidebarText.includes('Demo Collection'));

// expand the Mock API collection
const mockRow = page.locator('.collection-name-text', { hasText: 'Mock API' }).first();
if (await mockRow.count()) {
  await mockRow.click();
} else {
  // fallback: click by text anywhere
  await page.getByText('Mock API', { exact: false }).first().click();
}
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/bruno-web-2-collection.png' });

// open Users folder then List Users request
const usersFolder = page.locator('.collection-item-name', { hasText: 'Users' }).first();
if (await usersFolder.count()) {
  await usersFolder.click();
  await page.waitForTimeout(800);
}
const listUsers = page.locator('.collection-item-name', { hasText: 'List Users' }).first();
if (await listUsers.count()) {
  await listUsers.click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: '/tmp/bruno-web-3-request.png' });

// select the "local" environment via the environment dropdown
try {
  const envSelector = page.getByText('No Environment', { exact: false }).first();
  if (await envSelector.count()) {
    await envSelector.click();
    await page.waitForTimeout(700);
    const localEnv = page.getByText('local', { exact: true }).first();
    if (await localEnv.count()) {
      await localEnv.click();
      log('environment "local" selected');
    } else {
      log('WARN: "local" env not found in dropdown');
      await page.keyboard.press('Escape');
    }
  } else {
    log('env selector not found (maybe already selected)');
  }
} catch (error) {
  log('env selection skipped:', error.message);
}
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/bruno-web-3b-env.png' });

// send the request via the main Send button
const sendButton = page.getByRole('button', { name: 'Send', exact: true }).first();
if (await sendButton.count()) {
  await sendButton.click();
  log('clicked Send');
} else {
  await page.keyboard.press('Meta+Enter');
  log('pressed Meta+Enter');
}
await page.waitForTimeout(4000);
await page.screenshot({ path: '/tmp/bruno-web-4-response.png' });

const bodyText = await page.evaluate(() => document.body.innerText);
log('response contains Ada:', bodyText.includes('Ada'));
log('status 200 shown:', /200\s*OK/i.test(bodyText) || bodyText.includes('200'));

log('console errors:', JSON.stringify(consoleErrors.slice(0, 15), null, 2));

await browser.close();
