import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium, type Browser, type Page } from "playwright";

const DEFAULT_URLS = ["http://localhost:3001", "http://localhost:3000"];
const DEFAULT_SYNC_URL = "http://127.0.0.1:8787";
const ORIGINAL_TEXT = "Original proposal smoke sentence.";
const PROPOSED_TEXT = "Accepted proposal smoke sentence.";
const EDITED_ACCEPTED_TEXT = "Human-edited accepted proposal smoke sentence.";
const REJECTED_TEXT = "Rejected proposal smoke sentence.";
const PROPOSAL_TITLE = `Proposal review smoke ${Date.now()}`;
const REJECT_PROPOSAL_TITLE = `Rejected proposal smoke ${Date.now()}`;
const PROPOSAL_REPLY_MARKER = `Proposal discussion reply ${Date.now()}.`;
const PROPOSAL_ASK_AGAIN_MARKER = `Please make the proposal more specific ${Date.now()}.`;
const PROJECT_PROPOSAL_TITLE = `Project target smoke ${Date.now()}`;
const PROJECT_ABOUT_PROPOSED = `About Codex proposed project change ${Date.now()}.`;
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const tsxCli = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const foldCli = join(repoRoot, "src/cli/bin.ts");

async function main() {
  const baseUrl = await resolveBaseUrl();
  await assertSyncServerReady(DEFAULT_SYNC_URL);

  const screenshotDir = process.env.FOLD_SMOKE_SCREENSHOT_DIR || join(tmpdir(), "fold-web-proposal-review-smoke");
  await mkdir(screenshotDir, { recursive: true });

  const cwd = await mkdtemp(join(tmpdir(), "fold-proposal-review-"));
  const browser = await chromium.launch({ headless: true });
  const logs: string[] = [];

  try {
    const planPath = join(cwd, "plan.md");
    await writeFile(planPath, `# Proposal Review Smoke\n\n${ORIGINAL_TEXT}\n`, "utf8");

    const published = await runCliJson<PublishJson>(cwd, [
      "publish",
      "plan.md",
      "--app-url",
      baseUrl,
      "--sync-url",
      DEFAULT_SYNC_URL,
      "--alias",
      "proposal-review-smoke",
      "--json",
    ]);

    await writeFile(planPath, `# Proposal Review Smoke\n\n${PROPOSED_TEXT}\n`, "utf8");
    const proposed = await runCliJson<ProposeJson>(cwd, [
      "propose",
      "plan.md",
      "--room",
      published.room.token,
      "--path",
      "plan.md",
      "--title",
      PROPOSAL_TITLE,
      "--comment",
      "Verify compact preview and guarded accept.",
      "--json",
    ]);

    const desktop = await browser.newPage({ viewport: { width: 1240, height: 860 } });
    await preparePage(desktop, "desktop", logs);
    await desktop.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await desktop.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await desktop.waitForFunction(
      (original) => document.body.innerText.includes(original),
      ORIGINAL_TEXT,
      { timeout: 10_000 },
    );

    await desktop.getByRole("button", { name: /open pending suggestion/i }).click({ timeout: 8_000 });
    await assertProposalDialog(desktop, PROPOSAL_TITLE, PROPOSED_TEXT);
    const proposalDialog = desktop.getByRole("dialog", { name: PROPOSAL_TITLE });
    await proposalDialog.getByLabel("Reply to comment").fill(PROPOSAL_REPLY_MARKER);
    await proposalDialog.getByRole("button", { name: "Reply", exact: true }).click();
    await desktop.waitForFunction(
      (marker) => document.body.innerText.includes(marker) && document.body.innerText.includes("1 reply"),
      PROPOSAL_REPLY_MARKER,
      { timeout: 8_000 },
    );
    await desktop.getByRole("button", { name: "Ask again", exact: true }).click();
    await proposalDialog.getByLabel("Ask agent for another pass").fill(PROPOSAL_ASK_AGAIN_MARKER);
    await proposalDialog.getByRole("button", { name: "Ask again", exact: true }).click();
    await desktop.waitForFunction(
      ([replyMarker, askAgainMarker]) => (
        document.body.innerText.includes(replyMarker) &&
        document.body.innerText.includes(askAgainMarker) &&
        document.body.innerText.includes("2 replies")
      ),
      [PROPOSAL_REPLY_MARKER, PROPOSAL_ASK_AGAIN_MARKER],
      { timeout: 8_000 },
    );
    await desktop.getByRole("button", { name: "Accept", exact: true }).click();
    await desktop.getByRole("button", { name: /cancel accepting/i }).click();
    await desktop.getByRole("button", { name: "Accept", exact: true }).waitFor({ state: "visible", timeout: 8_000 });
    await desktop.getByRole("button", { name: "Edit", exact: true }).click();
    const editedProposalMarkdown = `# Proposal Review Smoke\n\n${EDITED_ACCEPTED_TEXT}\n`;
    await proposalDialog.getByLabel("Edited proposal Markdown").fill(editedProposalMarkdown);
    await desktop.waitForFunction(
      (editedText) => document.body.innerText.includes(editedText) && document.body.innerText.includes("Accept edited"),
      EDITED_ACCEPTED_TEXT,
      { timeout: 8_000 },
    );
    const desktopDialogScreenshotPath = join(screenshotDir, "desktop-proposal-preview.png");
    await desktop.screenshot({ path: desktopDialogScreenshotPath, fullPage: false, caret: "initial" });
    await desktop.keyboard.press("Escape");
    await desktop.getByRole("dialog", { name: PROPOSAL_TITLE }).waitFor({ state: "hidden", timeout: 8_000 });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await preparePage(mobile, "mobile", logs);
    await mobile.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
    await mobile.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
    await mobile.getByRole("button", { name: /open review, 1 pending suggestion/i }).click({ timeout: 8_000 });
    await mobile.getByRole("button", { name: new RegExp(`preview ${escapeRegExp(PROPOSAL_TITLE)}`, "i") }).click({ timeout: 8_000 });
    await assertProposalDialog(mobile, PROPOSAL_TITLE, PROPOSED_TEXT);
    const mobileDialogScreenshotPath = join(screenshotDir, "mobile-proposal-preview.png");
    await mobile.screenshot({ path: mobileDialogScreenshotPath, fullPage: false, caret: "initial" });
    await assertNoHorizontalOverflow(mobile, "mobile proposal preview");

    await desktop.getByRole("button", { name: /open pending suggestion/i }).click({ timeout: 8_000 });
    await desktop.getByRole("button", { name: "Edit", exact: true }).click();
    await desktop.getByRole("dialog", { name: PROPOSAL_TITLE }).getByLabel("Edited proposal Markdown").fill(`# Proposal Review Smoke\n\n${EDITED_ACCEPTED_TEXT}\n`);
    await desktop.getByRole("button", { name: "Accept edited", exact: true }).click();
    await desktop.getByRole("button", { name: /confirm accepting/i }).click();
    await desktop.waitForFunction(
      ([editedText, proposedText, originalText]) => (
        document.body.innerText.includes(editedText) &&
        !document.body.innerText.includes(proposedText) &&
        !document.body.innerText.includes(originalText)
      ),
      [EDITED_ACCEPTED_TEXT, PROPOSED_TEXT, ORIGINAL_TEXT],
      { timeout: 10_000 },
    );

    const exported = await runCliJson<ExportJson>(cwd, [
      "export",
      "--room",
      published.room.token,
      "--json",
    ]);
    if (!exported.document.markdown.includes(EDITED_ACCEPTED_TEXT)) {
      throw new Error("CLI export did not replay the edited web-accepted proposal markdown.");
    }
    if (exported.document.markdown.includes(PROPOSED_TEXT)) {
      throw new Error("CLI export still contains the unedited proposal smoke text after edited accept.");
    }
    if (exported.document.markdown.includes(ORIGINAL_TEXT)) {
      throw new Error("CLI export still contains the original proposal smoke text after accept.");
    }

    const replayed = await runCliJson<ProposalsJson>(cwd, [
      "proposals",
      "--room",
      published.room.token,
      "--json",
    ]);
    const replayedProposal = replayed.proposals.find((proposal) => proposal.id === proposed.proposal.id);
    if (replayedProposal?.status !== "accepted") {
      throw new Error(`Expected proposal ${proposed.proposal.id} to replay as accepted.`);
    }
    const shownProposal = await runCliJson<ShowProposalJson>(cwd, [
      "show-proposal",
      proposed.proposal.id,
      "--room",
      published.room.token,
      "--json",
    ]);
    const shownReplies = shownProposal.proposal.replies || [];
    if (!shownReplies.some((reply) => reply.text === PROPOSAL_ASK_AGAIN_MARKER)) {
      throw new Error("CLI show-proposal did not replay the encrypted ask-again discussion reply.");
    }

    await writeFile(planPath, `# Proposal Review Smoke\n\n${REJECTED_TEXT}\n`, "utf8");
    const rejectedCandidate = await runCliJson<ProposeJson>(cwd, [
      "propose",
      "plan.md",
      "--room",
      published.room.token,
      "--path",
      "plan.md",
      "--title",
      REJECT_PROPOSAL_TITLE,
      "--comment",
      "Verify rejected suggestions replay without changing export.",
      "--json",
    ]);

    await desktop.getByRole("button", { name: /open pending suggestion/i }).click({ timeout: 8_000 });
    await assertProposalDialog(desktop, REJECT_PROPOSAL_TITLE, REJECTED_TEXT);
    await desktop.getByRole("button", { name: "Reject", exact: true }).click();
    await desktop.getByRole("dialog", { name: REJECT_PROPOSAL_TITLE }).waitFor({ state: "hidden", timeout: 8_000 });

    const replayedAfterReject = await runCliJson<ProposalsJson>(cwd, [
      "proposals",
      "--room",
      published.room.token,
      "--json",
    ]);
    const rejectedProposal = replayedAfterReject.proposals.find((proposal) => proposal.id === rejectedCandidate.proposal.id);
    if (rejectedProposal?.status !== "rejected") {
      throw new Error(`Expected proposal ${rejectedCandidate.proposal.id} to replay as rejected.`);
    }
    const acceptedProposalAfterReject = replayedAfterReject.proposals.find((proposal) => proposal.id === proposed.proposal.id);
    if (acceptedProposalAfterReject?.status !== "accepted") {
      throw new Error(`Expected proposal ${proposed.proposal.id} to remain accepted after rejecting another proposal.`);
    }
    const exportedAfterReject = await runCliJson<ExportJson>(cwd, [
      "export",
      "--room",
      published.room.token,
      "--json",
    ]);
    if (!exportedAfterReject.document.markdown.includes(EDITED_ACCEPTED_TEXT)) {
      throw new Error("CLI export lost the edited accepted proposal markdown after rejecting another proposal.");
    }
    if (exportedAfterReject.document.markdown.includes(PROPOSED_TEXT)) {
      throw new Error("CLI export restored the unedited accepted proposal markdown after rejecting another proposal.");
    }
    if (exportedAfterReject.document.markdown.includes(REJECTED_TEXT)) {
      throw new Error("CLI export included rejected proposal markdown.");
    }

    const projectTargetScreenshotPath = await assertProjectProposalTargetsChangedFile(browser, cwd, baseUrl, logs, screenshotDir);

    await assertNoHorizontalOverflow(desktop, "desktop proposal review smoke");
    const errors = logs.filter((entry) => entry.includes("pageerror:") || entry.includes(" console:error:"));
    if (errors.length > 0) {
      throw new Error(`Browser errors during proposal review smoke:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          syncUrl: DEFAULT_SYNC_URL,
          roomId: published.room.roomId,
          serverRoomUrl: published.room.serverRoomUrl,
          proposalId: proposed.proposal.id,
          rejectedProposalId: rejectedCandidate.proposal.id,
          proposalReplyMarker: PROPOSAL_REPLY_MARKER,
          proposalAskAgainMarker: PROPOSAL_ASK_AGAIN_MARKER,
          desktopDialogScreenshotPath,
          mobileDialogScreenshotPath,
          projectTargetScreenshotPath,
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

async function assertProposalDialog(page: Page, title: string, proposedText: string) {
  await page.getByRole("dialog", { name: title }).waitFor({ state: "visible", timeout: 8_000 });
  await page.waitForFunction(
    ([title, proposedText]) => (
      document.body.innerText.includes(title) &&
      document.body.innerText.includes("Preview:") &&
      document.body.innerText.includes("Diff") &&
      document.body.innerText.includes(proposedText)
    ),
    [title, proposedText],
    { timeout: 8_000 },
  );
  await page.getByRole("button", { name: "Accept", exact: true }).waitFor({ state: "visible", timeout: 8_000 });
  await page.getByRole("button", { name: "Reject", exact: true }).waitFor({ state: "visible", timeout: 8_000 });
}

async function assertProjectProposalTargetsChangedFile(
  browser: Browser,
  cwd: string,
  baseUrl: string,
  logs: string[],
  screenshotDir: string,
) {
  const projectDir = join(cwd, "project-target");
  await mkdir(join(projectDir, "docs"), { recursive: true });
  const readmePath = join(projectDir, "README.md");
  const targetPath = join(projectDir, "docs", "Target.md");
  await writeFile(readmePath, "# Project Target\n\nREADME stays unchanged.\n", "utf8");
  await writeFile(targetPath, "# Target\n\nOriginal target body.\n", "utf8");
  const published = await runCliJson<PublishJson>(cwd, [
    "publish",
    projectDir,
    "--app-url",
    baseUrl,
    "--sync-url",
    DEFAULT_SYNC_URL,
    "--alias",
    "project-target-smoke",
    "--json",
  ]);

  await writeFile(targetPath, `# Target\n\n${PROJECT_ABOUT_PROPOSED}\n`, "utf8");
  await runCliJson<ProposeJson>(cwd, [
    "propose",
    projectDir,
    "--room",
    published.room.token,
    "--title",
    PROJECT_PROPOSAL_TITLE,
    "--comment",
    "Verify project suggestions are attached to the changed file.",
    "--json",
  ]);

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await preparePage(page, "project-target", logs);
  await page.goto(published.room.url, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForSelector('[data-document-surface="true"]', { timeout: 10_000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("Project Target") && !document.body.innerText.includes("Project target smoke"),
    null,
    { timeout: 10_000 },
  );
  const readmePendingButton = page.getByRole("button", { name: /open pending suggestion/i });
  if (await readmePendingButton.count()) {
    throw new Error("Project proposal appeared on the README document surface instead of the changed file.");
  }

  await page.getByRole("button", { name: /Target\.md/ }).last().click();
  await page.waitForFunction((text) => document.body.innerText.includes(text), "Original target body.", { timeout: 8_000 });
  await page.getByRole("button", { name: /open pending suggestion/i }).click({ timeout: 8_000 });
  const dialog = page.getByRole("dialog", { name: PROJECT_PROPOSAL_TITLE });
  await dialog.waitFor({ state: "visible", timeout: 8_000 });
  await page.waitForFunction(
    ([title, proposed]) => (
      document.body.innerText.includes(title) &&
      document.body.innerText.includes("Project suggestion for docs/Target.md") &&
      document.body.innerText.includes("Preview: docs/Target.md") &&
      document.body.innerText.includes(proposed) &&
      !document.body.innerText.includes("Preview: README.md")
    ),
    [PROJECT_PROPOSAL_TITLE, PROJECT_ABOUT_PROPOSED],
    { timeout: 8_000 },
  );
  const screenshotPath = join(screenshotDir, "project-proposal-target-preview.png");
  await page.screenshot({ path: screenshotPath, fullPage: false, caret: "initial" });
  await assertNoHorizontalOverflow(page, "project proposal target preview");
  await page.close();
  return screenshotPath;
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
    roomId: string;
    serverRoomUrl: string;
    url: string;
    token: string;
  };
}

interface ProposeJson {
  proposal: {
    id: string;
  };
}

interface ExportJson {
  document: {
    markdown: string;
  };
}

interface ProposalsJson {
  proposals: Array<{
    id: string;
    status: string;
  }>;
}

interface ShowProposalJson {
  proposal: {
    replies?: Array<{
      text: string;
    }>;
  };
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
      `Start it before running the proposal review smoke:\n` +
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
