import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const ANCHORS = [
  "bright annotation anchor",
  "adjacent comment target",
  "final marked phrase",
];
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const tsxCli = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const foldCli = join(repoRoot, "src/cli/bin.ts");

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-annotation-theme-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const cwd = await mkdtemp(join(tmpdir(), "fold-annotation-theme-"));
  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    await writeFile(
      join(cwd, "annotations.md"),
      [
        "# Annotation Theme Smoke",
        "",
        `This paragraph has a ${ANCHORS[0]} so bright mode can prove inline comment contrast.`,
        "",
        `A nearby sentence carries an ${ANCHORS[1]} without turning the page into badge soup.`,
        "",
        `The ${ANCHORS[2]} sits near the end of the document to catch scroll and popover placement.`,
      ].join("\n"),
      "utf8",
    );

    const published = await runCliJson<PublishJson>(cwd, [
      "publish",
      "annotations.md",
      "--app-url",
      baseUrl,
      "--sync-url",
      DEFAULT_SYNC_URL,
      "--alias",
      "annotation-theme-smoke",
      "--json",
    ]);

    for (const anchor of ANCHORS) {
      await runCliJson<CommentJson>(cwd, [
        "comment",
        "--room",
        published.room.token,
        "--path",
        "annotations.md",
        "--quote",
        anchor,
        "--text",
        `Review ${anchor}.`,
        "--json",
      ]);
    }

    const page = await browser.newPage({ viewport: { width: 1240, height: 860 } });
    await preparePage(page, "desktop-light", "light", logs);
    await page.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await assertAnnotationMarkers(page);
    await page.getByRole("button", { name: /open inline comment for bright annotation anchor/i }).click({ timeout: 8_000 });
    await page.waitForFunction(() => document.body.innerText.includes("Comment thread"), null, { timeout: 8_000 });
    const desktopScreenshotPath = join(screenshotDir, "bright-inline-comments-desktop.png");
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true, caret: "initial" });
    await assertNoHorizontalOverflow(page, "desktop bright annotation smoke");

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await preparePage(mobilePage, "mobile-light", "light", logs);
    await mobilePage.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await assertAnnotationMarkers(mobilePage);
    await mobilePage.getByRole("button", { name: /open inline comment for adjacent comment target/i }).click({ timeout: 8_000 });
    await mobilePage.waitForFunction(() => document.body.innerText.includes("Comment thread"), null, { timeout: 8_000 });
    const mobileScreenshotPath = join(screenshotDir, "bright-inline-comments-mobile.png");
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: true, caret: "initial" });
    await assertNoHorizontalOverflow(mobilePage, "mobile bright annotation smoke");

    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during annotation theme smoke:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomUrl: published.room.url,
          desktopScreenshotPath,
          mobileScreenshotPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await rm(cwd, { recursive: true, force: true });
  }
}

async function assertAnnotationMarkers(page: Page) {
  await page.waitForSelector('[data-inline-comment-marker]', { timeout: 10_000 });
  const markerState = await page.locator('[data-inline-comment-marker]').evaluateAll((markers) => markers.map((marker) => {
    const style = window.getComputedStyle(marker);
    return {
      text: marker.textContent || "",
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      color: style.color,
      rect: marker.getBoundingClientRect().toJSON(),
    };
  }));

  if (markerState.length < ANCHORS.length) {
    throw new Error(`Expected at least ${ANCHORS.length} inline comment markers, saw ${markerState.length}.`);
  }
  for (const anchor of ANCHORS) {
    const marker = markerState.find((candidate) => candidate.text.includes(anchor));
    if (!marker) throw new Error(`Missing inline marker for ${anchor}.`);
    if (marker.backgroundColor === "rgba(0, 0, 0, 0)" && marker.borderBottomColor === "rgba(0, 0, 0, 0)") {
      throw new Error(`Inline marker for ${anchor} has no visible fill or underline.`);
    }
    if (marker.color === marker.backgroundColor) {
      throw new Error(`Inline marker for ${anchor} text color matches its background.`);
    }
    if (marker.rect.width <= 0 || marker.rect.height <= 0) {
      throw new Error(`Inline marker for ${anchor} is not visible.`);
    }
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${label} created horizontal overflow.`);
}

async function runCliJson<T>(cwd: string, args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, [tsxCli, foldCli, ...args], {
    cwd,
    maxBuffer: 1024 * 1024 * 8,
  });
  return JSON.parse(stdout) as T;
}

interface PublishJson {
  room: {
    url: string;
    token: string;
  };
}

interface CommentJson {
  comment: {
    id: string;
  };
}

async function preparePage(page: Page, label: string, theme: "dark" | "light", logs: string[]) {
  page.on("console", (message) => {
    if (message.type() === "info" && message.text().includes("React DevTools")) return;
    if (message.type() === "log" && message.text().includes("[HMR]")) return;
    logs.push(`${label} console:${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => logs.push(`${label} pageerror: ${error.message}`));
  await page.addInitScript((nextTheme) => localStorage.setItem("fold:theme", nextTheme), theme);
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
      `Start it before running the annotation theme smoke:\n` +
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
