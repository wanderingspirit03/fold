"use client";

import { AlertTriangle, Check, Eye, Quote, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment, Proposal } from "./types";

interface MarginThreadProps {
  comment?: ChatComment;
  proposal?: Proposal;
  selectedQuote?: string;
  anchorState?: "found" | "missing";
  onOpenProposal?: (proposal: Proposal) => void;
  onAcceptProposal?: (proposal: Proposal) => void;
  onRejectProposal?: (proposal: Proposal) => void;
  onResolveComment?: (comment: ChatComment, resolved: boolean) => void;
}

export function MarginThread({
  comment,
  proposal,
  selectedQuote,
  anchorState,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
  onResolveComment,
}: MarginThreadProps) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const persona = comment?.persona || proposal?.persona;
  const text = comment?.text || proposal?.comment || "Start a note or ask an agent to revise this passage.";
  const quote = selectedQuote || comment?.selectedQuote || proposal?.selectedQuote;
  const anchorLabel = getAnchorLabel(comment?.anchorType || proposal?.anchorType, quote);

  useEffect(() => {
    setConfirmingAccept(false);
  }, [proposal?.id, proposal?.status]);

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2.5",
        selectedQuote ? "border-midnight/45 bg-midnight-mark" : "border-transparent bg-transparent hover:bg-studio-sunken",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {persona ? (
          <PersonaChip persona={persona} compact />
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink">
            <span className="h-2 w-2 rounded-full bg-midnight-strong" />
            Current selection
          </span>
        )}
        {comment && <span className="font-mono text-[11px] text-ink-subtle">{formatTime(comment.createdAt)}</span>}
      </div>
      {selectedQuote && (
        <QuoteBlock tone="active" quote={selectedQuote} />
      )}
      {!selectedQuote && quote && (
        <QuoteBlock
          tone={anchorState === "missing" ? "missing" : "saved"}
          quote={quote}
          before={comment?.beforeContext || proposal?.beforeContext}
          after={comment?.afterContext || proposal?.afterContext}
        />
      )}
      {!selectedQuote && quote && anchorState === "missing" && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded border border-midnight/25 bg-midnight-mark px-2 py-1 text-[11px] text-midnight-strong">
          <AlertTriangle className="h-3.5 w-3.5 text-midnight-strong" />
          Anchor needs review
        </p>
      )}
      {!selectedQuote && !quote && anchorLabel && (
        <p className="mb-2 rounded-md bg-studio-paper px-2 py-1.5 text-xs text-ink-subtle">{anchorLabel}</p>
      )}
      <p className="text-sm leading-6 text-ink-muted">{text}</p>
      {comment && onResolveComment && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            aria-label={comment.resolvedAt ? "Reopen comment" : "Resolve comment"}
            title={comment.resolvedAt ? "Reopen" : "Resolve"}
            className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
            onClick={() => onResolveComment(comment, !comment.resolvedAt)}
          >
            {comment.resolvedAt ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {comment.resolvedAt ? "Reopen" : "Resolve"}
          </button>
        </div>
      )}
      {proposal && (
        <div className="mt-3 rounded-md border border-midnight/30 bg-midnight-mark p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-midnight-strong">Suggested replacement</span>
            <span className="font-mono text-[11px] text-ink-subtle">{proposal.status}</span>
          </div>
          <p className="line-clamp-2 text-sm font-medium leading-5 text-ink">{proposal.title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProposal?.(proposal)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            {proposal.status === "pending" && confirmingAccept && (
              <div className="flex min-h-9 items-center gap-1 rounded px-1">
                <span className="text-[11px] text-midnight-strong">Apply?</span>
                <Button type="button" variant="outline" size="sm" aria-label={`Cancel accepting ${proposal.title}`} onClick={() => setConfirmingAccept(false)}>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Confirm accepting ${proposal.title}`}
                  onClick={() => {
                    onAcceptProposal?.(proposal);
                    setConfirmingAccept(false);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply
                </Button>
              </div>
            )}
            {proposal.status === "pending" && !confirmingAccept && (
              <>
                <Button type="button" size="sm" onClick={() => setConfirmingAccept(true)}>
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onRejectProposal?.(proposal)}>
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteBlock({
  quote,
  before,
  after,
  tone,
}: {
  quote: string;
  before?: string;
  after?: string;
  tone: "active" | "saved" | "missing";
}) {
  return (
    <div
      className={cn(
        "mb-2 flex gap-2 border-l-2 px-2 py-0.5 text-xs leading-5 text-ink-muted",
        tone === "active"
          ? "border-midnight-strong bg-transparent"
          : tone === "missing"
            ? "border-dashed border-studio-line bg-studio-sunken/45 opacity-80"
            : "border-studio-line bg-transparent",
      )}
    >
      <Quote
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          tone === "active" ? "text-midnight-strong" : "text-ink-subtle",
        )}
      />
      <span className="line-clamp-3">
        {before && <span className="text-ink-subtle">{trimContext(before)} </span>}
        <span className="text-ink">{quote}</span>
        {after && <span className="text-ink-subtle"> {trimContext(after)}</span>}
      </span>
    </div>
  );
}

function getAnchorLabel(anchorType: ChatComment["anchorType"] | Proposal["anchorType"], quote?: string) {
  if (quote) return null;
  if (anchorType === "document") return "Whole-document thread";
  if (anchorType === "block") return "Section thread";
  if (anchorType === "insertion-point") return "Insertion point";
  if (anchorType === "text-range") return "Saved text anchor";
  return null;
}

function trimContext(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
