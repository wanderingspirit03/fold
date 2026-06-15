import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const ANCHOR_TEXT = "agent-visible anchor";
const AGENT_COMMENT = `Agent inline comment ${Date.now()}.`;
const AGENT_REPLY = `Agent CLI reply ${Date.now()}.`;
const HUMAN_REPLY = `Human reply ${Date.now()}.`;
const HUMAN_REPLY_TO_REPLY = `Human reply-to-reply ${Date.now()}.`;
const MOBILE_REPLY_TO_REPLY = `Mobile reply-to-reply ${Date.now()}.`;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const tsxCli = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const foldCli = join(repoRoot, "src/cli/bin.ts");

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-agent-comment-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const cwd = await mkdtemp(join(tmpdir(), "fold-agent-comment-"));
  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    await writeFile(
      join(cwd, "plan.md"),
      `# Agent Comment Smoke\n\nThis paragraph contains an ${ANCHOR_TEXT} for a CLI-authored review note.\n`,
      "utf8",
    );

    const published = await runCliJson<PublishJson>(cwd, [
      "publish",
      "plan.md",
      "--app-url",
      baseUrl,
      "--sync-url",
      DEFAULT_SYNC_URL,
      "--alias",
      "agent-comment-smoke",
      "--json",
    ]);

    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    await preparePage(page, "desktop", logs);
    await page.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });

    const added = await runCliJson<CommentJson>(cwd, [
      "comment",
      "--room",
      published.room.token,
      "--path",
      "plan.md",
      "--quote",
      ANCHOR_TEXT,
      "--text",
      AGENT_COMMENT,
      "--json",
    ]);
    await runCliJson<CommentJson>(cwd, [
      "reply",
      added.comment.id,
      "--room",
      published.room.token,
      "--text",
      AGENT_REPLY,
      "--json",
    ]);

    const marker = page.getByRole("button", { name: /open inline comment for agent-visible anchor/i });
    await marker.click({ timeout: 8_000 });
    await page.waitForFunction(
      ([agentComment, agentReply]) => document.body.innerText.includes(agentComment) && document.body.innerText.includes(agentReply),
      [AGENT_COMMENT, AGENT_REPLY],
      { timeout: 8_000 },
    );

    await page.getByLabel("Reply to comment").fill(HUMAN_REPLY);
    await page.getByRole("button", { name: "Reply", exact: true }).click();

    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      HUMAN_REPLY,
      { timeout: 8_000 },
    );
    await page.getByRole("button", { name: /^Reply to / }).nth(1).click();
    await page.waitForSelector("[data-comment-reply-target]", { timeout: 8_000 });
    await page.waitForFunction(
      (replyText) => document.querySelector("[data-comment-reply-target]")?.textContent?.includes(replyText),
      AGENT_REPLY,
      { timeout: 8_000 },
    );
    await page.getByLabel("Reply to comment").fill(HUMAN_REPLY_TO_REPLY);
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      HUMAN_REPLY_TO_REPLY,
      { timeout: 8_000 },
    );

    const replayed = await runCliJson<CommentsJson>(cwd, [
      "comments",
      "--room",
      published.room.token,
      "--json",
    ]);
    const replayedComment = replayed.comments.find((comment) => comment.id === added.comment.id);
    if (!replayedComment?.replies?.some((reply) => reply.text === AGENT_REPLY)) {
      throw new Error("CLI replay did not include the CLI-authored thread reply.");
    }
    if (!replayedComment.replies.some((reply) => reply.text === HUMAN_REPLY)) {
      throw new Error("CLI replay did not include the browser-authored thread reply.");
    }
    const replyToReply = replayedComment.replies.find((reply) => reply.text === HUMAN_REPLY_TO_REPLY);
    if (!replyToReply?.parentId || !replyToReply.parentAuthorName || !replyToReply.parentText?.includes(AGENT_REPLY)) {
      throw new Error("CLI replay did not preserve the encrypted browser reply-target metadata.");
    }
    await page.waitForFunction(
      (replyText) => Array.from(document.querySelectorAll("[data-comment-parent-preview]")).some((preview) => preview.textContent?.includes(replyText)),
      AGENT_REPLY,
      { timeout: 8_000 },
    );

    const screenshotPath = join(screenshotDir, "agent-inline-comment-thread-desktop.png");
    await page.screenshot({ path: screenshotPath, fullPage: false, caret: "initial" });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) {
      throw new Error("Agent comment smoke created horizontal overflow on desktop.");
    }

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await preparePage(mobilePage, "mobile", logs);
    await mobilePage.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await mobilePage.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await mobilePage.getByRole("button", { name: /open inline comment for agent-visible anchor/i }).click({ timeout: 8_000 });
    await mobilePage.waitForFunction(
      ([agentComment, humanReply]) => document.body.innerText.includes(agentComment) && document.body.innerText.includes(humanReply),
      [AGENT_COMMENT, HUMAN_REPLY],
      { timeout: 8_000 },
    );
    await mobilePage.getByRole("button", { name: /^Reply to / }).nth(1).click();
    await mobilePage.waitForSelector("[data-comment-reply-target]", { timeout: 8_000 });
    await mobilePage.waitForFunction(
      (replyText) => document.querySelector("[data-comment-reply-target]")?.textContent?.includes(replyText),
      AGENT_REPLY,
      { timeout: 8_000 },
    );
    await mobilePage.getByLabel("Reply to comment").fill(MOBILE_REPLY_TO_REPLY);
    await mobilePage.getByRole("button", { name: "Reply", exact: true }).click();
    await mobilePage.waitForFunction(
      (text) => document.body.innerText.includes(text),
      MOBILE_REPLY_TO_REPLY,
      { timeout: 8_000 },
    );
    const replayedAfterMobile = await runCliJson<CommentsJson>(cwd, [
      "comments",
      "--room",
      published.room.token,
      "--json",
    ]);
    const mobileReplayedComment = replayedAfterMobile.comments.find((comment) => comment.id === added.comment.id);
    const mobileReplyToReply = mobileReplayedComment?.replies?.find((reply) => reply.text === MOBILE_REPLY_TO_REPLY);
    if (!mobileReplyToReply?.parentId || !mobileReplyToReply.parentAuthorName || !mobileReplyToReply.parentText?.includes(AGENT_REPLY)) {
      throw new Error("CLI replay did not preserve the encrypted mobile reply-target metadata.");
    }
    const mobileScreenshotPath = join(screenshotDir, "agent-inline-comment-thread-mobile.png");
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false, caret: "initial" });
    const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (mobileOverflow) {
      throw new Error("Agent comment smoke created horizontal overflow on mobile.");
    }

    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during agent comment smoke:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomId: published.room.roomId,
          serverRoomUrl: published.room.serverRoomUrl,
          commentId: added.comment.id,
          agentComment: AGENT_COMMENT,
          agentReply: AGENT_REPLY,
          humanReply: HUMAN_REPLY,
          humanReplyToReply: HUMAN_REPLY_TO_REPLY,
          mobileReplyToReply: MOBILE_REPLY_TO_REPLY,
          screenshotPath,
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

async function runCliJson<T>(cwd: string, args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, [tsxCli, foldCli, ...args], {
    cwd,
    maxBuffer: 1024 * 1024 * 8,
  });
  return JSON.parse(stdout) as T;
}

interface PublishJson {
  room: {
    roomId: string;
    serverRoomUrl: string;
    url: string;
    token: string;
  };
}

interface CommentJson {
  comment: {
    id: string;
  };
}

interface CommentsJson {
  comments: Array<{
    id: string;
    replies?: Array<{ text: string; parentId?: string; parentAuthorName?: string; parentText?: string }>;
  }>;
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
    localStorage.setItem("fold:onboarding:web-room:v1", JSON.stringify({ version: 1, completedAt: "smoke" }));
  });
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
      `Start it before running the agent comment smoke:\n` +
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
