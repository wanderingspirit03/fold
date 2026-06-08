"use client";

import { Check, CircleDot, Eye, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { PersonaChip } from "./PersonaChip";
import type { Proposal } from "./types";

interface ProposalSlipProps {
  proposal: Proposal;
  onOpen: (proposal: Proposal) => void;
  onAccept?: (proposal: Proposal) => void;
  onReject?: (proposal: Proposal) => void;
}

export function ProposalSlip({ proposal, onOpen, onAccept, onReject }: ProposalSlipProps) {
  const state =
    proposal.status === "accepted"
      ? { label: "Accepted", icon: Check, className: "text-emerald-400" }
      : proposal.status === "rejected"
        ? { label: "Rejected", icon: X, className: "text-rose-400" }
        : { label: "Pending", icon: CircleDot, className: "text-midnight-strong" };
  const Icon = state.icon;
  const anchorText = proposal.selectedQuote
    ? `Anchored to "${proposal.selectedQuote}"`
    : proposal.anchorType === "block"
      ? "Section suggestion"
      : "Whole-document suggestion";

  return (
    <div
      className={cn(
        "rounded-md border border-transparent px-2 py-2",
        "transition-colors hover:border-studio-line hover:bg-studio-sunken focus-within:border-studio-line focus-within:bg-studio-sunken/60",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(proposal)}
        aria-label={`Preview ${proposal.title}`}
        className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", state.className)}>
            <Icon className="h-3.5 w-3.5" />
            {state.label}
          </span>
          <span className="font-mono text-[11px] text-ink-subtle">{formatTime(proposal.createdAt)}</span>
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-5 text-ink">{proposal.title}</p>
        <p className="mt-1 line-clamp-1 border-l-2 border-midnight/30 px-2 text-[11px] leading-5 text-ink-subtle">{anchorText}</p>
        {proposal.comment && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{proposal.comment}</p>}
      </button>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <PersonaChip persona={proposal.persona} compact />
        <span className="inline-flex items-center gap-1">
          {proposal.status === "pending" && (
            <>
              <button
                type="button"
                aria-label={`Accept ${proposal.title}`}
                title="Accept"
                className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-midnight-soft hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                onClick={() => onAccept?.(proposal)}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Reject ${proposal.title}`}
                title="Reject"
                className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                onClick={() => onReject?.(proposal)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onOpen(proposal)}
            aria-label={`Preview ${proposal.title}`}
            className="inline-flex h-9 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </span>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
