import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const EDIT_MODE_COMMENT_MARKER = `Edit mode source comment ${Date.now()}.`;
const EDIT_MODE_CURSOR_COMMENT_MARKER = `Edit mode cursor comment ${Date.now()}.`;
const AGENT_REQUEST_MARKER = `Agent request ${Date.now()}.`;
const PROPERTY_COMMENT_MARKER = `Property anchor comment ${Date.now()}.`;

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
    await installClipboardProbe(page);
    await page.getByRole("button", { name: /invite human/i }).first().click();
    await page.waitForFunction(() => Boolean((window as typeof window & { __foldClipboardText?: string }).__foldClipboardText), null, { timeout: 8_000 });
    const humanInviteText = await page.evaluate(() => (window as typeof window & { __foldClipboardText?: string }).__foldClipboardText || "");
    if (!humanInviteText.includes("Join this Fold project room")) {
      throw new Error("Human invite copy did not include project join instructions.");
    }
    if (!humanInviteText.includes("#key=") || !humanInviteText.includes("Keep the #key=... fragment")) {
      throw new Error("Human invite copy did not explain the encrypted room key fragment.");
    }
    if (!humanInviteText.includes("Use this sync server") || !humanInviteText.includes("Reachability warning")) {
      throw new Error("Human invite copy did not include sync-server and reachability guidance.");
    }

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
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const cursorEditor = page.getByRole("textbox", { name: /markdown source/i });
    await cursorEditor.waitFor({ state: "visible", timeout: 8_000 });
    await cursorEditor.evaluate((element) => {
      if (!(element instanceof HTMLTextAreaElement)) throw new Error("Markdown source editor is not a textarea.");
      const candidates = ["Keep Markdown canonical.", "Room URL stays shareable.", "Review Flow"];
      const anchor = candidates.find((candidate) => element.value.includes(candidate));
      if (!anchor) throw new Error("Could not find a stable source-editor phrase for cursor annotation.");
      const offset = element.value.indexOf(anchor) + anchor.length;
      element.focus();
      element.setSelectionRange(offset, offset);
      element.dispatchEvent(new Event("select", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.getByRole("button", { name: /add comment at source cursor/i }).click({ timeout: 8_000 });
    await page.waitForSelector('[data-comment-composer]', { timeout: 8_000 });
    await page.getByRole("textbox", { name: /^cursor comment$/i }).fill(EDIT_MODE_CURSOR_COMMENT_MARKER);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await page.getByRole("button", { name: /open 1 file comment/i }).click({ timeout: 8_000 });
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker) && document.body.innerText.includes("Insertion point"),
      EDIT_MODE_CURSOR_COMMENT_MARKER,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /close file comments/i }).click();

    const agentRequestAnchor = "Keep Markdown canonical.";
    await selectDocumentText(page, agentRequestAnchor, "keyup");
    await page.keyboard.press("Control+K");
    const askPaletteInput = page.getByRole("combobox", { name: /search commands and files/i });
    await askPaletteInput.fill("ask");
    await page.getByRole("option", { name: /ask agent at selection/i }).first().waitFor({ state: "visible", timeout: 8_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-inline-comment-composer]', { timeout: 8_000 });
    await page.getByRole("textbox", { name: /^inline comment$/i }).fill(AGENT_REQUEST_MARKER);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`open inline agent request for ${escapeRegExp(agentRequestAnchor)}`, "i") }).click({ timeout: 8_000 });
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker) && document.body.innerText.includes("Agent request"),
      AGENT_REQUEST_MARKER,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /close comment/i }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const detachedAnchorEditor = page.getByRole("textbox", { name: /markdown source/i });
    const markdownBeforeDrift = await detachedAnchorEditor.inputValue();
    if (!markdownBeforeDrift.includes(agentRequestAnchor)) {
      throw new Error(`Could not find anchored phrase before drift edit: ${agentRequestAnchor}`);
    }
    await detachedAnchorEditor.fill(markdownBeforeDrift.replace(agentRequestAnchor, "Keep Markdown source canonical."));
    await page.getByRole("button", { name: "Read", exact: true }).click();
    await page.waitForSelector("[data-detached-anchor-notice]", { timeout: 8_000 });
    await page.getByRole("button", { name: /^review$/i }).click();
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker) && document.body.innerText.includes("Agent request"),
      AGENT_REQUEST_MARKER,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /close comment/i }).click();
    await page.getByRole("button", { name: /open review, 1 agent request/i }).click({ timeout: 8_000 });
    await page.getByRole("button", { name: "Close review", exact: true }).waitFor({ state: "visible", timeout: 8_000 });
    await page.getByText(/^requests$/i).waitFor({ state: "visible", timeout: 8_000 });
    await page.getByText(AGENT_REQUEST_MARKER).waitFor({ state: "visible", timeout: 8_000 });
    await page.getByRole("button", { name: "Close review", exact: true }).click();

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
    await selectDocumentText(page, "draft");
    await page.waitForSelector('[data-inline-comment-composer]', { timeout: 8_000 });
    await page.getByRole("textbox", { name: /^inline comment$/i }).fill(PROPERTY_COMMENT_MARKER);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForSelector("[data-detached-anchor-notice]", { timeout: 8_000 });
    await page.getByRole("button", { name: /^review$/i }).click();
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker) && document.body.innerText.includes("Comment thread"),
      PROPERTY_COMMENT_MARKER,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /close comment/i }).click();
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
  await page.addInitScript(() => {
    localStorage.setItem("fold:theme", "dark");
  });
}

async function installClipboardProbe(page: Page) {
  await page.evaluate(`(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text) {
          window.__foldClipboardText = String(text);
          return Promise.resolve();
        },
        readText() {
          return Promise.resolve(window.__foldClipboardText || "");
        },
      },
    });
  })()`);
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

async function selectDocumentText(page: Page, phrase: string, eventType: "mouseup" | "keyup" = "mouseup") {
  await page.evaluate(({ targetPhrase, eventType }) => {
    const surface = document.querySelector('[data-document-surface="true"]');
    if (!surface) throw new Error("Document surface not found.");

    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || "";
      const index = text.indexOf(targetPhrase);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + targetPhrase.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        if (eventType === "keyup") {
          surface.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        } else {
          surface.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        }
        return;
      }
      node = walker.nextNode();
    }
    throw new Error(`Could not select document phrase: ${targetPhrase}`);
  }, { targetPhrase: phrase, eventType });
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
