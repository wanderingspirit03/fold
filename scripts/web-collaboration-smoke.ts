import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const EDIT_MARKER = `Collab smoke ${Date.now()}.`;
const COMMENT_MARKER = `Thread smoke ${Date.now()}.`;
const REPLY_MARKER = `Reply smoke ${Date.now()}.`;
const LOCAL_CONFLICT_MARKER = `Keep local conflict ${Date.now()}.`;
const REMOTE_CONFLICT_MARKER = `Remote conflict ${Date.now()}.`;
const SECOND_LOCAL_CONFLICT_MARKER = `Second local conflict ${Date.now()}.`;
const ACCEPTED_REMOTE_CONFLICT_MARKER = `Accepted remote conflict ${Date.now()}.`;

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

    await step("client-b receives live edit", () => pageB.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      EDIT_MARKER,
      { timeout: 8_000 },
    ));

    await pageB.getByRole("button", { name: "Edit", exact: true }).click();
    const editorB = pageB.locator("textarea").first();
    await editorB.waitFor({ timeout: 10_000 });
    await pauseProjectFileSaveDebounce(pageA);
    await editor.fill(`${await editor.inputValue()}\n\n${LOCAL_CONFLICT_MARKER}`);
    await editorB.fill(`${await editorB.inputValue()}\n\n${REMOTE_CONFLICT_MARKER}`);
    await editorB.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
    await pageA.getByRole("button", { name: /open review, 1 incoming edit/i }).click({ timeout: 8_000 });
    await pageA.getByRole("button", { name: "Keep mine", exact: true }).click();
    await step("client-a keeps local conflict", () => waitForEditorValue(pageA,
      [LOCAL_CONFLICT_MARKER, REMOTE_CONFLICT_MARKER],
    ));
    await step("client-b receives kept local conflict", () => waitForEditorValue(pageB, [LOCAL_CONFLICT_MARKER, REMOTE_CONFLICT_MARKER]));

    await editor.fill(`${await editor.inputValue()}\n\n${SECOND_LOCAL_CONFLICT_MARKER}`);
    await editorB.fill(`${await editorB.inputValue()}\n\n${ACCEPTED_REMOTE_CONFLICT_MARKER}`);
    await editorB.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
    await pageA.getByRole("button", { name: "Use incoming", exact: true }).click();
    await pageA.getByRole("button", { name: /confirm incoming edit/i }).click({ timeout: 8_000 });
    await step("client-a applies incoming conflict", () => waitForEditorValue(pageA, [ACCEPTED_REMOTE_CONFLICT_MARKER, SECOND_LOCAL_CONFLICT_MARKER]));

    await pageA.getByRole("button", { name: "Close review", exact: true }).click();
    await pageA.getByRole("button", { name: "Read", exact: true }).click();
    await pageB.getByRole("button", { name: "Read", exact: true }).click();
    const surfaceA = pageA.locator('[data-document-surface="true"]');
    await surfaceA.getByRole("button", { name: "Add file comment", exact: true }).click();
    await surfaceA.getByRole("textbox", { name: "File comment" }).fill(COMMENT_MARKER);
    await surfaceA.getByRole("button", { name: "Add", exact: true }).click();

    await pageB.getByRole("button", { name: /open 1 file comment/i }).click({ timeout: 8_000 });
    await pageB.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      COMMENT_MARKER,
      { timeout: 8_000 },
    );
    await pageB.getByLabel("Reply to comment").fill(REPLY_MARKER);
    await pageB.getByRole("button", { name: "Reply", exact: true }).click();

    await pageA.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      REPLY_MARKER,
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
          commentMarker: COMMENT_MARKER,
          replyMarker: REPLY_MARKER,
          localConflictMarker: LOCAL_CONFLICT_MARKER,
          remoteConflictMarker: REMOTE_CONFLICT_MARKER,
          acceptedRemoteConflictMarker: ACCEPTED_REMOTE_CONFLICT_MARKER,
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

async function step<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForEditorValue(page: Page, markers: [expected: string] | [expected: string, absent: string]) {
  await page.waitForFunction(
    ([expected, absent]) => {
      const textarea = document.querySelector("textarea");
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const value = textarea.value;
      return value.includes(expected) && (!absent || !value.includes(absent));
    },
    markers,
    { timeout: 8_000 },
  );
}

async function pauseProjectFileSaveDebounce(page: Page) {
  await page.evaluate(() => {
    const windowWithHook = window as typeof window & {
      __foldPauseProjectFileSaveDebounce?: boolean;
      __foldOriginalSetTimeout?: typeof window.setTimeout;
    };
    if (windowWithHook.__foldPauseProjectFileSaveDebounce) return;
    windowWithHook.__foldPauseProjectFileSaveDebounce = true;
    windowWithHook.__foldOriginalSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const nextTimeout = timeout === 700 ? 60_000 : timeout;
      return windowWithHook.__foldOriginalSetTimeout!(handler, nextTimeout, ...args);
    }) as typeof window.setTimeout;
  });
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
