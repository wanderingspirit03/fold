import { chromium } from "playwright";

const DEFAULT_BASE_URL = "https://fold-production-b207.up.railway.app";

async function main() {
  const baseUrl = readBaseUrl();
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
        serverRoomUrl: `${url.origin}${url.pathname}`,
        hasKeyFragment: url.hash.startsWith("#key="),
        hasDocumentSurface: Boolean(document.querySelector('[data-document-surface="true"]')),
        hasReadMode: document.body.innerText.includes("Read"),
        hasEditMode: document.body.innerText.includes("Edit"),
      };
    });

    if (!result.hasKeyFragment) throw new Error("Created room URL did not include a #key fragment.");
    if (!result.hasDocumentSurface) throw new Error("Created room did not render the document surface.");
    if (!result.hasReadMode || !result.hasEditMode) throw new Error("Created room did not hydrate room controls.");

    const cspErrors = events.filter((event) => /Content Security Policy|violates the following Content Security Policy/i.test(event));
    if (cspErrors.length > 0) {
      throw new Error(`Hosted create-room smoke saw CSP errors:\n${cspErrors.join("\n")}`);
    }

    console.log(JSON.stringify({ ok: true, baseUrl, ...result }, null, 2));
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

void main();
