"use client";

import { Check, Eye, Quote, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment, Proposal } from "./types";

interface MarginThreadProps {
  comment?: ChatComment;
  proposal?: Proposal;
  selectedQuote?: string;
  onOpenProposal?: (proposal: Proposal) => void;
  onAcceptProposal?: (proposal: Proposal) => void;
  onRejectProposal?: (proposal: Proposal) => void;
}

export function MarginThread({
  comment,
  proposal,
  selectedQuote,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
}: MarginThreadProps) {
  const persona = comment?.persona || proposal?.persona;
  const type = comment?.type || (proposal ? "suggestion" : "selection");
  const text = comment?.text || proposal?.comment || "Start a note or ask an agent to revise this passage.";
  const quote = selectedQuote || comment?.selectedQuote || proposal?.selectedQuote;
  const anchorLabel = getAnchorLabel(comment?.anchorType || proposal?.anchorType, quote);

  return (
    <div
      className={cn(
        "rounded-lg border bg-document p-3",
        selectedQuote ? "border-cyan-200 shadow-[0_0_0_1px_rgba(8,145,178,0.08)]" : "border-studio-line",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {persona ? (
          <PersonaChip persona={persona} compact />
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            Current selection
          </span>
        )}
        <span className="rounded-md bg-studio-paper px-1.5 py-0.5 text-[11px] font-medium capitalize text-ink-muted">
          {type}
        </span>
      </div>
      {selectedQuote && (
        <QuoteBlock tone="active" quote={selectedQuote} />
      )}
      {!selectedQuote && quote && (
        <QuoteBlock
          tone="saved"
          quote={quote}
          before={comment?.beforeContext || proposal?.beforeContext}
          after={comment?.afterContext || proposal?.afterContext}
        />
      )}
      {!selectedQuote && !quote && anchorLabel && (
        <p className="mb-2 rounded-md bg-studio-paper/70 px-2 py-1.5 text-xs text-ink-subtle">{anchorLabel}</p>
      )}
      <p className="text-sm leading-6 text-ink-muted">{text}</p>
      {comment && <p className="mt-2 font-mono text-[11px] text-ink-subtle">{formatTime(comment.createdAt)}</p>}
      {proposal && (
        <div className="mt-3 rounded-md border border-amber-200/70 bg-amber-50/40 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-amber-800">Suggested replacement</span>
            <span className="font-mono text-[11px] text-ink-subtle">{proposal.status}</span>
          </div>
          <p className="line-clamp-2 text-sm font-medium leading-5 text-ink">{proposal.title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProposal?.(proposal)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            {proposal.status === "pending" && (
              <>
                <Button type="button" size="sm" onClick={() => onAcceptProposal?.(proposal)}>
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
  tone: "active" | "saved";
}) {
  return (
    <div
      className={cn(
        "mb-2 flex gap-2 rounded-md border px-2 py-1.5 text-xs leading-5 text-ink-muted",
        tone === "active" ? "border-cyan-100 bg-cyan-50/70" : "border-studio-line bg-studio-paper/55",
      )}
    >
      <Quote
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          tone === "active" ? "text-cyan-700" : "text-ink-subtle",
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
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
