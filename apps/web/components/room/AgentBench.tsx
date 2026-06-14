"use client";

import { AlertTriangle, Bot, Check, Clock3, FileText, ListChecks, MessageSquare, RotateCcw, Save, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { MarginThread } from "./MarginThread";
import { PersonaAvatar } from "./PersonaAvatar";
import { ProposalSlip } from "./ProposalSlip";
import type { ChatComment, FileConflict, FileVersion, Proposal, TimelineEvent } from "./types";

interface AgentBenchProps {
  filePath: string;
  markdown: string;
  comments: ChatComment[];
  proposals: Proposal[];
  versions: FileVersion[];
  conflict?: FileConflict | null;
  timeline: TimelineEvent[];
  participants: RoomPersona[];
  selectedQuote: string;
  onOpenProposal: (proposal: Proposal) => void;
  onAcceptProposal: (proposal: Proposal) => void;
  onRejectProposal: (proposal: Proposal) => void;
  onResolveComment: (comment: ChatComment, resolved: boolean) => void;
  onReplyToComment: (comment: ChatComment, text: string) => void;
  onCreateVersion: (title: string) => void;
  onRestoreVersion: (version: FileVersion) => void;
  onUseIncomingConflict: (conflict: FileConflict) => void;
  onKeepLocalConflict: (conflict: FileConflict) => void;
}

export function AgentBench({
  filePath,
  markdown,
  comments,
  proposals,
  versions,
  conflict,
  timeline,
  participants,
  selectedQuote,
  onOpenProposal,
  onAcceptProposal,
  onRejectProposal,
  onResolveComment,
  onReplyToComment,
  onCreateVersion,
  onRestoreVersion,
  onUseIncomingConflict,
  onKeepLocalConflict,
}: AgentBenchProps) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [versionComposerOpen, setVersionComposerOpen] = useState(false);
  const [versionTitle, setVersionTitle] = useState("");
  const [restoreCandidateId, setRestoreCandidateId] = useState<string | null>(null);
  const [incomingCandidateId, setIncomingCandidateId] = useState<string | null>(null);
  const activeComments = comments.filter((comment) => !comment.resolvedAt);
  const activeRequests = activeComments.filter((comment) => comment.type === "request");
  const activeNotes = activeComments.filter((comment) => comment.type !== "request");
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
  const visibleTimeline = timeline.filter((event) => !isRoutineEmptyProjectEvent(event));
  const recentTimeline = visibleTimeline.slice(0, 4);
  const showCommentsSection = Boolean(selectedQuote || activeComments.length > 0 || resolvedComments.length > 0);
  const showReviewCounts = activeComments.length > 0 || pendingProposals.length > 0 || detachedCount > 0 || Boolean(conflict);
  const showSuggestionsSection = recentProposals.length > 0;
  const showVersionsSection = markdown.trim().length > 0 || versions.length > 0;

  useEffect(() => {
    setIncomingCandidateId(null);
  }, [conflict?.path, conflict?.remoteUpdatedAt, conflict?.remoteDeleted]);

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
              {activeNotes.length > 0 && (
                <ReviewCount
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  count={activeNotes.length}
                  label="comments"
                  singularLabel="comment"
                />
              )}
              {activeRequests.length > 0 && (
                <ReviewCount
                  icon={<Bot className="h-3.5 w-3.5" />}
                  count={activeRequests.length}
                  label="requests"
                  singularLabel="agent request"
                  pluralLabel="agent requests"
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
              {conflict && (
                <ReviewCount
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  count={1}
                  label="incoming"
                  singularLabel="incoming edit"
                  pluralLabel="incoming edits"
                  tone="warning"
                />
              )}
            </div>
          )}
        </div>

        {conflict && (
          <section className="space-y-2">
            <RailHeading title="Incoming edit" count={1} />
            <div className="rounded-md border border-midnight/25 bg-midnight-mark px-2.5 py-2">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-ink-muted">
                    {conflict.persona?.name || "Someone"} {conflict.remoteDeleted ? "removed this file" : "changed this file"} while your edit was unsaved.
                  </p>
                  <p className="font-mono text-[11px] text-ink-subtle">{formatTime(conflict.remoteUpdatedAt)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                {incomingCandidateId === conflictKey(conflict) ? (
                  <>
                    <span className="mr-auto text-[11px] font-medium text-ink-muted">
                      {conflict.remoteDeleted ? "Delete local file?" : "Apply incoming?"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Cancel incoming edit for ${conflict.path}`}
                      title="Cancel"
                      onClick={() => setIncomingCandidateId(null)}
                      className="inline-flex h-11 items-center rounded border border-studio-line bg-rail px-3 text-xs text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      aria-label={`Confirm incoming edit for ${conflict.path}`}
                      title={conflict.remoteDeleted ? "Delete local file" : "Apply incoming edit"}
                      onClick={() => {
                        onUseIncomingConflict(conflict);
                        setIncomingCandidateId(null);
                      }}
                      className="inline-flex h-11 items-center rounded bg-midnight px-3 text-xs font-medium text-white transition-colors hover:bg-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
                    >
                      {conflict.remoteDeleted ? "Delete" : "Apply"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onKeepLocalConflict(conflict);
                        setIncomingCandidateId(null);
                      }}
                      className="inline-flex h-11 items-center rounded border border-studio-line bg-rail px-3 text-xs text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
                    >
                      Keep mine
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomingCandidateId(conflictKey(conflict))}
                      className="inline-flex h-11 items-center rounded bg-midnight px-3 text-xs font-medium text-white transition-colors hover:bg-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
                    >
                      Use incoming
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {showCommentsSection && (
          <section className="space-y-1">
            {activeRequests.length > 0 && (
              <>
                <RailHeading title="Requests" count={activeRequests.length} />
                {activeRequests.map((comment) => (
                  <MarginThread
                    key={comment.id}
                    comment={comment}
                    anchorState={isMissingTextAnchor(comment, markdown) ? "missing" : "found"}
                    onResolveComment={onResolveComment}
                    onReplyToComment={onReplyToComment}
                  />
                ))}
              </>
            )}
            {(selectedQuote || activeNotes.length > 0) && (
              <RailHeading title="Comments" count={activeNotes.length} />
            )}
            {selectedQuote && <MarginThread selectedQuote={selectedQuote} />}
            {activeNotes.map((comment) => (
              <MarginThread
                key={comment.id}
                comment={comment}
                anchorState={isMissingTextAnchor(comment, markdown) ? "missing" : "found"}
                onResolveComment={onResolveComment}
                onReplyToComment={onReplyToComment}
              />
            ))}
            {resolvedComments.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  aria-expanded={resolvedOpen}
                  className="flex h-11 w-full items-center justify-between rounded px-2 text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-1.5"
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
                        onReplyToComment={onReplyToComment}
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

        {showVersionsSection && (
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
                setVersionComposerOpen(false);
              }}
            >
              {versionComposerOpen ? (
                <>
                  <input
                    aria-label="Version name"
                    value={versionTitle}
                    onChange={(event) => setVersionTitle(event.target.value)}
                    placeholder="Name checkpoint"
                    className="min-w-0 flex-1 rounded border border-studio-line bg-studio-sunken px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-midnight-strong"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label="Cancel version"
                    title="Cancel"
                    onClick={() => {
                      setVersionTitle("");
                      setVersionComposerOpen(false);
                    }}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="submit"
                    aria-label="Save version"
                    disabled={!versionTitle.trim()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label="Save named version"
                  onClick={() => setVersionComposerOpen(true)}
                  className="inline-flex h-11 w-full items-center gap-2 rounded px-1.5 text-left text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save checkpoint</span>
                </button>
              )}
            </form>
            {recentVersions.length > 0 && (
              <div className="space-y-0.5">
                {recentVersions.map((version) => {
                  const confirmingRestore = restoreCandidateId === version.id;
                  const versionStats = markdownStats(version.markdown);
                  const restoreImpact = restoreImpactLabel(markdown, version.markdown);

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
                          {formatTime(version.createdAt)} · {version.persona.name} · {versionStats.lines}l/{versionStats.words}w
                        </p>
                      </div>
                      {confirmingRestore ? (
                        <div
                          className="flex shrink-0 items-center gap-1"
                          role="group"
                          aria-label={`Confirm restore ${version.title}: ${restoreImpact}`}
                        >
                          <span className="hidden text-[11px] text-midnight-strong lg:inline">{restoreImpact}</span>
                          <span className="text-[11px] text-midnight-strong">Restore?</span>
                          <button
                            type="button"
                            aria-label={`Confirm restore ${version.title}: ${restoreImpact}`}
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
        )}

        {recentTimeline.length > 0 && (
          <section className="space-y-1 border-t border-studio-line pb-6 pt-3">
            <RailHeading title="Activity" count={visibleTimeline.length} />
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
          </section>
        )}
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
            "h-5 w-5 ring-1 ring-rail",
            index > 0 && "-ml-1.5",
          )}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className="-ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-studio-sunken px-1 text-[9px] font-medium text-ink-subtle ring-1 ring-rail"
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
  const visibleLabel = count === 1 ? singularLabel : pluralLabel || label;
  const accessibleLabel = `${count} ${visibleLabel}`;

  return (
    <span
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        "inline-flex h-6 min-w-0 items-center gap-1.5 px-1 text-[11px]",
        tone === "warning" ? "text-midnight-strong" : "text-ink-subtle",
      )}
    >
      <span className={cn(tone === "warning" ? "text-midnight-strong" : "text-ink-subtle")}>{icon}</span>
      <span className={cn("font-mono", tone === "warning" ? "text-midnight-strong" : "text-ink-muted")}>{count}</span>
      <span className="truncate">{visibleLabel}</span>
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

function isRoutineEmptyProjectEvent(event: TimelineEvent) {
  return event.type === "publish" && event.message === "Created empty Markdown project room";
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

function markdownStats(markdown: string) {
  const trimmed = markdown.trim();
  return {
    lines: trimmed ? trimmed.split(/\r?\n/).length : 0,
    words: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
  };
}

function restoreImpactLabel(currentMarkdown: string, versionMarkdown: string) {
  const current = markdownStats(currentMarkdown);
  const next = markdownStats(versionMarkdown);
  const lineDelta = next.lines - current.lines;
  const wordDelta = next.words - current.words;
  const lineText = signedCount(lineDelta, "line");
  const wordText = signedCount(wordDelta, "word");
  return `${lineText}, ${wordText}`;
}

function signedCount(value: number, label: string) {
  if (value === 0) return `0 ${label}s`;
  const suffix = Math.abs(value) === 1 ? label : `${label}s`;
  return `${value > 0 ? "+" : ""}${value} ${suffix}`;
}

function conflictKey(conflict: FileConflict) {
  return `${conflict.path}:${conflict.remoteUpdatedAt}:${conflict.remoteDeleted ? "deleted" : "changed"}`;
}
