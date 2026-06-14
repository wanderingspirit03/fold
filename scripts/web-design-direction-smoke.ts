import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const REFERENCE_DIR = "/tmp/agent-md-obsidian-reference";
const REQUIRED_REFERENCE_FILES = [
  "obsidian-home-viewport-1600x1100@2x.png",
  "obsidian-home-mobile-390x844@2x.png",
  "obsidian-help-file-explorer-1600x1100@2x.png",
  "obsidian-help-views-editing-mode-1600x1100@2x.png",
  "obsidian-help-properties-1600x1100@2x.png",
  "obsidian-help-links-1600x1100@2x.png",
] as const;

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
    await assertLauncherWorkspace(desktop);
    const launcherScreenshotPath = join(screenshotDir, "desktop-local-workspace.png");
    await desktop.screenshot({ path: launcherScreenshotPath, fullPage: true, caret: "initial" });
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
    await assertProjectDrawerTitle(mobile, "mobile project drawer");
    const mobileDrawerScreenshotPath = join(screenshotDir, "mobile-project-drawer.png");
    await mobile.screenshot({ path: mobileDrawerScreenshotPath, caret: "initial" });
    await assertNoHorizontalOverflow(mobile, "mobile project drawer");
    const referenceFiles = await assertReferencePack();
    const audit = {
      schema: "fold.design-audit.v1",
      generatedAt: new Date().toISOString(),
      designDocument: "DESIGN.md",
      referenceDir: REFERENCE_DIR,
      referenceFiles,
      currentScreenshots: {
        launcher: launcherScreenshotPath,
        desktopProjectWorkspace: desktopScreenshotPath,
        mobileDocumentFirst: mobileScreenshotPath,
        mobileProjectDrawer: mobileDrawerScreenshotPath,
      },
      checks: [
        "Launcher workspace exposes local project views without vault wording.",
        "Desktop workspace has a visible file sidebar, compact header, and document-width reading surface.",
        "Desktop review drawer is closed by default.",
        "Mobile starts document-first with the file tree in a drawer.",
        "Mobile project drawer search is focused and opens nested Markdown files.",
        "Mermaid renders as a diagram on desktop and mobile.",
        "Project title is derived from encrypted project content.",
        "No horizontal page overflow in captured desktop or mobile surfaces.",
      ],
    };
    const auditJsonPath = join(screenshotDir, "design-audit.json");
    const auditMarkdownPath = join(screenshotDir, "design-audit.md");
    await writeFile(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
    await writeFile(auditMarkdownPath, renderAuditMarkdown(audit), "utf8");

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
          launcherScreenshotPath,
          desktopScreenshotPath,
          mobileScreenshotPath,
          mobileDrawerScreenshotPath,
          auditJsonPath,
          auditMarkdownPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

async function assertReferencePack() {
  const files = await Promise.all(REQUIRED_REFERENCE_FILES.map(async (file) => {
    const path = join(REFERENCE_DIR, file);
    try {
      const info = await stat(path);
      return { file, path, bytes: info.size, present: info.isFile() && info.size > 0 };
    } catch {
      return { file, path, bytes: 0, present: false };
    }
  }));

  const missing = files.filter((file) => !file.present);
  if (missing.length > 0) {
    throw new Error(
      `Missing Obsidian reference screenshots in ${REFERENCE_DIR}:\n`
      + missing.map((file) => `- ${file.file}`).join("\n")
      + `\nRefresh them with: npm run web:reference:capture`,
    );
  }

  return files;
}

function renderAuditMarkdown(audit: {
  schema: string;
  generatedAt: string;
  designDocument: string;
  referenceDir: string;
  referenceFiles: Array<{ file: string; path: string; bytes: number; present: boolean }>;
  currentScreenshots: Record<string, string>;
  checks: string[];
}) {
  return [
    "# Fold Design Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    "",
    `Design document: \`${audit.designDocument}\``,
    `Reference pack: \`${audit.referenceDir}\``,
    "",
    "## Current Screenshots",
    "",
    ...Object.entries(audit.currentScreenshots).map(([label, path]) => `- ${label}: \`${path}\``),
    "",
    "## Obsidian References",
    "",
    ...audit.referenceFiles.map((file) => `- ${file.present ? "present" : "missing"} \`${file.file}\` (${file.bytes} bytes)`),
    "",
    "## Verified Gates",
    "",
    ...audit.checks.map((check) => `- ${check}`),
    "",
  ].join("\n");
}

async function assertLauncherWorkspace(page: Page) {
  await page.getByRole("navigation", { name: /project workspace views/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Recent\s+4$/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Shared\s+2$/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Agents\s+1$/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Review\s+1$/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Archive\s+1$/i }).waitFor({ state: "visible", timeout: 8_000 });

  await page.getByRole("button", { name: /^Shared\s+2$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Shared planning room"), null, { timeout: 8_000 });
  await page.getByRole("button", { name: /^Agents\s+1$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Agent-created handoff"), null, { timeout: 8_000 });
  await page.getByRole("button", { name: /^Review\s+1$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Needs review sample"), null, { timeout: 8_000 });
  await page.waitForFunction(() => document.body.innerText.includes("1 request"), null, { timeout: 8_000 });
  await page.getByRole("button", { name: /^Archive\s+1$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Archived launch notes"), null, { timeout: 8_000 });
  await page.getByRole("button", { name: /restore archived launch notes/i }).click();
  await page.getByRole("button", { name: /^Recent\s+5$/i }).click();
  await page.getByRole("button", { name: /archive archived launch notes/i }).click();
  await page.getByRole("button", { name: /^Archive\s+1$/i }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: /^Recent\s+4$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Created here"), null, { timeout: 8_000 });

  const metrics = await page.evaluate(() => ({
    bodyText: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (/vault/i.test(metrics.bodyText)) throw new Error("Launcher still exposes vault wording.");
  if (!/local index/i.test(metrics.bodyText)) throw new Error("Launcher does not expose the local project index.");
  if (metrics.scrollWidth > metrics.clientWidth) throw new Error("Launcher workspace created horizontal overflow.");
}

async function assertDesktopDesign(page: Page) {
  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector("aside");
    const surface = document.querySelector('[data-document-surface="true"]');
    const header = document.querySelector("header");
    const reviewDrawer = Array.from(document.querySelectorAll("div")).find((node) => node.textContent?.trim() === "Review");
    const projectTitle = document.querySelector("[data-project-title]")?.textContent?.trim() || "";
    const sidebarRect = sidebar?.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      bodyText: document.body.innerText,
      projectTitle,
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
  if (!metrics.projectTitle || metrics.projectTitle === "Fold project") {
    throw new Error(`Desktop project title is not derived from encrypted project content: ${metrics.projectTitle || "(empty)"}.`);
  }
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

async function assertProjectDrawerTitle(page: Page, label: string) {
  const title = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-project-title]"));
    const visible = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== "hidden";
    });
    return visible?.textContent?.trim() || "";
  });

  if (!title || title === "Fold project") {
    throw new Error(`${label} project title is not derived from encrypted project content: ${title || "(empty)"}.`);
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
  await page.addInitScript((rooms) => {
    localStorage.setItem("fold:theme", "dark");
    localStorage.setItem("fold:recent-rooms", JSON.stringify(rooms));
  }, seededRecentRooms());
}

function seededRecentRooms() {
  return [
    {
      roomId: "created-local-room",
      key: "created-local-key",
      name: "Local project draft",
      source: "created",
      visitedAt: "2026-06-12T11:00:00.000Z",
    },
    {
      roomId: "shared-planning-room",
      key: "shared-planning-key",
      name: "Shared planning room",
      source: "joined",
      visitedAt: "2026-06-12T10:00:00.000Z",
    },
    {
      roomId: "agent-handoff-room",
      key: "agent-handoff-key",
      name: "Agent-created handoff",
      source: "agent",
      visitedAt: "2026-06-12T09:00:00.000Z",
    },
    {
      roomId: "needs-review-room",
      key: "needs-review-key",
      name: "Needs review sample",
      source: "joined",
      pendingCount: 1,
      unresolvedCount: 1,
      requestCount: 1,
      visitedAt: "2026-06-12T08:00:00.000Z",
    },
    {
      roomId: "archived-launch-room",
      key: "archived-launch-key",
      name: "Archived launch notes",
      source: "created",
      archivedAt: "2026-06-11T09:00:00.000Z",
      visitedAt: "2026-06-11T09:00:00.000Z",
    },
  ];
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
