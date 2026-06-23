import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { createRoomToken } from "../src/rooms/room-reference.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);

async function main() {
  const baseUrl = readBaseUrl();
  const syncUrl = readSyncUrl(baseUrl);
  const cliCwd = await mkdtemp(join(tmpdir(), "fold-file-delete-cli-"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const events: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") events.push(`console:error:${message.text()}`);
  });
  page.on("pageerror", (error) => {
    events.push(`pageerror:${error.message}`);
  });
  page.on("requestfailed", (request) => {
    events.push(`requestfailed:${request.method()} ${request.url()} ${request.failure()?.errorText || "unknown"}`);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("button", { name: /create project/i }).click({ timeout: 10_000 });
    await page.waitForURL(/\/room\/[^#]+#key=/, { timeout: 10_000 });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 15_000 });

    const access = await page.evaluate(() => {
      const url = new URL(window.location.href);
      return {
        roomId: url.pathname.split("/").filter(Boolean).at(-1) || "",
        roomSecret: new URLSearchParams(url.hash.slice(1)).get("key") || "",
        serverRoomUrl: `${url.origin}${url.pathname}`,
      };
    });

    await page.getByRole("button", { name: "Create Markdown file" }).click({ timeout: 10_000 });
    await page.getByLabel("New Markdown file path").fill("docs/delete-me.md");
    await page.getByRole("button", { name: "Create file" }).click();
    await page.locator('[aria-label="Delete docs/delete-me.md"]').waitFor({ timeout: 10_000 });
    await assertSingleVisibleProjectDeleteControl(page, "docs/delete-me.md");

    await page.getByRole("button", { name: /delete-me\.md active in file/i }).first().hover();
    await page.locator('[aria-label="Delete docs/delete-me.md"]').click({ timeout: 10_000 });
    await page.locator('[aria-label="Confirm delete docs/delete-me.md"]').click({ timeout: 10_000 });
    await page.waitForFunction(() => !document.body.innerText.includes("delete-me.md"), undefined, { timeout: 10_000 });
    await page.waitForFunction(() => document.body.innerText.includes("document.md"), undefined, { timeout: 10_000 });

    const roomToken = createRoomToken({
      roomId: access.roomId,
      roomSecret: access.roomSecret,
      appUrl: baseUrl,
      syncUrl,
      serverUrl: syncUrl,
    });
    const exported = await exportUntilDeleted(roomToken, cliCwd);
    const exportedPaths = exported.project.files.map((file) => file.path);

    if (exportedPaths.includes("docs/delete-me.md")) {
      throw new Error(`Deleted file still exported: ${JSON.stringify(exportedPaths)}`);
    }
    if (exported.project.primaryPath !== "document.md" || exportedPaths.length !== 1 || exportedPaths[0] !== "document.md") {
      throw new Error(`Expected only document.md after delete, got ${JSON.stringify({ primaryPath: exported.project.primaryPath, exportedPaths })}`);
    }

    await runMobileDeletePass(browser, baseUrl, syncUrl);

    const cspErrors = events.filter((event) => /Content Security Policy|violates the following Content Security Policy/i.test(event));
    if (cspErrors.length > 0) {
      throw new Error(`File delete smoke saw CSP errors:\n${cspErrors.join("\n")}`);
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      syncUrl,
      roomId: access.roomId,
      serverRoomUrl: access.serverRoomUrl,
      exportedPaths,
      recordCount: exported.server.recordCount,
    }, null, 2));
  } catch (error) {
    const currentUrl = page.url().replace(/#key=.*/, "#key=<redacted>");
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000)).catch(() => "");
    console.error(JSON.stringify({
      ok: false,
      baseUrl,
      currentUrl,
      error: error instanceof Error ? error.message : String(error),
      bodyText,
      events,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await rm(cliCwd, { recursive: true, force: true });
  }
}

async function assertSingleVisibleProjectDeleteControl(page: import("playwright").Page, path: string) {
  const deleteControls = await page.locator(`[aria-label="Delete ${path}"]`).filter({ visible: true }).count();
  if (deleteControls !== 1) {
    throw new Error(`Expected exactly one visible delete control for ${path}, got ${deleteControls}.`);
  }
}

async function runMobileDeletePass(browser: import("playwright").Browser, baseUrl: string, syncUrl: string) {
  const mobileCwd = await mkdtemp(join(tmpdir(), "fold-file-delete-mobile-cli-"));
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("button", { name: /create project/i }).click({ timeout: 10_000 });
    await page.waitForURL(/\/room\/[^#]+#key=/, { timeout: 10_000 });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 15_000 });

    const access = await page.evaluate(() => {
      const url = new URL(window.location.href);
      return {
        roomId: url.pathname.split("/").filter(Boolean).at(-1) || "",
        roomSecret: new URLSearchParams(url.hash.slice(1)).get("key") || "",
      };
    });

    await page.getByRole("button", { name: "Open project files" }).click({ timeout: 10_000 });
    await page.getByRole("button", { name: "Create Markdown file" }).click({ timeout: 10_000 });
    await page.getByLabel("New Markdown file path").fill("docs/mobile-delete.md");
    await page.getByRole("button", { name: "Create file" }).click();
    await page.getByRole("button", { name: "Open project files" }).click({ timeout: 10_000 });
    await assertSingleVisibleProjectDeleteControl(page, "docs/mobile-delete.md");
    await page.locator('[aria-label="Delete docs/mobile-delete.md"]').filter({ visible: true }).click({ timeout: 10_000 });
    await page.locator('[aria-label="Confirm delete docs/mobile-delete.md"]').filter({ visible: true }).click({ timeout: 10_000 });
    await page.waitForFunction(() => !document.body.innerText.includes("mobile-delete.md"), undefined, { timeout: 10_000 });

    const roomToken = createRoomToken({
      roomId: access.roomId,
      roomSecret: access.roomSecret,
      appUrl: baseUrl,
      syncUrl,
      serverUrl: syncUrl,
    });
    const exported = await exportUntilDeleted(roomToken, mobileCwd, "docs/mobile-delete.md");
    const exportedPaths = exported.project.files.map((file) => file.path);
    if (exportedPaths.includes("docs/mobile-delete.md")) {
      throw new Error(`Mobile deleted file still exported: ${JSON.stringify(exportedPaths)}`);
    }
  } finally {
    await page.close();
    await rm(mobileCwd, { recursive: true, force: true });
  }
}

function readBaseUrl() {
  const argIndex = process.argv.indexOf("--base-url");
  const value = argIndex >= 0 ? process.argv[argIndex + 1] : process.env.FOLD_WEB_BASE_URL;
  if (!value) return DEFAULT_BASE_URL;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid --base-url: ${value}`);
  }
}

function readSyncUrl(baseUrl: string) {
  const value = process.env.FOLD_SYNC_URL;
  if (!value) return baseUrl;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid FOLD_SYNC_URL: ${value}`);
  }
}

async function exportUntilDeleted(roomToken: string, cwd: string, deletedPath = "docs/delete-me.md") {
  let lastError = "unknown";
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const exported = await exportRoom(roomToken, cwd);
      const exportedPaths = exported.project.files.map((file) => file.path);
      if (!exportedPaths.includes(deletedPath) && exportedPaths.includes("document.md")) {
        return exported;
      }
      lastError = `attempt ${attempt} exported ${JSON.stringify(exportedPaths)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`CLI export did not observe deleted file state: ${lastError}`);
}

async function exportRoom(roomToken: string, cwd: string): Promise<DeleteSmokeExport> {
  try {
    const { stdout } = await execFileAsync(
      join(REPO_ROOT, "node_modules", ".bin", "tsx"),
      [join(REPO_ROOT, "src", "cli", "bin.ts"), "export", "--room", roomToken, "--json"],
      {
        cwd,
        env: process.env,
        maxBuffer: 1024 * 1024 * 8,
      },
    );
    return JSON.parse(stdout) as DeleteSmokeExport;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? ` code=${String(error.code)}` : "";
    throw new Error(`CLI export failed while checking deleted file state.${code}`);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DeleteSmokeExport {
  project: {
    primaryPath: string;
    files: Array<{ path: string }>;
  };
  server: {
    recordCount: number;
  };
}

void main();
