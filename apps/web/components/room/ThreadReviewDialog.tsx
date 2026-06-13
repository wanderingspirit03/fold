"use client";

import { Check, Quote, X } from "lucide-react";
import { useEffect, useState } from "react";
import MarkdownRenderer from "../MarkdownRenderer";
import { extractMarkdownProperties } from "../../lib/markdown-properties";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { PersonaChip } from "./PersonaChip";
import type { Proposal } from "./types";

interface ThreadReviewDialogProps {
  proposal: Proposal | null;
  onClose: () => void;
  onAccept: (proposal: Proposal) => void;
  onReject: (proposal: Proposal) => void;
}

export function ThreadReviewDialog({
  proposal,
  onClose,
  onAccept,
  onReject,
}: ThreadReviewDialogProps) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const parsedProposal = proposal ? extractMarkdownProperties(proposal.proposedMarkdown) : null;
  const diff = proposal ? proposal.diff || fallbackDiff(proposal.createdFromMarkdown, proposal.proposedMarkdown) : "";

  useEffect(() => {
    setConfirmingAccept(false);
  }, [proposal?.id]);

  return (
    <Dialog open={Boolean(proposal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(860px,calc(100dvh-2rem))] max-w-3xl gap-0 overflow-hidden border-studio-line bg-studio-paper p-0 text-ink shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
        {proposal && (
          <>
            <DialogHeader className="border-b border-studio-line px-4 py-3 sm:px-5">
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

            <div className="min-h-0 overflow-y-auto px-4 py-3 sm:px-5">
              <div className="mb-3 flex min-h-8 items-center gap-2 rounded-md border border-studio-line bg-studio-sunken/70 px-2.5 py-1.5">
                <Quote className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                <p className="min-w-0 truncate text-xs leading-5 text-ink-muted">
                  {proposal.selectedQuote
                    ? proposal.selectedQuote
                    : proposal.anchorType === "block"
                      ? "Section suggestion"
                      : "Whole-document suggestion"}
                </p>
              </div>

              {diff ? <DiffPreview diff={diff} /> : null}

              <div className="overflow-hidden rounded-md border border-document-edge bg-document shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                <div className="border-b border-document-edge bg-black/[0.018] px-4 py-2">
                  <p className="text-[11px] font-medium text-document-subtle">Suggestion preview</p>
                </div>
                <div className="max-h-[54dvh] overflow-y-auto px-4 py-5 sm:px-6">
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
                  <MarkdownRenderer content={parsedProposal?.content ?? proposal.proposedMarkdown} />
                </div>
              </div>
            </div>

            {proposal.status === "pending" ? (
              <DialogFooter className="border-t border-studio-line bg-studio-paper px-4 py-3 sm:px-5">
                {confirmingAccept ? (
                  <div className="flex w-full items-center justify-end gap-2">
                    <p className="mr-auto text-xs text-midnight-strong">Apply?</p>
                    <Button variant="outline" onClick={() => setConfirmingAccept(false)} aria-label={`Cancel accepting ${proposal.title}`}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        onAccept(proposal);
                        setConfirmingAccept(false);
                      }}
                      aria-label={`Confirm accepting ${proposal.title}`}
                    >
                      <Check className="h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => onReject(proposal)}>
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button onClick={() => setConfirmingAccept(true)}>
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                  </>
                )}
              </DialogFooter>
            ) : (
              <div className="border-t border-studio-line bg-studio-paper px-4 py-3 sm:px-5">
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

function DiffPreview({ diff }: { diff: string }) {
  const lines = diff.split(/\r?\n/);
  const stats = diffStats(lines);
  const visibleLines = lines.slice(0, 140);
  const hiddenCount = Math.max(0, lines.length - visibleLines.length);

  return (
    <section className="mb-3 overflow-hidden rounded-md border border-studio-line bg-studio-sunken/55" aria-label={`Suggestion diff, ${stats.added} added, ${stats.removed} removed`}>
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-studio-line px-3 py-1.5">
        <p className="text-[11px] font-medium text-ink-subtle">Diff</p>
        <p className="shrink-0 font-mono text-[11px] text-ink-subtle">
          <span className="text-emerald-400">+{stats.added}</span>
          <span className="mx-1 text-ink-subtle">/</span>
          <span className="text-rose-400">-{stats.removed}</span>
        </p>
      </div>
      <pre className="max-h-[24dvh] overflow-auto py-1 text-[11px] leading-5 text-ink-muted">
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

function fallbackDiff(baseMarkdown: string | undefined, proposedMarkdown: string) {
  if (!baseMarkdown || baseMarkdown === proposedMarkdown) return "";
  return [
    "--- current.md",
    "+++ proposed.md",
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
