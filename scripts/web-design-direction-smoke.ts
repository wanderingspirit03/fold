import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-design-direction-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await preparePage(desktop, "desktop", logs);
    await desktop.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
    await desktop.getByRole("button", { name: /create project/i }).click();
    await desktop.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await desktop.getByRole("button", { name: /^agent-handoff-review\.md/i }).click();
    await desktop.waitForFunction(() => document.body.innerText.includes("Agent Handoff Review"), null, { timeout: 8_000 });
    await assertMermaidRendered(desktop, "desktop");
    await assertDesktopDesign(desktop);
    const desktopScreenshotPath = join(screenshotDir, "desktop-project-workspace.png");
    await desktop.screenshot({ path: desktopScreenshotPath, fullPage: true, caret: "initial" });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await preparePage(mobile, "mobile", logs);
    await mobile.goto(desktop.url(), { waitUntil: "networkidle", timeout: 20_000 });
    await mobile.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await mobile.getByRole("button", { name: /open project files/i }).click();
    await mobile.getByRole("textbox", { name: /search project files/i }).fill("reports/agent-handoff-review.md");
    await mobile.getByRole("button", { name: /^agent-handoff-review\.md/i }).click();
    await mobile.waitForFunction(() => document.body.innerText.includes("Agent Handoff Review"), null, { timeout: 8_000 });
    await assertMermaidRendered(mobile, "mobile");
    await assertMobileDesign(mobile);
    const mobileScreenshotPath = join(screenshotDir, "mobile-document-first.png");
    await mobile.screenshot({ path: mobileScreenshotPath, fullPage: true, caret: "initial" });

    await mobile.getByRole("button", { name: /open project files/i }).click();
    const mobileFileSearch = mobile.getByRole("textbox", { name: /search project files/i });
    await mobileFileSearch.waitFor({ state: "visible", timeout: 8_000 });
    await mobile.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search project files", null, { timeout: 8_000 });
    await mobileFileSearch.fill("docs/runbooks/review-flow.md");
    await mobile.getByRole("button", { name: /^review-flow\.md/i }).waitFor({ state: "visible", timeout: 8_000 });
    const mobileDrawerScreenshotPath = join(screenshotDir, "mobile-project-drawer.png");
    await mobile.screenshot({ path: mobileDrawerScreenshotPath, caret: "initial" });
    await assertNoHorizontalOverflow(mobile, "mobile project drawer");

    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during design direction smoke:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomUrl: desktop.url(),
          desktopScreenshotPath,
          mobileScreenshotPath,
          mobileDrawerScreenshotPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

async function assertDesktopDesign(page: Page) {
  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector("aside");
    const surface = document.querySelector('[data-document-surface="true"]');
    const header = document.querySelector("header");
    const reviewDrawer = Array.from(document.querySelectorAll("div")).find((node) => node.textContent?.trim() === "Review");
    const sidebarRect = sidebar?.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      bodyText: document.body.innerText,
      sidebarWidth: sidebarRect?.width || 0,
      sidebarDisplay: sidebar ? window.getComputedStyle(sidebar).display : "",
      surfaceWidth: surfaceRect?.width || 0,
      surfaceLeft: surfaceRect?.left || 0,
      headerHeight: headerRect?.height || 0,
      hasReviewDrawerHeader: Boolean(reviewDrawer),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  if (!metrics.bodyText.includes("Fold project")) throw new Error("Desktop workspace does not expose project identity.");
  if (/vault/i.test(metrics.bodyText)) throw new Error("Desktop workspace still exposes vault wording.");
  if (metrics.sidebarDisplay === "none" || metrics.sidebarWidth < 240) throw new Error(`Desktop file sidebar is not visible enough: ${metrics.sidebarWidth}px.`);
  if (metrics.surfaceWidth < 620 || metrics.surfaceWidth > 960) throw new Error(`Desktop document surface width is outside the expected reading range: ${metrics.surfaceWidth}px.`);
  if (metrics.surfaceLeft <= metrics.sidebarWidth) throw new Error("Desktop document surface is not positioned after the file sidebar.");
  if (metrics.headerHeight > 72) throw new Error(`Desktop header is too tall for compact editor chrome: ${metrics.headerHeight}px.`);
  if (metrics.hasReviewDrawerHeader) throw new Error("Review drawer appears open by default on desktop.");
  if (metrics.scrollWidth > metrics.clientWidth) throw new Error("Desktop design smoke created horizontal overflow.");
}

async function assertMobileDesign(page: Page) {
  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector("aside");
    const surface = document.querySelector('[data-document-surface="true"]');
    const surfaceRect = surface?.getBoundingClientRect();
    return {
      bodyText: document.body.innerText,
      sidebarDisplay: sidebar ? window.getComputedStyle(sidebar).display : "",
      surfaceWidth: surfaceRect?.width || 0,
      surfaceLeft: surfaceRect?.left || 0,
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  if (/vault/i.test(metrics.bodyText)) throw new Error("Mobile workspace still exposes vault wording.");
  if (metrics.sidebarDisplay !== "none") throw new Error("Mobile should start document-first without the desktop sidebar visible.");
  if (metrics.surfaceWidth <= 0 || metrics.surfaceWidth > metrics.viewportWidth - 16) {
    throw new Error(`Mobile document surface width is not constrained to the viewport: ${metrics.surfaceWidth}px.`);
  }
  if (metrics.surfaceLeft < 0) throw new Error("Mobile document surface starts outside the viewport.");
  if (metrics.scrollWidth > metrics.viewportWidth) throw new Error("Mobile design smoke created horizontal overflow.");
}

async function assertMermaidRendered(page: Page, label: string) {
  await page.waitForSelector('[data-mermaid-diagram="rendered"] svg', { timeout: 12_000 });
  const metrics = await page.evaluate(() => {
    const diagram = document.querySelector('[data-mermaid-diagram="rendered"]');
    const svg = diagram?.querySelector("svg");
    const rect = svg?.getBoundingClientRect();
    return {
      label: diagram?.querySelector("figcaption")?.textContent || "",
      width: rect?.width || 0,
      height: rect?.height || 0,
    };
  });

  if (metrics.label.includes("Source")) throw new Error(`${label} Mermaid block is still shown as source instead of a diagram.`);
  if (metrics.width < 180 || metrics.height < 32) {
    throw new Error(`${label} Mermaid diagram rendered too small: ${metrics.width}x${metrics.height}.`);
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${label} created horizontal overflow.`);
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
      `Start it before running the design direction smoke:\n` +
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
