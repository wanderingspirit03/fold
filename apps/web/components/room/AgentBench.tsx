"use client";

import { Circle, Clock3, FileText, ListChecks, MessageSquare } from "lucide-react";
import type { RoomPersona } from "../../lib/personas";
import { MarginThread } from "./MarginThread";
import { PersonaChip } from "./PersonaChip";
import { ProposalSlip } from "./ProposalSlip";
import type { ChatComment, Proposal, TimelineEvent } from "./types";

interface AgentBenchProps {
  filePath: string;
  comments: ChatComment[];
  proposals: Proposal[];
  timeline: TimelineEvent[];
  participants: RoomPersona[];
  selectedQuote: string;
  onOpenProposal: (proposal: Proposal) => void;
  onAcceptProposal: (proposal: Proposal) => void;
  onRejectProposal: (proposal: Proposal) => void;
}

export function AgentBench({
  filePath,
  comments,
  proposals,
  timeline,
  participants,
  selectedQuote,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
}: AgentBenchProps) {
  const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
  const recentProposals = proposals.slice(0, 5);
  const recentTimeline = timeline.slice(0, 4);

  return (
    <aside className="h-[calc(82dvh-48px)] overflow-y-auto bg-rail text-ink md:h-[calc(100dvh-48px)]">
      <div className="space-y-3 px-3 py-3">
        <div className="rounded-md border border-studio-line bg-studio-sunken/50 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
            <p className="truncate text-xs font-medium text-ink">{filePath}</p>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <ReviewCount icon={<MessageSquare className="h-3.5 w-3.5" />} count={comments.length} label="comments" />
            <ReviewCount icon={<ListChecks className="h-3.5 w-3.5" />} count={pendingProposals.length} label="pending" />
          </div>
        </div>

        {participants.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-hidden px-1">
            {participants.slice(0, 5).map((persona) => (
              <PersonaChip key={persona.id} persona={persona} compact />
            ))}
          </div>
        )}

        <section className="space-y-1 border-t border-studio-line pt-3">
          <RailHeading title="Comments" count={comments.length} />
          {selectedQuote && <MarginThread selectedQuote={selectedQuote} />}
          {comments.length === 0 && !selectedQuote ? (
            <PrimaryEmptyRailState />
          ) : (
            comments.map((comment) => (
              <MarginThread key={comment.id} comment={comment} />
            ))
          )}
        </section>

        <section className="space-y-1 border-t border-studio-line pt-3">
          <RailHeading title="Suggestions" count={proposals.length} />
          {recentProposals.length === 0 ? (
            <SoftRailState text="No suggestions." />
          ) : (
            recentProposals.map((proposal) => (
              <ProposalSlip
                key={proposal.id}
                proposal={proposal}
                onOpen={onOpenProposal}
                onAccept={onAcceptProposal}
                onReject={onRejectProposal}
              />
            ))
          )}
        </section>

        <section className="space-y-1 border-t border-studio-line pb-6 pt-3">
          <RailHeading title="Activity" count={timeline.length} />
          {recentTimeline.length === 0 ? (
            <SoftRailState text="No activity." />
          ) : (
            <div className="space-y-0.5">
              {recentTimeline.map((event) => (
                <div key={event.id} className="flex gap-2 rounded-md px-1.5 py-1.5 hover:bg-studio-sunken">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  <div className="min-w-0">
                    <p className="truncate text-xs leading-5 text-ink-muted">{event.message}</p>
                    <p className="font-mono text-[11px] text-ink-subtle">{formatTime(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function ReviewCount({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <span
      aria-label={`${count} ${label}`}
      title={`${count} ${label}`}
      className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded border border-studio-line bg-rail px-2 text-[11px] text-ink-subtle"
    >
      <span className="text-ink-subtle">{icon}</span>
      <span className="font-mono text-ink-muted">{count}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function RailHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <h3 className="text-xs font-medium uppercase text-ink-subtle">{title}</h3>
      <span className="font-mono text-[11px] text-ink-subtle">{count}</span>
    </div>
  );
}

function PrimaryEmptyRailState() {
  return (
    <div className="flex items-center gap-2 px-1.5 py-2 text-xs text-ink-subtle">
      <Circle className="h-3 w-3" />
      <span>No comments.</span>
    </div>
  );
}

function SoftRailState({ text }: { text: string }) {
  return <p className="px-1.5 py-2 text-xs leading-5 text-ink-subtle">{text}</p>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
