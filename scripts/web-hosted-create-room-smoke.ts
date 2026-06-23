import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { createRoomToken } from "../src/rooms/room-reference.js";

const DEFAULT_BASE_URL = "https://fold-production-b207.up.railway.app";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);

async function main() {
  const baseUrl = readBaseUrl();
  const syncUrl = readSyncUrl(baseUrl);
  const cliCwd = await mkdtemp(join(tmpdir(), "fold-hosted-create-cli-"));
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

    const result = await page.evaluate(() => {
      const url = new URL(window.location.href);
      return {
        roomId: url.pathname.split("/").filter(Boolean).at(-1) || "",
        roomSecret: new URLSearchParams(url.hash.slice(1)).get("key") || "",
        serverRoomUrl: `${url.origin}${url.pathname}`,
        hasKeyFragment: url.hash.startsWith("#key="),
        hasDocumentSurface: Boolean(document.querySelector('[data-document-surface="true"]')),
        hasReadMode: document.body.innerText.includes("Read"),
        hasEditMode: document.body.innerText.includes("Edit"),
        hasReadmeSeed: document.body.innerText.includes("README.md"),
        hasDocumentSeed: document.body.innerText.includes("document.md"),
      };
    });

    if (!result.hasKeyFragment) throw new Error("Created room URL did not include a #key fragment.");
    if (!result.hasDocumentSurface) throw new Error("Created room did not render the document surface.");
    if (!result.hasReadMode || !result.hasEditMode) throw new Error("Created room did not hydrate room controls.");
    if (result.hasReadmeSeed) throw new Error("Freshly created room should not seed README.md.");
    if (!result.hasDocumentSeed) throw new Error("Freshly created room did not show the blank document.md seed file.");

    const roomToken = createRoomToken({
      roomId: result.roomId,
      roomSecret: result.roomSecret,
      appUrl: baseUrl,
      syncUrl,
      serverUrl: syncUrl,
    });
    const exported = await exportCreatedRoomWithRetry(roomToken, cliCwd);
    const exportedPaths = exported.project?.files?.map((file) => file.path) ?? [];
    if (exported.project?.primaryPath !== "document.md") {
      throw new Error(`CLI export primary path should be document.md, got ${JSON.stringify(exported.project?.primaryPath)}.`);
    }
    if (exportedPaths.length !== 1 || exportedPaths[0] !== "document.md") {
      throw new Error(`CLI export should contain only document.md, got ${JSON.stringify(exportedPaths)}.`);
    }
    if (exported.document?.markdown !== "") {
      throw new Error("CLI export of a fresh project should be empty Markdown.");
    }

    const cspErrors = events.filter((event) => /Content Security Policy|violates the following Content Security Policy/i.test(event));
    if (cspErrors.length > 0) {
      throw new Error(`Hosted create-room smoke saw CSP errors:\n${cspErrors.join("\n")}`);
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      syncUrl,
      ...redactResult(result),
      cliExport: {
        primaryPath: exported.project.primaryPath,
        files: exportedPaths,
        markdownBytes: exported.document.bytes,
        recordCount: exported.server.recordCount,
      },
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

async function exportCreatedRoomWithRetry(roomToken: string, cwd: string) {
  let lastError = "unknown";
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const exported = await exportCreatedRoom(roomToken, cwd);
      const exportedPaths = exported.project?.files?.map((file) => file.path) ?? [];
      if (
        exported.project?.primaryPath === "document.md" &&
        exportedPaths.length === 1 &&
        exportedPaths[0] === "document.md" &&
        exported.document?.markdown === ""
      ) {
        return exported;
      }
      lastError = `attempt ${attempt} exported ${JSON.stringify({
        primaryPath: exported.project?.primaryPath,
        paths: exportedPaths,
        markdownBytes: exported.document?.bytes,
        recordCount: exported.server?.recordCount,
      })}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`CLI export did not observe the persisted blank document.md project: ${lastError}`);
}

async function exportCreatedRoom(roomToken: string, cwd: string): Promise<CreatedRoomExport> {
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
    return JSON.parse(stdout) as CreatedRoomExport;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? ` code=${String(error.code)}` : "";
    throw new Error(`CLI export failed while checking persisted project state.${code}`);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CreatedRoomExport {
  document: { markdown: string; bytes: number };
  project: { primaryPath: string; files: Array<{ path: string }> };
  server: { recordCount: number };
}

function redactResult(result: {
  roomId: string;
  roomSecret: string;
  serverRoomUrl: string;
  hasKeyFragment: boolean;
  hasDocumentSurface: boolean;
  hasReadMode: boolean;
  hasEditMode: boolean;
  hasReadmeSeed: boolean;
  hasDocumentSeed: boolean;
}) {
  return {
    roomId: result.roomId,
    serverRoomUrl: result.serverRoomUrl,
    hasKeyFragment: result.hasKeyFragment,
    hasDocumentSurface: result.hasDocumentSurface,
    hasReadMode: result.hasReadMode,
    hasEditMode: result.hasEditMode,
    hasReadmeSeed: result.hasReadmeSeed,
    hasDocumentSeed: result.hasDocumentSeed,
  };
}

void main();
