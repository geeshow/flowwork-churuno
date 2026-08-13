import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) console.log(`[${msg.type()}]`, msg.text().slice(0, 500));
});
page.on('pageerror', (error) => console.log('[pageerror]', error.message, '\n', (error.stack || '').slice(0, 1000)));
await page.goto('http://localhost:8008/', { waitUntil: 'load' });
await page.waitForTimeout(5000);
console.log('[root html]', (await page.evaluate(() => document.getElementById('root')?.innerHTML.slice(0, 300))) || '(empty)');
await browser.close();
