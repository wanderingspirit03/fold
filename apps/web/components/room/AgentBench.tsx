"use client";

import { AlertTriangle, Check, Clock3, FileText, ListChecks, MessageSquare, RotateCcw, Save, Undo2, X } from "lucide-react";
import { useState } from "react";
import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { MarginThread } from "./MarginThread";
import { PersonaAvatar } from "./PersonaAvatar";
import { ProposalSlip } from "./ProposalSlip";
import type { ChatComment, FileVersion, Proposal, TimelineEvent } from "./types";

interface AgentBenchProps {
  filePath: string;
  markdown: string;
  comments: ChatComment[];
  proposals: Proposal[];
  versions: FileVersion[];
  timeline: TimelineEvent[];
  participants: RoomPersona[];
  selectedQuote: string;
  onOpenProposal: (proposal: Proposal) => void;
  onAcceptProposal: (proposal: Proposal) => void;
  onRejectProposal: (proposal: Proposal) => void;
  onResolveComment: (comment: ChatComment, resolved: boolean) => void;
  onCreateVersion: (title: string) => void;
  onRestoreVersion: (version: FileVersion) => void;
}

export function AgentBench({
  filePath,
  markdown,
  comments,
  proposals,
  versions,
  timeline,
  participants,
  selectedQuote,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
  onResolveComment,
  onCreateVersion,
  onRestoreVersion,
}: AgentBenchProps) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [versionTitle, setVersionTitle] = useState("");
  const [restoreCandidateId, setRestoreCandidateId] = useState<string | null>(null);
  const activeComments = comments.filter((comment) => !comment.resolvedAt);
  const resolvedComments = comments.filter((comment) => comment.resolvedAt);
  const pendingProposals = proposals.filter((proposal) => proposal.status === "pending");
  const detachedComments = activeComments.filter((comment) => isMissingTextAnchor(comment, markdown));
  const detachedProposals = proposals.filter((proposal) => isMissingTextAnchor(proposal, markdown));
  const detachedCount = detachedComments.length + detachedProposals.length;
  const recentVersions = versions.slice(0, 5);
  const recentProposals = [...proposals]
    .sort((left, right) => {
      if (left.status === "pending" && right.status !== "pending") return -1;
      if (left.status !== "pending" && right.status === "pending") return 1;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 5);
  const recentTimeline = timeline.slice(0, 4);
  const showCommentsSection = Boolean(selectedQuote || activeComments.length > 0 || resolvedComments.length > 0);
  const showReviewCounts = activeComments.length > 0 || pendingProposals.length > 0 || detachedCount > 0;
  const showSuggestionsSection = recentProposals.length > 0;

  return (
    <aside className="h-[calc(100dvh-145px)] overflow-y-auto bg-rail text-ink md:h-[calc(100dvh-48px)]">
      <div className="space-y-3 px-3 py-3">
        <div className="border-b border-studio-line px-1 pb-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
              <p className="truncate text-xs font-medium text-ink">{filePath}</p>
            </div>
            <ParticipantDots participants={participants} />
          </div>
          {showReviewCounts && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeComments.length > 0 && (
                <ReviewCount
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  count={activeComments.length}
                  label="comments"
                  singularLabel="comment"
                />
              )}
              {pendingProposals.length > 0 && (
                <ReviewCount
                  icon={<ListChecks className="h-3.5 w-3.5" />}
                  count={pendingProposals.length}
                  label="pending"
                  singularLabel="pending suggestion"
                  pluralLabel="pending suggestions"
                />
              )}
              {detachedCount > 0 && (
                <ReviewCount
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  count={detachedCount}
                  label="detached"
                  singularLabel="detached anchor"
                  pluralLabel="detached anchors"
                  tone="warning"
                />
              )}
            </div>
          )}
        </div>

        {showCommentsSection && (
          <section className="space-y-1">
            <RailHeading title="Comments" count={activeComments.length} />
            {selectedQuote && <MarginThread selectedQuote={selectedQuote} />}
            {activeComments.map((comment) => (
              <MarginThread
                key={comment.id}
                comment={comment}
                anchorState={isMissingTextAnchor(comment, markdown) ? "missing" : "found"}
                onResolveComment={onResolveComment}
              />
            ))}
            {resolvedComments.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  aria-expanded={resolvedOpen}
                  className="flex h-8 w-full items-center justify-between rounded px-1.5 text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                  onClick={() => setResolvedOpen((open) => !open)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resolved
                  </span>
                  <span className="font-mono text-[11px]">{resolvedComments.length}</span>
                </button>
                {resolvedOpen && (
                  <div className="mt-1 space-y-1 opacity-80">
                    {resolvedComments.map((comment) => (
                      <MarginThread
                        key={comment.id}
                        comment={comment}
                        anchorState={isMissingTextAnchor(comment, markdown) ? "missing" : "found"}
                        onResolveComment={onResolveComment}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {showSuggestionsSection && (
          <section className="space-y-1 border-t border-studio-line pt-3">
            <RailHeading title="Suggestions" count={proposals.length} />
            {recentProposals.map((proposal) => (
              <ProposalSlip
                key={proposal.id}
                proposal={proposal}
                anchorMissing={isMissingTextAnchor(proposal, markdown)}
                onOpen={onOpenProposal}
                onAccept={onAcceptProposal}
                onReject={onRejectProposal}
              />
            ))}
          </section>
        )}

        <section className="space-y-2 border-t border-studio-line pt-3">
          <RailHeading title="Versions" count={versions.length} />
          <form
            className="flex gap-1 px-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const title = versionTitle.trim();
              if (!title) return;
              onCreateVersion(title);
              setRestoreCandidateId(null);
              setVersionTitle("");
            }}
          >
            <input
              aria-label="Version name"
              value={versionTitle}
              onChange={(event) => setVersionTitle(event.target.value)}
              placeholder="Name checkpoint"
              className="min-w-0 flex-1 rounded border border-studio-line bg-studio-sunken px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-midnight-strong"
            />
            <button
              type="submit"
              aria-label="Save version"
              disabled={!versionTitle.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-studio-line bg-rail text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </form>
          {recentVersions.length > 0 && (
            <div className="space-y-0.5">
              {recentVersions.map((version) => {
                const confirmingRestore = restoreCandidateId === version.id;

                return (
                  <div
                    key={version.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-studio-sunken",
                      confirmingRestore && "bg-midnight-mark",
                    )}
                  >
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs leading-5 text-ink-muted">{version.title}</p>
                      <p className="truncate font-mono text-[11px] text-ink-subtle">
                        {formatTime(version.createdAt)} · {version.persona.name}
                      </p>
                    </div>
                    {confirmingRestore ? (
                      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Confirm restore ${version.title}`}>
                        <span className="text-[11px] text-midnight-strong">Restore?</span>
                        <button
                          type="button"
                          aria-label={`Confirm restore ${version.title}`}
                          title={`Confirm restore ${version.title}`}
                          onClick={() => {
                            onRestoreVersion(version);
                            setRestoreCandidateId(null);
                          }}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-midnight-strong transition-colors hover:bg-midnight-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel restore ${version.title}`}
                          title="Cancel restore"
                          onClick={() => setRestoreCandidateId(null)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Restore ${version.title}`}
                        title={`Restore ${version.title}`}
                        onClick={() => setRestoreCandidateId(version.id)}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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

function ParticipantDots({ participants }: { participants: RoomPersona[] }) {
  if (participants.length === 0) return null;

  const visible = participants.slice(0, 4);
  const hiddenCount = Math.max(0, participants.length - visible.length);
  const label = participants.map((persona) => persona.name).join(", ");

  return (
    <div className="flex shrink-0 items-center" role="group" aria-label={`Participants: ${label}`} title={label}>
      {visible.map((persona, index) => (
        <PersonaAvatar
          key={persona.id}
          persona={persona}
          compact
          className={cn(
            "h-6 w-6 ring-2 ring-rail",
            index > 0 && "-ml-1.5",
          )}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className="-ml-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-studio-sunken px-1 text-[10px] font-medium text-ink-subtle ring-2 ring-rail"
          aria-hidden="true"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function ReviewCount({
  icon,
  count,
  label,
  singularLabel,
  pluralLabel,
  tone = "default",
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  singularLabel: string;
  pluralLabel?: string;
  tone?: "default" | "warning";
}) {
  const accessibleLabel = `${count} ${count === 1 ? singularLabel : pluralLabel || label}`;

  return (
    <span
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        "inline-flex h-6 min-w-0 items-center gap-1.5 rounded border bg-rail px-2 text-[11px]",
        tone === "warning" ? "border-midnight/30 text-midnight-strong" : "border-studio-line text-ink-subtle",
      )}
    >
      <span className={cn(tone === "warning" ? "text-midnight-strong" : "text-ink-subtle")}>{icon}</span>
      <span className={cn("font-mono", tone === "warning" ? "text-midnight-strong" : "text-ink-muted")}>{count}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function RailHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <h3 className="text-xs font-medium uppercase text-ink-subtle">{title}</h3>
      {count > 0 && <span className="font-mono text-[11px] text-ink-subtle">{count}</span>}
    </div>
  );
}

function SoftRailState({ text }: { text: string }) {
  return <p className="px-1.5 py-2 text-xs leading-5 text-ink-subtle">{text}</p>;
}

function isMissingTextAnchor(record: Pick<ChatComment | Proposal, "anchorType" | "selectedQuote">, markdown: string) {
  const quote = record.selectedQuote?.trim();
  if (record.anchorType !== "text-range" || !quote) return false;
  return !normalizeWhitespace(markdown).includes(normalizeWhitespace(quote));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
