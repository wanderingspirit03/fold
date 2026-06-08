"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, MessageSquare, MessageSquarePlus, Send, X } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";
import MarkdownSourceEditor from "../MarkdownSourceEditor";
import { extractMarkdownProperties } from "../../lib/markdown-properties";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment, Proposal, RoomMode } from "./types";

interface DocumentSurfaceProps {
  mode: RoomMode;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  onMarkdownCommit?: (markdown: string) => void;
  selectedQuote: string;
  onSelectedQuoteChange: (quote: string) => void;
  comments: ChatComment[];
  proposals: Proposal[];
  activeProposalId?: string | null;
  onOpenProposal: (proposal: Proposal) => void;
  newCommentText: string;
  composerFocusToken: number;
  onNewCommentTextChange: (value: string) => void;
  onPostComment: (event?: React.FormEvent) => void;
}

export function DocumentSurface({
  mode,
  markdown,
  onMarkdownChange,
  onMarkdownCommit,
  selectedQuote,
  onSelectedQuoteChange,
  comments,
  proposals,
  activeProposalId = null,
  onOpenProposal,
  newCommentText,
  composerFocusToken,
  onNewCommentTextChange,
  onPostComment,
}: DocumentSurfaceProps) {
  const readSurfaceRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<{ top: number; left: number } | null>(null);
  const [activeCommentCard, setActiveCommentCard] = useState<{
    commentId: string;
    top: number;
    left: number;
  } | null>(null);
  const [fileCommentsOpen, setFileCommentsOpen] = useState(false);
  const [fileComposerOpen, setFileComposerOpen] = useState(false);
  const parsedMarkdown = useMemo(() => extractMarkdownProperties(markdown), [markdown]);
  const fileComments = useMemo(
    () => comments.filter((comment) => comment.anchorType !== "text-range" || !comment.selectedQuote),
    [comments],
  );
  const activeComment = useMemo(
    () => comments.find((comment) => comment.id === activeCommentCard?.commentId) || null,
    [comments, activeCommentCard],
  );

  useEffect(() => {
    if (composerFocusToken === 0) return;
    if (selectedQuote && anchorPoint) {
      setFileComposerOpen(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
      return;
    }
    setFileComposerOpen(true);
    setAnchorPoint(null);
    onSelectedQuoteChange("");
  }, [anchorPoint, composerFocusToken, onSelectedQuoteChange, selectedQuote]);

  useEffect(() => {
    if (!fileComposerOpen || selectedQuote) return;
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }, [fileComposerOpen, selectedQuote]);

  useEffect(() => {
    if (!selectedQuote || !anchorPoint) return;
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }, [selectedQuote, anchorPoint]);

  useEffect(() => {
    if (!activeCommentCard && !anchorPoint) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveCommentCard(null);
      setAnchorPoint(null);
      onSelectedQuoteChange("");
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-comment-popover]")) return;
      if (target.closest("[data-comment-composer]")) return;
      if (target.closest("[data-file-comment-control]")) return;
      if (target.closest("[data-inline-comment-marker]")) return;
      setActiveCommentCard(null);
      setFileCommentsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeCommentCard, anchorPoint, onSelectedQuoteChange]);

  const captureSelection = (event?: React.SyntheticEvent) => {
    const target = event?.target;
    if (target instanceof HTMLElement && target.closest("[data-comment-composer]")) return;
    if (target instanceof HTMLElement && target.closest("[data-inline-comment-marker]")) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    if (!selection || selectedText.length < 2 || !readSurfaceRef.current) {
      setAnchorPoint(null);
      onSelectedQuoteChange("");
      return;
    }

    const range = selection.getRangeAt(0);
    if (!readSurfaceRef.current.contains(range.commonAncestorContainer)) return;

    const rangeRect = range.getBoundingClientRect();
    const surfaceRect = readSurfaceRef.current.getBoundingClientRect();
    onSelectedQuoteChange(expandPartialWordSelection(markdown, selectedText).slice(0, 180));
    setActiveCommentCard(null);
    const preferredLeft = rangeRect.right - surfaceRect.left + 16;
    const maxLeft = Math.max(16, surfaceRect.width - 356);
    setAnchorPoint({
      top: Math.max(20, rangeRect.top - surfaceRect.top - 8),
      left: Math.max(16, Math.min(maxLeft, preferredLeft)),
    });
  };

  if (mode === "edit") {
    const wrapEditedMarkdown = (content: string) => `${parsedMarkdown.propertySource}${content}`;

    return (
      <section className="mx-auto w-full max-w-[880px]">
        {parsedMarkdown.properties.length > 0 && (
          <div className="mb-3 rounded-md border border-studio-line bg-studio-sunken px-3 py-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {parsedMarkdown.properties.map((property) => (
                <span key={property.key} className="text-xs leading-5 text-ink-subtle">
                  <span className="font-medium text-ink-muted">{property.key}</span>
                  <span className="mx-1 text-ink-subtle">:</span>
                  <span>{property.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <MarkdownSourceEditor
          initialMarkdown={parsedMarkdown.content}
          onChange={(content) => onMarkdownChange(wrapEditedMarkdown(content))}
          onCommit={(content) => onMarkdownCommit?.(wrapEditedMarkdown(content))}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[880px]">
      <div
        data-document-surface="true"
        ref={readSurfaceRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className={cn(
          "relative min-h-[520px] rounded-md border border-document-edge bg-document px-6 py-8 text-document-ink sm:min-h-[680px]",
          "shadow-[0_4px_18px_rgba(0,0,0,0.10),0_1px_0_rgba(255,255,255,0.56)_inset]",
          "selection:bg-midnight-soft selection:text-document-ink sm:px-12 lg:px-16",
        )}
      >
        <div data-file-comment-control className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          {fileComments.length > 0 && (
            <button
              type="button"
              aria-label={`Open ${fileComments.length} file ${fileComments.length === 1 ? "comment" : "comments"}`}
              title="File comments"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-document-edge bg-document/90 px-2.5 text-[11px] font-medium text-document-subtle transition-colors hover:border-midnight/35 hover:bg-document hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
              onClick={() => {
                setFileCommentsOpen((open) => !open);
                setFileComposerOpen(false);
                setActiveCommentCard(null);
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{fileComments.length}</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Add file comment"
            title="Add file comment"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-document-edge bg-document/90 text-document-subtle transition-colors hover:border-midnight/35 hover:bg-document hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
            onClick={() => {
              setFileComposerOpen((open) => !open);
              setFileCommentsOpen(false);
              setActiveCommentCard(null);
              setAnchorPoint(null);
              onSelectedQuoteChange("");
            }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </button>
        </div>
        {fileCommentsOpen && fileComments.length > 0 && (
          <div
            data-comment-popover
            className="mb-6 ml-auto w-[min(340px,100%)] rounded-md border border-midnight/25 bg-studio-paper p-2.5 text-ink shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <MessageSquare className="h-3.5 w-3.5 text-midnight-strong" />
                <span>File comments</span>
              </div>
              <button
                type="button"
                aria-label="Close file comments"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                onClick={() => setFileCommentsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {fileComments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-studio-line bg-studio-sunken/60 px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-ink">{comment.persona?.name || "Comment"}</p>
                    <p className="shrink-0 font-mono text-[11px] text-ink-subtle">{formatTime(comment.createdAt)}</p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {fileComposerOpen && !selectedQuote && (
          <div className="mb-6 ml-auto w-[min(340px,100%)]">
            <form
              data-comment-composer
              onSubmit={(event) => {
                if (!newCommentText.trim()) {
                  event.preventDefault();
                  return;
                }
                onPostComment(event);
                setFileComposerOpen(false);
              }}
              className="rounded-md border border-midnight/25 bg-studio-paper p-2 text-ink shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
                <p className="text-xs text-ink-subtle">File comment</p>
              </div>
              <Textarea
                ref={composerRef}
                aria-label="File comment"
                placeholder="Comment"
                rows={2}
                value={newCommentText}
                onChange={(event) => onNewCommentTextChange(event.target.value)}
                required
                className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                  onClick={() => setFileComposerOpen(false)}
                >
                  Cancel
                </button>
                <Button type="submit" size="sm">
                  <Send className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </form>
          </div>
        )}
        {markdown.trim() ? (
          <>
            {parsedMarkdown.properties.length > 0 && (
              <div className="mb-8 rounded-md border border-document-edge bg-black/[0.025] px-3 py-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {parsedMarkdown.properties.map((property) => (
                    <span key={property.key} className="text-xs leading-5 text-document-subtle">
                      <span className="font-medium text-document-muted">{property.key}</span>
                      <span className="mx-1 text-document-subtle">:</span>
                      <span>{property.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <MarkdownRenderer
              content={parsedMarkdown.content}
              activeTextHighlightId={activeCommentCard ? `comment:${activeCommentCard.commentId}` : activeProposalId ? `proposal:${activeProposalId}` : null}
              textHighlights={[
                ...comments
                  .filter((comment) => comment.anchorType === "text-range" && comment.selectedQuote)
                  .map((comment) => ({
                    id: `comment:${comment.id}`,
                    text: comment.selectedQuote!,
                    label: "comment",
                    kind: "comment" as const,
                    before: comment.beforeContext,
                    after: comment.afterContext,
                  })),
                ...proposals
                  .filter((proposal) => proposal.anchorType === "text-range" && proposal.selectedQuote)
                  .map((proposal) => ({
                    id: `proposal:${proposal.id}`,
                    text: proposal.selectedQuote!,
                    label: proposal.status === "pending" ? "suggestion" : `${proposal.status} suggestion`,
                    kind: "suggestion" as const,
                    status: proposal.status,
                    before: proposal.beforeContext,
                    after: proposal.afterContext,
                  })),
              ]}
              onTextHighlightClick={(commentId, event) => {
                if (!readSurfaceRef.current) return;
                const buttonRect = event.currentTarget.getBoundingClientRect();
                const surfaceRect = readSurfaceRef.current.getBoundingClientRect();
                const maxLeft = Math.max(16, surfaceRect.width - 320);
                onSelectedQuoteChange("");
                setAnchorPoint(null);
                if (commentId.startsWith("proposal:")) {
                  const proposal = proposals.find((item) => item.id === commentId.slice("proposal:".length));
                  if (proposal) {
                    setActiveCommentCard(null);
                    onOpenProposal(proposal);
                  }
                  return;
                }
                const id = commentId.startsWith("comment:") ? commentId.slice("comment:".length) : commentId;
                setActiveCommentCard({
                  commentId: id,
                  top: Math.max(18, buttonRect.bottom - surfaceRect.top + 8),
                  left: Math.max(16, Math.min(maxLeft, buttonRect.left - surfaceRect.left - 16)),
                });
              }}
            />
          </>
        ) : (
          <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-document-edge bg-black/[0.03] text-document-subtle">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-document-ink">Empty Markdown document</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-document-muted">
              Switch to edit mode to write the first encrypted project draft.
            </p>
          </div>
        )}
        {activeComment && activeCommentCard && (
          <div
            data-comment-popover
            className="absolute z-20 w-[min(310px,calc(100%-2rem))] rounded-md border border-midnight/25 bg-studio-paper p-2.5 text-ink shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
            style={{ top: activeCommentCard.top, left: activeCommentCard.left }}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {activeComment.persona ? (
                  <PersonaChip persona={activeComment.persona} compact />
                ) : (
                  <p className="truncate text-xs font-medium text-ink">Comment</p>
                )}
                <p className="shrink-0 font-mono text-[11px] text-ink-subtle">{formatTime(activeComment.createdAt)}</p>
              </div>
              <button
                type="button"
                aria-label="Close comment"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                onClick={() => setActiveCommentCard(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <MessageSquare className="h-3.5 w-3.5 text-midnight-strong" />
              <span className="truncate">{activeComment.selectedQuote || "Document note"}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{activeComment.text}</p>
          </div>
        )}
        {selectedQuote && anchorPoint && (
          <div
            className="absolute z-10 w-[min(340px,calc(100%-2rem))]"
            style={{ top: anchorPoint.top, left: anchorPoint.left }}
          >
            <form
              data-comment-composer
              onSubmit={onPostComment}
              className="rounded-md border border-midnight/30 bg-studio-paper p-2 text-ink shadow-[0_16px_42px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-2 flex items-start gap-2 px-1">
                <MessageSquarePlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
                <p className="line-clamp-2 text-xs leading-5 text-ink-subtle">"{selectedQuote}"</p>
              </div>
              <Textarea
                ref={composerRef}
                aria-label="Inline comment"
                placeholder="Comment"
                rows={2}
                value={newCommentText}
                onChange={(event) => onNewCommentTextChange(event.target.value)}
                required
                className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-xs text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                  onClick={() => {
                    setAnchorPoint(null);
                    onSelectedQuoteChange("");
                  }}
                >
                  Cancel
                </button>
                <Button type="submit" size="sm">
                  <Send className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

function expandPartialWordSelection(markdown: string, selectedText: string) {
  const quote = selectedText.trim();
  if (!quote || /\s/.test(quote)) return quote;

  const index = markdown.indexOf(quote);
  if (index < 0) return quote;

  let start = index;
  let end = index + quote.length;
  while (start > 0 && /[A-Za-z0-9_-]/.test(markdown[start - 1])) start -= 1;
  while (end < markdown.length && /[A-Za-z0-9_-]/.test(markdown[end])) end += 1;

  return markdown.slice(start, end).trim() || quote;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
