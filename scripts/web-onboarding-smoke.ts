import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://127.0.0.1:3001", "http://localhost:3001", "http://127.0.0.1:3000", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const ONBOARDING_AUTO_STORAGE_KEY = "fold:onboarding:auto-opened:v1";
const ONBOARDING_LEGACY_STORAGE_KEY = "fold:onboarding:web-room:v1";
const ONBOARDING_PROGRESS_STORAGE_PREFIX = "fold:onboarding:room:v1:";

async function main() {
  const baseUrl = await resolveBaseUrl();
  const syncUrl = process.env.FOLD_SYNC_URL || DEFAULT_SYNC_URL;
  await assertSyncServerReady(syncUrl);
  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-onboarding-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await preparePage(page, "desktop", logs);
    await openFreshProject(page, baseUrl);
    await page.waitForSelector("[data-onboarding-tour]", { timeout: 10_000 });
    await page.getByRole("heading", { name: "Start with the room essentials" }).waitFor({ state: "visible" });
    await assertDialogFocus(page, "desktop welcome");
    await assertNoHorizontalOverflow(page, "desktop welcome");
    await page.screenshot({ path: join(screenshotDir, "desktop-welcome.png"), fullPage: true, caret: "initial" });

    await page.getByRole("button", { name: "Show checklist" }).click();
    await page.getByRole("heading", { name: "Project setup" }).waitFor({ state: "visible" });
    const checklist = page.locator("[data-onboarding-tour]");
    await page.getByText("0 of 5 complete").waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(page, "desktop checklist");
    await page.screenshot({ path: join(screenshotDir, "desktop-checklist.png"), fullPage: true, caret: "initial" });

    await checklist.getByRole("button", { name: "Name project", exact: true }).click();
    await page.getByRole("textbox", { name: "Project name" }).fill("Launch plan");
    await page.keyboard.press("Enter");
    await page.getByText("1 of 5 complete").waitFor({ state: "visible" });

    await checklist.getByRole("button", { name: "Open files" }).click();
    await page.getByRole("button", { name: "Create Markdown file" }).click();
    await page.getByRole("textbox", { name: "New Markdown file path" }).fill("docs/onboarding-check.md");
    await page.getByRole("button", { name: "Create file" }).click();
    await page.getByText("2 of 5 complete").waitFor({ state: "visible" });

    await checklist.getByRole("button", { name: "Copy invite", exact: true }).click();
    await checklist.getByRole("button", { name: "Copy again" }).first().waitFor({ state: "visible" });
    await page.getByText("3 of 5 complete").waitFor({ state: "visible" });

    await checklist.getByRole("button", { name: "Copy handoff", exact: true }).click();
    await page.getByText("4 of 5 complete").waitFor({ state: "visible" });

    await checklist.getByRole("button", { name: "Open review" }).click();
    await page.getByRole("button", { name: "Close review", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Close review", exact: true }).click();

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForSelector("[data-onboarding-tour]", { state: "detached", timeout: 5_000 });
    await assertAutoStoredState(page);
    await assertProgressState(page, "completedAt");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await assertTourDoesNotAutoOpen(page);

    await openFreshProject(page, baseUrl, { clearOnboarding: false });
    await assertTourDoesNotAutoOpen(page);

    await page.getByRole("button", { name: /open command palette/i }).click();
    await page.getByRole("combobox", { name: /search commands and files/i }).fill("setup");
    await page.getByRole("option", { name: /show project setup/i }).click();
    await page.getByRole("heading", { name: "Project setup" }).waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(page, "desktop command palette setup");
    await page.getByRole("button", { name: "Hide" }).click();
    await page.waitForSelector("[data-onboarding-tour]", { state: "detached", timeout: 5_000 });

    const skipPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await preparePage(skipPage, "mobile", logs);
    await openFreshProject(skipPage, withOnboardingSurface(baseUrl, "welcome"), { clearOnboarding: false });
    await skipPage.waitForSelector("[data-onboarding-tour]", { timeout: 10_000 });
    await skipPage.getByRole("heading", { name: "Start with the room essentials" }).waitFor({ state: "visible" });
    await assertDialogFocus(skipPage, "mobile welcome");
    await assertNoHorizontalOverflow(skipPage, "mobile welcome");
    await skipPage.screenshot({ path: join(screenshotDir, "mobile-welcome.png"), fullPage: true, caret: "initial" });
    await skipPage.getByRole("button", { name: "Show checklist" }).click();
    await skipPage.getByRole("heading", { name: "Project setup" }).waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(skipPage, "mobile checklist");
    await skipPage.screenshot({ path: join(screenshotDir, "mobile-checklist.png"), fullPage: true, caret: "initial" });
    await skipPage.getByRole("button", { name: "Hide" }).click();
    await skipPage.waitForSelector("[data-onboarding-tour]", { state: "detached", timeout: 5_000 });
    await assertProgressState(skipPage, "dismissedAt");

    const checklistPage = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await preparePage(checklistPage, "checklist-query", logs);
    await openFreshProject(checklistPage, withOnboardingSurface(baseUrl, "checklist"), { clearOnboarding: false });
    await checklistPage.getByRole("heading", { name: "Project setup" }).waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(checklistPage, "checklist query");
    await checklistPage.close();

    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during onboarding smoke:\n${errors.join("\n")}`);
    }

    console.log(JSON.stringify({ ok: true, baseUrl, screenshotDir }, null, 2));
  } finally {
    await browser.close();
  }
}

async function openFreshProject(page: Page, baseUrl: string, options: { clearOnboarding?: boolean } = {}) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
  if (options.clearOnboarding !== false) {
    await page.evaluate(({ autoKey, legacyKey, progressPrefix }) => {
      localStorage.removeItem(autoKey);
      localStorage.removeItem(legacyKey);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(progressPrefix)) localStorage.removeItem(key);
      }
    }, {
      autoKey: ONBOARDING_AUTO_STORAGE_KEY,
      legacyKey: ONBOARDING_LEGACY_STORAGE_KEY,
      progressPrefix: ONBOARDING_PROGRESS_STORAGE_PREFIX,
    });
  }
  await page.getByRole("button", { name: /create project/i }).click();
  await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
}

function withOnboardingSurface(baseUrl: string, surface: "welcome" | "checklist") {
  const url = new URL(baseUrl);
  url.searchParams.set("onboarding", surface);
  return url.toString();
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

async function assertDialogFocus(page: Page, label: string) {
  const focusedDialog = await page.evaluate(() => document.activeElement?.getAttribute("aria-labelledby") === "room-welcome-onboarding-title");
  if (!focusedDialog) throw new Error(`${label}: welcome dialog did not receive focus.`);
}

async function assertAutoStoredState(page: Page) {
  const stored = await page.evaluate((storageKey) => {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  }, ONBOARDING_AUTO_STORAGE_KEY);
  if (!stored?.openedAt) throw new Error("Onboarding did not persist auto-open state.");
}

async function assertProgressState(page: Page, key: "completedAt" | "dismissedAt") {
  const stored = await page.evaluate((storageKey) => {
    const roomId = window.location.pathname.split("/").filter(Boolean).pop();
    const value = roomId ? localStorage.getItem(`${storageKey}${roomId}`) : null;
    return value ? JSON.parse(value) : null;
  }, ONBOARDING_PROGRESS_STORAGE_PREFIX);
  if (!stored?.[key]) throw new Error(`Onboarding did not persist ${key}.`);
}

async function assertTourDoesNotAutoOpen(page: Page) {
  await page.waitForTimeout(1_000);
  const count = await page.locator("[data-onboarding-tour]").count();
  if (count > 0) throw new Error("Onboarding reopened after completion.");
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${label}: page has horizontal overflow.`);
}

async function resolveBaseUrl() {
  const candidates = [process.env.FOLD_WEB_URL, ...DEFAULT_URLS].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (await canReach(candidate)) return candidate;
  }
  throw new Error("No Fold web app responded. Start one with `npm run web:dev`.");
}

async function assertSyncServerReady(syncUrl: string) {
  if (await canReach(syncUrl)) return;
  throw new Error(`No Fold sync server responded at ${syncUrl}. Start one with \`npm run server -- --port 8787 --data ./data\`.`);
}

async function canReach(url: string) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
