"use client";

import { Bot, Check, FileText, ListChecks, Pencil, Quote, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import MarkdownRenderer from "../MarkdownRenderer";
import { extractMarkdownProperties } from "../../lib/markdown-properties";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CommentConversation, type CommentReplyTarget } from "./CommentConversation";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment, Proposal } from "./types";

interface ThreadReviewDialogProps {
  proposal: Proposal | null;
  onClose: () => void;
  onAccept: (proposal: Proposal) => void;
  onReject: (proposal: Proposal) => void;
  onReply?: (proposal: Proposal, text: string, target?: CommentReplyTarget) => void;
}

export function ThreadReviewDialog({
  proposal,
  onClose,
  onAccept,
  onReject,
  onReply,
}: ThreadReviewDialogProps) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [askAgainOpen, setAskAgainOpen] = useState(false);
  const [askAgainText, setAskAgainText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [editedProposalId, setEditedProposalId] = useState<string | null>(null);
  const targetPaths = proposal ? proposalTargetPaths(proposal) : [];
  const previewPath = proposal ? targetPaths[0] || proposal.filePath || proposal.proposedProject?.primaryPath || "" : "";
  const initialReviewMarkdown = proposal ? proposalPreviewMarkdown(proposal, previewPath) : "";
  const activeEditedMarkdown = proposal && editedProposalId === proposal.id ? editedMarkdown : initialReviewMarkdown;
  const hasEditedMarkdown = Boolean(proposal && activeEditedMarkdown !== initialReviewMarkdown);
  const reviewMarkdown = proposal ? activeEditedMarkdown : "";
  const reviewProposal = proposal && hasEditedMarkdown ? proposalWithEditedMarkdown(proposal, editedMarkdown, previewPath) : proposal;
  const parsedProposal = proposal ? extractMarkdownProperties(reviewMarkdown) : null;
  const diff = proposal
    ? hasEditedMarkdown
      ? fallbackDiff(proposal.createdFromMarkdown || initialReviewMarkdown, reviewMarkdown, previewPath)
      : proposal.diff || fallbackDiff(proposal.createdFromMarkdown, initialReviewMarkdown, previewPath)
    : "";

  useEffect(() => {
    setConfirmingAccept(false);
    setAskAgainOpen(false);
    setAskAgainText("");
    setEditOpen(false);
    setEditedMarkdown(proposal ? proposalPreviewMarkdown(proposal, proposalTargetPaths(proposal)[0] || proposal.filePath || proposal.proposedProject?.primaryPath || "") : "");
    setEditedProposalId(proposal?.id || null);
  }, [proposal?.id]);

  return (
    <Dialog open={Boolean(proposal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(860px,calc(100dvh-2rem))] max-w-3xl flex-col gap-0 overflow-hidden border-studio-line bg-studio-paper p-0 text-ink shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
        {proposal && (
          <>
            <DialogHeader className="shrink-0 border-b border-studio-line px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-8 pr-8">
                <div className="min-w-0">
                  <StatusText status={proposal.status} />
                  <DialogTitle className="mt-1 truncate text-[15px]">{proposal.title}</DialogTitle>
                  <DialogDescription className="mt-1 line-clamp-2 text-xs leading-5">
                    {proposal.comment || "Suggested Markdown replacement."}
                  </DialogDescription>
                </div>
                <PersonaChip persona={proposal.persona} compact className="mt-0.5 hidden shrink-0 sm:inline-flex" />
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
              <div className="mb-3 rounded-md border border-studio-line bg-studio-sunken/70 px-3 py-2">
                <div className="flex min-w-0 items-start gap-2">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-5 text-ink">{proposalTargetSummary(proposal, targetPaths)}</p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                      {proposal.comment || "Review the proposed Markdown before accepting it."}
                    </p>
                  </div>
                </div>
                {proposal.selectedQuote || proposal.anchorType === "block" ? (
                  <div className="mt-2 flex min-h-8 items-center gap-2 rounded border border-studio-line/80 bg-studio-paper/55 px-2.5 py-1.5">
                    <Quote className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                    <p className="min-w-0 truncate text-xs leading-5 text-ink-muted">
                      {proposal.selectedQuote || "Section suggestion"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-md border border-document-edge bg-document shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                <div className="flex min-h-9 items-center justify-between gap-3 border-b border-document-edge bg-black/[0.018] px-4 py-2">
                  <p className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-document-subtle">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{previewPath ? `Preview: ${previewPath}` : "Suggestion preview"}</span>
                  </p>
                  {targetPaths.length > 1 ? (
                    <span className="shrink-0 font-mono text-[11px] text-document-subtle">
                      {targetPaths.length} files
                    </span>
                  ) : null}
                </div>
                <div className="max-h-[38dvh] overflow-y-auto px-4 py-5 sm:px-6">
                  {parsedProposal?.properties.length ? (
                    <div className="mb-6 rounded-md border border-document-edge bg-black/[0.025] px-3 py-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {parsedProposal.properties.map((property, index) => (
                          <span key={`${property.key}:${index}`} className="text-xs leading-5 text-document-subtle">
                            <span className="font-medium text-document-muted">{property.key}</span>
                            <span className="mx-1 text-document-subtle">:</span>
                            <span>{property.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <MarkdownRenderer content={parsedProposal?.content ?? reviewMarkdown} />
                </div>
              </div>

              {diff ? <DiffPreview diff={diff} /> : null}

              {editOpen && (
                <section className="mt-3 rounded-md border border-midnight/25 bg-studio-sunken/55 p-2.5" aria-label="Edit suggestion before accepting">
                  <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-subtle">
                      <Pencil className="h-3.5 w-3.5 text-midnight-strong" />
                      Edit before accepting
                    </p>
                    <button
                      type="button"
                      className="h-8 rounded px-2 text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                      onClick={() => {
                        setEditedProposalId(proposal.id);
                        setEditedMarkdown(initialReviewMarkdown);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <Textarea
                    aria-label="Edited proposal Markdown"
                    value={editedMarkdown}
                    onChange={(event) => {
                      setEditedProposalId(proposal.id);
                      setEditedMarkdown(event.target.value);
                    }}
                    rows={10}
                    className="min-h-48 resize-y border-studio-line bg-studio-paper font-mono text-xs leading-5 text-ink placeholder:text-ink-subtle focus-visible:ring-1"
                  />
                </section>
              )}

              <section className="mt-3 rounded-md border border-studio-line bg-studio-sunken/55 p-2.5" aria-label="Suggestion discussion">
                <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
                  <p className="text-[11px] font-medium text-ink-subtle">Discussion</p>
                  <span className="font-mono text-[11px] text-ink-subtle">
                    {proposal.replies?.length || 0} {proposal.replies?.length === 1 ? "reply" : "replies"}
                  </span>
                </div>
                <CommentConversation
                  comment={proposalDiscussionComment(proposal)}
                  onReply={onReply ? (_comment, text, target) => onReply(proposal, text, target) : undefined}
                  compact
                />
              </section>
            </div>

            {proposal.status === "pending" ? (
              <DialogFooter className="shrink-0 border-t border-studio-line bg-studio-paper px-4 py-3 sm:px-5">
                {confirmingAccept ? (
                  <div className="flex w-full items-center justify-end gap-2">
                    <p className="mr-auto text-xs text-midnight-strong">{hasEditedMarkdown ? "Apply edited Markdown?" : "Apply?"}</p>
                    <Button variant="outline" onClick={() => setConfirmingAccept(false)} aria-label={`Cancel accepting ${proposal.title}`}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (reviewProposal) onAccept(reviewProposal);
                        setConfirmingAccept(false);
                      }}
                      aria-label={`Confirm accepting ${proposal.title}`}
                    >
                      <Check className="h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                ) : askAgainOpen ? (
                  <form
                    className="flex w-full flex-col gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const text = askAgainText.trim();
                      if (!text || !onReply) return;
                      onReply(proposal, text);
                      setAskAgainText("");
                      setAskAgainOpen(false);
                    }}
                  >
                    <Textarea
                      aria-label="Ask agent for another pass"
                      placeholder="Ask for a clearer revision"
                      rows={2}
                      value={askAgainText}
                      onChange={(event) => setAskAgainText(event.target.value)}
                      className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle focus-visible:ring-1"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAskAgainOpen(false);
                          setAskAgainText("");
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!askAgainText.trim() || !onReply}>
                        <Send className="h-4 w-4" />
                        Ask again
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditOpen((open) => !open);
                        setAskAgainOpen(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      {editOpen ? "Hide edit" : "Edit"}
                    </Button>
                    {onReply && (
                      <Button variant="outline" onClick={() => setAskAgainOpen(true)}>
                        <Bot className="h-4 w-4" />
                        Ask again
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => onReject(proposal)}>
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button onClick={() => setConfirmingAccept(true)}>
                      <Check className="h-4 w-4" />
                      {hasEditedMarkdown ? "Accept edited" : "Accept"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            ) : (
              <div className="shrink-0 border-t border-studio-line bg-studio-paper px-4 py-3 sm:px-5">
                <p className="text-xs text-ink-subtle">
                  {proposal.status === "accepted" ? "This suggestion has been accepted." : "This suggestion has been rejected."}
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function proposalWithEditedMarkdown(proposal: Proposal, markdown: string, previewPath: string): Proposal {
  const editedPath = previewPath || proposal.filePath || proposal.proposedProject?.primaryPath;
  const proposedProject = proposal.proposedProject
    ? {
        ...proposal.proposedProject,
        updatedAt: new Date().toISOString(),
        files: proposal.proposedProject.files.map((file) => (
          file.path === editedPath ? { ...file, markdown } : file
        )),
      }
    : undefined;
  return {
    ...proposal,
    proposedMarkdown: markdown,
    proposedSha256: undefined,
    diff: undefined,
    proposedProject,
  };
}

function proposalDiscussionComment(proposal: Proposal): ChatComment {
  return {
    id: proposal.id,
    authorPersonaId: proposal.authorPersonaId,
    persona: proposal.persona,
    filePath: proposal.filePath,
    text: proposal.comment || proposal.title,
    replies: proposal.replies || [],
    createdAt: proposal.createdAt,
    type: "note",
    anchorType: proposal.anchorType,
    selectedQuote: proposal.selectedQuote,
    createdFromMarkdown: proposal.createdFromMarkdown,
    beforeContext: proposal.beforeContext,
    afterContext: proposal.afterContext,
  };
}

function proposalTargetPaths(proposal: Proposal) {
  if (proposal.targetPaths?.length) return proposal.targetPaths;
  if (proposal.filePath) return [proposal.filePath];
  if (proposal.proposedProject?.primaryPath) return [proposal.proposedProject.primaryPath];
  return [];
}

function proposalPreviewMarkdown(proposal: Proposal, previewPath: string) {
  if (proposal.proposedProject && previewPath) {
    return proposal.proposedProject.files.find((file) => file.path === previewPath)?.markdown ?? proposal.proposedMarkdown;
  }
  return proposal.proposedMarkdown;
}

function proposalTargetSummary(proposal: Proposal, targetPaths: string[]) {
  if (proposal.kind === "project-replacement") {
    if (targetPaths.length === 1) return `Project suggestion for ${targetPaths[0]}`;
    if (targetPaths.length > 1) return `Project suggestion touching ${targetPaths.length} files`;
    return "Project suggestion";
  }
  if (targetPaths.length === 1) return `Suggestion for ${targetPaths[0]}`;
  return proposal.anchorType === "block" ? "Section suggestion" : "Whole-document suggestion";
}

function DiffPreview({ diff }: { diff: string }) {
  const lines = diff.split(/\r?\n/);
  const stats = diffStats(lines);
  const visibleLines = lines.slice(0, 140);
  const hiddenCount = Math.max(0, lines.length - visibleLines.length);

  return (
    <section className="mt-3 overflow-hidden rounded-md border border-studio-line bg-studio-sunken/55" aria-label={`Suggestion diff, ${stats.added} added, ${stats.removed} removed`}>
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-studio-line px-3 py-1.5">
        <p className="text-[11px] font-medium text-ink-subtle">Diff</p>
        <p className="shrink-0 font-mono text-[11px] text-ink-subtle">
          <span className="text-emerald-400">+{stats.added}</span>
          <span className="mx-1 text-ink-subtle">/</span>
          <span className="text-rose-400">-{stats.removed}</span>
        </p>
      </div>
      <pre className="max-h-[18dvh] overflow-auto py-1 text-[11px] leading-5 text-ink-muted">
        {visibleLines.map((line, index) => (
          <code key={`${index}:${line}`} className={cn("block border-l-2 border-transparent px-3 whitespace-pre-wrap break-words", diffLineClass(line))}>
            {line || " "}
          </code>
        ))}
        {hiddenCount > 0 && (
          <code className="block px-3 pt-1 text-ink-subtle">
            {hiddenCount} more {hiddenCount === 1 ? "line" : "lines"}
          </code>
        )}
      </pre>
    </section>
  );
}

function diffStats(lines: string[]) {
  return lines.reduce(
    (stats, line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) stats.added += 1;
      if (line.startsWith("-") && !line.startsWith("---")) stats.removed += 1;
      return stats;
    },
    { added: 0, removed: 0 },
  );
}

function diffLineClass(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "border-emerald-400/35 bg-emerald-500/[0.045] text-ink";
  if (line.startsWith("-") && !line.startsWith("---")) return "border-rose-400/35 bg-rose-500/[0.045] text-ink";
  if (line.startsWith("@@")) return "text-midnight-strong";
  if (line.startsWith("+++") || line.startsWith("---")) return "text-ink-subtle";
  return "";
}

function fallbackDiff(baseMarkdown: string | undefined, proposedMarkdown: string, path = "proposed.md") {
  if (!baseMarkdown || baseMarkdown === proposedMarkdown) return "";
  return [
    `--- ${path || "current.md"}`,
    `+++ ${path || "proposed.md"}`,
    "@@ whole-document-replacement @@",
    ...baseMarkdown.split("\n").map((line) => `-${line}`),
    ...proposedMarkdown.split("\n").map((line) => `+${line}`),
  ].join("\n");
}

function StatusText({ status }: { status: Proposal["status"] }) {
  const state =
    status === "accepted"
      ? { label: "Accepted", className: "text-emerald-400" }
      : status === "rejected"
        ? { label: "Rejected", className: "text-rose-400" }
        : { label: "Suggestion", className: "text-midnight-strong" };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state.label}
    </span>
  );
}
