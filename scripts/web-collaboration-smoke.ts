import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const EDIT_MARKER = `Collab smoke ${Date.now()}.`;

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-collaboration-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    const contextA = await browser.newContext({ viewport: { width: 1200, height: 850 } });
    const contextB = await browser.newContext({ viewport: { width: 1200, height: 850 } });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await preparePage(pageA, "client-a", logs);
    await preparePage(pageB, "client-b", logs);

    await pageA.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
    await pageA.getByRole("button", { name: /create project/i }).click();
    await pageA.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });

    const roomUrl = pageA.url();
    await pageB.goto(roomUrl, { waitUntil: "networkidle", timeout: 20_000 });
    await pageB.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });

    await pageA.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = pageA.locator("textarea").first();
    await editor.waitFor({ timeout: 10_000 });
    await editor.fill(`${await editor.inputValue()}\n\n${EDIT_MARKER}`);

    await pageB.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      EDIT_MARKER,
      { timeout: 8_000 },
    );

    const screenshotPath = join(screenshotDir, "client-b-after-client-a-edit.png");
    await pageB.screenshot({ path: screenshotPath, fullPage: true, caret: "initial" });

    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during collaboration smoke:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomUrl,
          marker: EDIT_MARKER,
          screenshotPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

async function preparePage(page: Page, label: string, logs: string[]) {
  page.on("console", (message) => {
    if (message.type() === "info" && message.text().includes("React DevTools")) return;
    if (message.type() === "log" && message.text().includes("[HMR]")) return;
    logs.push(`${label} console:${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => logs.push(`${label} pageerror: ${error.message}`));
  await page.addInitScript(() => localStorage.setItem("fold:theme", "dark"));
}

async function resolveBaseUrl() {
  const candidates = [process.env.FOLD_WEB_URL, ...DEFAULT_URLS].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (await canReach(candidate)) return candidate;
  }
  throw new Error(
    `No Fold web app responded. Start one first, for example:\n` +
      `  npm run web:dev -- --port 3001\n` +
      `or set FOLD_WEB_URL to an existing app URL.`,
  );
}

async function assertSyncServerReady(syncUrl: string) {
  if (await canReach(`${syncUrl.replace(/\/$/, "")}/health`)) return;

  throw new Error(
    `No Fold sync server responded at ${syncUrl}.\n` +
      `Start it before running the collaboration smoke:\n` +
      `  npm run server -- --port 8787 --data ./data`,
  );
}

async function canReach(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
