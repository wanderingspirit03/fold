import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const DEFAULT_REFERENCE_DIR = "/tmp/agent-md-obsidian-reference";
const REFERENCE_DIR = process.env.FOLD_OBSIDIAN_REFERENCE_DIR || DEFAULT_REFERENCE_DIR;

const DESKTOP_VIEWPORT = { width: 1600, height: 1100 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

interface ReferenceTarget {
  name: string;
  url: string;
  expectedText: string;
  viewport: { width: number; height: number };
  fullPage?: boolean;
  mobile?: boolean;
}

const TARGETS: ReferenceTarget[] = [
  {
    name: "obsidian-home-viewport-1600x1100@2x.png",
    url: "https://obsidian.md/",
    expectedText: "Sharpen your thinking",
    viewport: DESKTOP_VIEWPORT,
  },
  {
    name: "obsidian-home-full-1600x1100@2x.png",
    url: "https://obsidian.md/",
    expectedText: "Sharpen your thinking",
    viewport: DESKTOP_VIEWPORT,
    fullPage: true,
  },
  {
    name: "obsidian-home-mobile-390x844@2x.png",
    url: "https://obsidian.md/",
    expectedText: "Sharpen your thinking",
    viewport: MOBILE_VIEWPORT,
    mobile: true,
  },
  {
    name: "obsidian-help-file-explorer-1600x1100@2x.png",
    url: "https://help.obsidian.md/Plugins/File+explorer",
    expectedText: "File explorer",
    viewport: DESKTOP_VIEWPORT,
  },
  {
    name: "obsidian-help-views-editing-mode-1600x1100@2x.png",
    url: "https://help.obsidian.md/edit-and-read",
    expectedText: "Views and editing mode",
    viewport: DESKTOP_VIEWPORT,
  },
  {
    name: "obsidian-help-properties-1600x1100@2x.png",
    url: "https://help.obsidian.md/properties",
    expectedText: "Properties",
    viewport: DESKTOP_VIEWPORT,
  },
  {
    name: "obsidian-help-links-1600x1100@2x.png",
    url: "https://help.obsidian.md/links",
    expectedText: "Internal links",
    viewport: DESKTOP_VIEWPORT,
  },
];

async function main() {
  await mkdir(REFERENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const outputs: string[] = [];

  try {
    for (const target of TARGETS) {
      const outputPath = join(REFERENCE_DIR, target.name);
      const page = await newReferencePage(browser, target);
      try {
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await settleReferencePage(page);
        await assertReferencePage(page, target);
        await page.screenshot({
          path: outputPath,
          fullPage: Boolean(target.fullPage),
          caret: "initial",
        });
        outputs.push(outputPath);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        referenceDir: REFERENCE_DIR,
        outputs,
      },
      null,
      2,
    ),
  );
}

async function newReferencePage(browser: Browser, target: ReferenceTarget) {
  return browser.newPage({
    viewport: target.viewport,
    deviceScaleFactor: 2,
    isMobile: Boolean(target.mobile),
  });
}

async function settleReferencePage(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(1_200);
}

async function assertReferencePage(page: Page, target: ReferenceTarget) {
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  if (bodyText.includes("This page does not exist") || /\bNot found\b/i.test(bodyText)) {
    throw new Error(`Reference page resolved to a not-found view: ${target.url}`);
  }
  if (!bodyText.includes(target.expectedText)) {
    throw new Error(`Reference page ${target.url} did not include expected text: ${target.expectedText}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
