import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const messages = [];
page.on('console', (msg) => messages.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (err) => messages.push(`pageerror: ${err.message}`));
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 30000 });
await page.getByRole('button', { name: /create room/i }).click();
await page.waitForURL(/\/room\//, { timeout: 15000 });
await page.waitForLoadState('networkidle');
const roomErrors = [...messages];
console.log(JSON.stringify({ messageCount: roomErrors.length, messages: roomErrors.slice(0, 20) }, null, 2));
await browser.close();
