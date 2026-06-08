"use client";

import { useEffect, useRef } from "react";
import { Activity, Bot, MessageSquarePlus, Users } from "lucide-react";
import type { RoomPersona } from "../../lib/personas";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { MarginThread } from "./MarginThread";
import { PersonaChip } from "./PersonaChip";
import { ProposalSlip } from "./ProposalSlip";
import type { ChatComment, Proposal, TimelineEvent } from "./types";

interface AgentBenchProps {
  comments: ChatComment[];
  proposals: Proposal[];
  timeline: TimelineEvent[];
  participants: RoomPersona[];
  selectedQuote: string;
  newCommentText: string;
  newCommentType: ChatComment["type"];
  composerFocusToken: number;
  onNewCommentTextChange: (value: string) => void;
  onNewCommentTypeChange: (value: ChatComment["type"]) => void;
  onPostComment: (event: React.FormEvent) => void;
  onOpenProposal: (proposal: Proposal) => void;
  onAcceptProposal: (proposal: Proposal) => void;
  onRejectProposal: (proposal: Proposal) => void;
}

export function AgentBench({
  comments,
  proposals,
  timeline,
  participants,
  selectedQuote,
  newCommentText,
  newCommentType,
  composerFocusToken,
  onNewCommentTextChange,
  onNewCommentTypeChange,
  onPostComment,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
}: AgentBenchProps) {
  const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
  const recentProposals = proposals.slice(0, 5);
  const recentTimeline = timeline.slice(0, 4);
  const agentParticipants = participants.filter((persona) => persona.kind === "agent");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (composerFocusToken === 0) return;
    composerRef.current?.focus();
  }, [composerFocusToken]);

  return (
    <aside className="h-full border-t border-studio-line bg-rail text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] lg:border-l lg:border-t-0">
      <div className="px-4 py-4 lg:sticky lg:top-[105px] lg:max-h-[calc(100dvh-105px)] lg:overflow-y-auto">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-subtle">Margin Threads</p>
          <h2 className="mt-1 text-base font-semibold text-ink">Anchored review</h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted">
            Select text, add a note, or review suggested edits in context.
          </p>
        </div>

        <form onSubmit={onPostComment} className="mb-4 rounded-xl border border-studio-line bg-document p-3 shadow-[0_10px_28px_rgba(50,43,34,0.06)]">
          {selectedQuote ? (
            <MarginThread selectedQuote={selectedQuote} />
          ) : (
            <div className="mb-3 rounded-md border border-studio-line/50 bg-studio-paper/55 px-3 py-2 text-xs leading-5 text-ink-muted">
              No active anchor. Select document text or leave a whole-document note.
            </div>
          )}
          <Textarea
            ref={composerRef}
            aria-label="Margin note"
            placeholder={selectedQuote ? "Add a thread for this selection" : "Leave a whole-document note"}
            rows={3}
            value={newCommentText}
            onChange={(event) => onNewCommentTextChange(event.target.value)}
            required
            className="mt-3 bg-white"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <select
              aria-label="Thread type"
              className="h-8 rounded-md border border-studio-line bg-white px-2 text-xs text-ink-muted"
              value={newCommentType}
              onChange={(event) => onNewCommentTypeChange(event.target.value as ChatComment["type"])}
            >
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="request">Agent request</option>
              <option value="blocker">Blocker</option>
              <option value="decision">Decision</option>
              <option value="uncertainty">Uncertainty</option>
            </select>
            <Button type="submit" size="sm">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Add thread
            </Button>
          </div>
        </form>

        <section className="space-y-2">
          <RailHeading title="Open Threads" count={comments.length + pendingProposals.length} />
          {comments.length === 0 && pendingProposals.length === 0 ? (
            <PrimaryEmptyRailState title="No margin threads yet" text="Selections and suggested edits will collect here." />
          ) : (
            <>
              {pendingProposals.map((proposal) => (
                <MarginThread
                  key={proposal.id}
                  proposal={proposal}
                  onOpenProposal={onOpenProposal}
                  onAcceptProposal={onAcceptProposal}
                  onRejectProposal={onRejectProposal}
                />
              ))}
              {comments.map((comment) => (
                <MarginThread key={comment.id} comment={comment} />
              ))}
            </>
          )}
        </section>

        <section className="mt-6 space-y-2">
          <RailHeading title="Suggested Edits" count={proposals.length} />
          {recentProposals.length === 0 ? (
            <SoftRailState text="No suggested edits yet." />
          ) : (
            recentProposals.map((proposal) => (
              <ProposalSlip key={proposal.id} proposal={proposal} onOpen={onOpenProposal} />
            ))
          )}
        </section>

        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-subtle">Agent Bench</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">Room participants</h3>
            </div>
            <Bot className="h-4 w-4 text-ink-subtle" />
          </div>
          {participants.length === 0 ? (
            <SoftRailState text="Personas appear after encrypted room data replays." />
          ) : (
            <div className="space-y-2">
              {participants.map((persona) => (
                <div key={persona.id} className="rounded-lg border border-studio-line bg-document p-3 shadow-[0_6px_18px_rgba(50,43,34,0.04)]">
                  <PersonaChip persona={persona} />
                </div>
              ))}
            </div>
          )}
          {agentParticipants.length === 0 && (
            <p className="flex items-center gap-2 text-xs leading-5 text-ink-subtle">
              <Users className="h-3.5 w-3.5" />
              Agent personas appear when proposal records are decrypted.
            </p>
          )}
        </section>

        <section className="mt-6 space-y-2 pb-6">
          <RailHeading title="Room Log" count={timeline.length} />
          {recentTimeline.length === 0 ? (
            <SoftRailState text="No review events yet." />
          ) : (
            <div className="space-y-3 border-l border-studio-line pl-4">
              {recentTimeline.map((event) => (
                <div key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-rail bg-ink-subtle" />
                  <p className="text-sm font-medium leading-5 text-ink">{event.message}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-subtle">{formatTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function RailHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <span className="rounded-md bg-studio-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">{count}</span>
    </div>
  );
}

function PrimaryEmptyRailState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-studio-line/60 bg-studio-paper/50 px-3 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <Activity className="mx-auto mb-2 h-4 w-4 text-ink-subtle" />
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      <p className="mt-1 text-xs leading-5 text-ink-subtle">{text}</p>
    </div>
  );
}

function SoftRailState({ text }: { text: string }) {
  return <p className="rounded-md bg-studio-paper/30 px-3 py-2 text-xs leading-5 text-ink-subtle">{text}</p>;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
