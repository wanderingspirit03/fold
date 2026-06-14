import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = '/root/repos/fold/design/review-artifacts';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1200 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1920, height: 1200 } },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'home-1920x1200.png'), fullPage: true });
await page.getByRole('button', { name: /create room/i }).click();
await page.waitForURL(/\/room\//, { timeout: 15000 });
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(outDir, 'room-empty-read-1920x1200.png'), fullPage: true });

await page.getByRole('button', { name: /edit/i }).click();
await page.waitForTimeout(300);
const sample = `# Agent Studio Notes\n\nThis Markdown room should feel like a quiet encrypted studio, not a generic AI dashboard. The document is the primary artifact; agents and humans work around it through anchored margin threads.\n\n## Collaboration model\n\nSelect a sentence, leave a contextual note, and let an agent propose a suggested edit in place. Whole-document proposals still exist as a safety layer, while contextual review stays close to the Markdown itself.\n\n- Private room link\n- Local key, server blind\n- Portable Markdown export\n- Suggested edits require human acceptance\n\n> The right rail should feel like a calm review bench, with subtle paper tones, varied shadows, and no whiteboard flatness.\n\n\`\`\`ts\ntype Anchor = 'text-range' | 'insertion-point' | 'block' | 'document';\n\`\`\`\n`;
const textarea = page.locator('textarea').first();
await textarea.fill(sample);
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(outDir, 'room-edit-1920x1200.png'), fullPage: true });
await page.getByRole('button', { name: 'Read', exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'room-read-filled-1920x1200.png'), fullPage: true });

await page.mouse.move(400, 320, { steps: 20 });
await page.mouse.wheel(0, 420);
await page.waitForTimeout(500);
await page.mouse.wheel(0, -420);
await page.waitForTimeout(500);

const paragraph = page.getByText(/This Markdown room should feel/).first();
const box = await paragraph.boundingBox();
if (box) {
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 20 });
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 20, 760), box.y + box.height / 2, { steps: 35 });
  await page.mouse.up();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(outDir, 'room-selection-anchor-1920x1200.png'), fullPage: true });

await context.close();
await browser.close();

const files = await fs.readdir(outDir);
const webm = files.filter((f) => f.endsWith('.webm')).sort().at(-1);
if (webm) {
  await fs.rename(path.join(outDir, webm), path.join(outDir, 'room-ui-walkthrough-1920x1200.webm'));
}
console.log(outDir);
