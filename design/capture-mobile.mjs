import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 30000 });
await page.getByRole('button', { name: /create room/i }).click();
await page.waitForURL(/\/room\//, { timeout: 15000 });
await page.getByRole('button', { name: /edit/i }).click();
await page.locator('textarea').first().fill(`# Mobile Room\n\nA selected Markdown document should be readable and reviewable on a phone.\n\n- Security is calm\n- Threads remain useful\n`);
await page.getByRole('button', { name: 'Read mode' }).click();
await page.screenshot({ path: '/root/repos/agent-md-rooms/design/review-artifacts/room-mobile-390x844.png', fullPage: true });
await browser.close();
console.log('/root/repos/agent-md-rooms/design/review-artifacts/room-mobile-390x844.png');
