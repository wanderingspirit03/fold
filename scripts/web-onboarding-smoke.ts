import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://127.0.0.1:3001", "http://localhost:3001", "http://127.0.0.1:3000", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const ONBOARDING_STORAGE_KEY = "fold:onboarding:web-room:v1";

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);
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
    await assertNoHorizontalOverflow(page, "desktop checklist");
    await page.screenshot({ path: join(screenshotDir, "desktop-checklist.png"), fullPage: true, caret: "initial" });

    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForSelector("[data-onboarding-tour]", { state: "detached", timeout: 5_000 });
    await assertStoredState(page, "completedAt");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
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
    await openFreshProject(skipPage, baseUrl);
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
    await assertStoredState(skipPage, "skippedAt");

    const checklistPage = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await preparePage(checklistPage, "checklist-query", logs);
    await openFreshProject(checklistPage, withOnboardingSurface(baseUrl, "checklist"));
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

async function openFreshProject(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 20_000 });
  await page.evaluate((key) => localStorage.removeItem(key), ONBOARDING_STORAGE_KEY);
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

async function assertStoredState(page: Page, key: "completedAt" | "skippedAt") {
  const stored = await page.evaluate((storageKey) => {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  }, ONBOARDING_STORAGE_KEY);
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
