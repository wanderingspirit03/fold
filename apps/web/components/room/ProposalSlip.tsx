"use client";

import { AlertTriangle, Check, Circle, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { PersonaChip } from "./PersonaChip";
import type { Proposal } from "./types";

interface ProposalSlipProps {
  proposal: Proposal;
  anchorMissing?: boolean;
  onOpen: (proposal: Proposal) => void;
  onAccept?: (proposal: Proposal) => void;
  onReject?: (proposal: Proposal) => void;
}

export function ProposalSlip({ proposal, anchorMissing = false, onOpen, onAccept, onReject }: ProposalSlipProps) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const state =
    proposal.status === "accepted"
      ? { label: "Accepted", icon: Check, className: "text-emerald-400", accentClassName: "border-l-emerald-400/55" }
      : proposal.status === "rejected"
        ? { label: "Rejected", icon: X, className: "text-rose-400", accentClassName: "border-l-rose-400/50" }
        : { label: "Pending suggestion", icon: Circle, className: "text-midnight-strong", accentClassName: "border-l-midnight/55" };
  const Icon = state.icon;
  const anchorText = proposal.selectedQuote
    ? proposal.selectedQuote
    : proposal.anchorType === "block"
      ? "Section suggestion"
      : proposalTargetLabel(proposal);
  const renderedAnchor = proposal.selectedQuote ? `"${anchorText}"` : anchorText;

  useEffect(() => {
    setConfirmingAccept(false);
  }, [proposal.id, proposal.status]);

  return (
    <article
      className={cn(
        "group rounded border border-transparent border-l-2 px-1.5 py-1.5",
        "transition-colors hover:border-studio-line hover:bg-studio-sunken/75 focus-within:border-studio-line focus-within:bg-studio-sunken/70",
        state.accentClassName,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(proposal)}
        aria-label={`Open ${state.label.toLowerCase()} ${proposal.title}`}
        className="block w-full rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={cn("h-3 w-3 shrink-0", state.className)} aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-ink">{proposal.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-ink-subtle">{formatTime(proposal.createdAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 pl-5 text-xs leading-5 text-ink-subtle">
          <span className={cn(proposal.selectedQuote ? "text-midnight-strong" : "text-ink-subtle", anchorMissing && "text-ink-subtle line-through decoration-studio-line")}>{renderedAnchor}</span>
          {proposal.comment ? <span className="text-ink-muted"> · {proposal.comment}</span> : null}
        </p>
        {anchorMissing && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded border border-midnight/25 bg-midnight-mark px-1.5 py-0.5 text-[11px] text-midnight-strong">
            <AlertTriangle className="h-3 w-3 text-midnight-strong" />
            Anchor needs review
          </p>
        )}
      </button>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2 pl-5">
        <PersonaChip persona={proposal.persona} compact className="min-w-0 opacity-90" />
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onOpen(proposal)}
            aria-label={`Preview ${proposal.title}`}
            title="Preview"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-2.5 text-xs text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:min-h-8 md:w-8 md:gap-0 md:px-0"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="md:sr-only">Preview</span>
          </button>
          {proposal.status === "pending" && confirmingAccept && (
            <div className="flex min-h-11 items-center gap-1 rounded px-1 md:min-h-8">
              <span className="text-[11px] text-midnight-strong">Apply?</span>
              <button
                type="button"
                aria-label={`Cancel accepting ${proposal.title}`}
                title="Cancel"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded px-2 text-xs text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:min-w-8 md:px-0"
                onClick={() => setConfirmingAccept(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Confirm accepting ${proposal.title}`}
                title="Apply"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded px-2 text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:min-w-8 md:px-0"
                onClick={() => {
                  onAccept?.(proposal);
                  setConfirmingAccept(false);
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {proposal.status === "pending" && !confirmingAccept && (
            <>
              <button
                type="button"
                aria-label={`Accept ${proposal.title}`}
                title="Accept"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:min-h-8 md:w-8 md:gap-0 md:px-0"
                onClick={() => setConfirmingAccept(true)}
              >
                <Check className="h-3.5 w-3.5" />
                <span className="md:sr-only">Accept</span>
              </button>
              <button
                type="button"
                aria-label={`Reject ${proposal.title}`}
                title="Reject"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-2.5 text-xs text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:min-h-8 md:w-8 md:gap-0 md:px-0"
                onClick={() => onReject?.(proposal)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="md:sr-only">Reject</span>
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function proposalTargetLabel(proposal: Proposal) {
  const paths = proposal.targetPaths?.length
    ? proposal.targetPaths
    : proposal.filePath
      ? [proposal.filePath]
      : [];
  if (proposal.kind === "project-replacement") {
    if (paths.length === 1) return `${paths[0]} project suggestion`;
    if (paths.length > 1) return `${paths.length} files changed`;
    return "Project suggestion";
  }
  if (paths.length === 1) return `${paths[0]} suggestion`;
  return "Whole-document suggestion";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
