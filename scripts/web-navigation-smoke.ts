import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const EDIT_MODE_COMMENT_MARKER = `Edit mode source comment ${Date.now()}.`;

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-navigation-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await preparePage(page, "desktop", logs);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
    await page.getByRole("button", { name: /create project/i }).click();
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const sourceEditor = page.getByRole("textbox", { name: /markdown source/i });
    await sourceEditor.waitFor({ state: "visible", timeout: 8_000 });
    const editModeAnchor = await sourceEditor.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error("Markdown source editor is not a textarea.");
      const candidates = ["single Markdown room", "inline comment markers", "dark-first project workspace"];
      const anchor = candidates.find((candidate) => element.value.includes(candidate));
      if (!anchor) throw new Error("Could not find a stable source-editor phrase to annotate.");
      const start = element.value.indexOf(anchor);
      element.focus();
      element.setSelectionRange(start, start + anchor.length);
      element.dispatchEvent(new Event("select", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return anchor;
    });
    await page.getByRole("button", { name: /open command palette/i }).click();
    const editModePaletteInput = page.getByRole("combobox", { name: /search commands and files/i });
    await editModePaletteInput.fill("comment");
    await page.getByRole("option", { name: /add file comment/i }).first().waitFor({ state: "visible", timeout: 8_000 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /add comment to source selection/i }).click({ timeout: 8_000 });
    await page.waitForSelector('[data-comment-composer]', { timeout: 8_000 });
    await page.getByRole("textbox", { name: /^inline comment$/i }).fill(EDIT_MODE_COMMENT_MARKER);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await page.waitForFunction(
      (anchor) => document.querySelector("[data-inline-comment-marker]")?.textContent?.includes(anchor),
      editModeAnchor,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: new RegExp(`open inline comment for ${escapeRegExp(editModeAnchor)}`, "i") }).click({ timeout: 8_000 });
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      EDIT_MODE_COMMENT_MARKER,
      { timeout: 8_000 },
    );

    await page.getByRole("button", { name: /open command palette/i }).click();
    const firstPaletteInput = page.getByRole("combobox", { name: /search commands and files/i });
    await firstPaletteInput.fill("comment");
    await page.getByRole("option", { name: /add file comment/i }).first().click();
    await page.waitForSelector('[data-comment-composer]', { timeout: 8_000 });
    await page.getByRole("textbox", { name: /^file comment$/i }).waitFor({ state: "visible", timeout: 8_000 });
    await page.getByRole("button", { name: /cancel/i }).click();
    await page.waitForSelector('[data-comment-composer]', { state: "hidden", timeout: 8_000 });

    await page.getByRole("button", { name: /open command palette/i }).click();
    const contentSearchInput = page.getByRole("combobox", { name: /search commands and files/i });
    await contentSearchInput.fill("center of gravity");
    await page.getByRole("option", { name: /agent-handoff-review\.md.*center of gravity/i }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes("Agent Handoff Review"), null, { timeout: 8_000 });
    await page.getByRole("link", { name: /review flow/i }).click();
    await page.waitForFunction(() => document.body.innerText.includes("Review Flow"), null, { timeout: 8_000 });

    const architectureFolder = page.getByRole("button", { name: /^architecture/i });
    await architectureFolder.waitFor({ timeout: 10_000 });
    if ((await architectureFolder.getAttribute("aria-expanded")) !== "true") {
      throw new Error("Expected architecture folder to start open.");
    }

    await architectureFolder.click();
    if ((await architectureFolder.getAttribute("aria-expanded")) !== "false") {
      throw new Error("Expected architecture folder to collapse.");
    }

    await page.reload({ waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    const architectureAfterReload = page.getByRole("button", { name: /^architecture/i });
    if ((await architectureAfterReload.getAttribute("aria-expanded")) !== "false") {
      throw new Error("Expected collapsed architecture folder to persist after reload.");
    }

    await page.getByRole("button", { name: /open command palette/i }).click();
    await page.getByRole("combobox", { name: /search commands and files/i }).fill("e2ee");
    await page.getByRole("option", { name: /e2ee\.md/i }).first().click();
    await page.waitForFunction(() => document.body.innerText.includes("E2EE Architecture"), null, { timeout: 8_000 });

    if ((await page.getByRole("button", { name: /^architecture/i }).getAttribute("aria-expanded")) !== "true") {
      throw new Error("Expected quick-switching to a nested file to reopen ancestor folders.");
    }

    await page.getByRole("button", { name: /open command palette/i }).click();
    const paletteInput = page.getByRole("combobox", { name: /search commands and files/i });
    await paletteInput.fill("md");
    await page.waitForFunction(() => /more matches/.test(document.body.innerText), null, { timeout: 8_000 });
    const visibleOptions = await page.getByRole("option").count();
    if (visibleOptions !== 12) {
      throw new Error(`Expected clipped command palette results to show 12 options, saw ${visibleOptions}.`);
    }
    await paletteInput.fill("renderer fidelity");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.innerText.includes("Renderer Fidelity"), null, { timeout: 8_000 });

    const screenshotPath = join(screenshotDir, "quick-switch-reopened-folder.png");
    await page.screenshot({ path: screenshotPath, fullPage: true, caret: "initial" });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during navigation smoke:\n${errors.join("\n")}`);
    }
    if (overflow) {
      throw new Error("Navigation smoke created horizontal overflow.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomUrl: page.url(),
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
      `Start it before running the navigation smoke:\n` +
      `  npm run server -- --port 8787 --data ./data`,
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
