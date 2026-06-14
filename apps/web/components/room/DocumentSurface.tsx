"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, Bot, Check, ListChecks, MessageSquare, MessageSquarePlus, Pencil, Send, X } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";
import MarkdownSourceEditor from "../MarkdownSourceEditor";
import { extractMarkdownProperties } from "../../lib/markdown-properties";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { CommentConversation, type CommentReplyTarget } from "./CommentConversation";
import type { ChatComment, Proposal, RoomMode } from "./types";

interface DocumentSurfaceProps {
  mode: RoomMode;
  markdown: string;
  currentFilePath: string;
  projectFilePaths: string[];
  onMarkdownChange: (markdown: string) => void;
  onMarkdownCommit?: (markdown: string) => void;
  onProjectFileLinkClick?: (path: string) => void;
  selectedQuote: string;
  onSelectedQuoteChange: (quote: string) => void;
  selectedInsertionOffset: number | null;
  onSelectedInsertionOffsetChange: (offset: number | null) => void;
  comments: ChatComment[];
  proposals: Proposal[];
  activeProposalId?: string | null;
  onOpenProposal: (proposal: Proposal) => void;
  onResolveComment?: (comment: ChatComment, resolved: boolean) => void;
  onReplyToComment?: (comment: ChatComment, text: string, target?: CommentReplyTarget) => void;
  onStartEditing?: () => void;
  newCommentText: string;
  isPostingComment?: boolean;
  composerFocusToken: number;
  onNewCommentTextChange: (value: string) => void;
  onPostComment: (event?: React.SyntheticEvent, type?: ChatComment["type"]) => void;
}

export function DocumentSurface({
  mode,
  markdown,
  currentFilePath,
  projectFilePaths,
  onMarkdownChange,
  onMarkdownCommit,
  onProjectFileLinkClick,
  selectedQuote,
  onSelectedQuoteChange,
  selectedInsertionOffset,
  onSelectedInsertionOffsetChange,
  comments,
  proposals,
  activeProposalId = null,
  onOpenProposal,
  onResolveComment,
  onReplyToComment,
  onStartEditing,
  newCommentText,
  isPostingComment = false,
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
  const [editComposerOpen, setEditComposerOpen] = useState(false);
  const [inlineComposerOpen, setInlineComposerOpen] = useState(false);
  const parsedMarkdown = useMemo(() => extractMarkdownProperties(markdown), [markdown]);
  const activeComments = useMemo(() => comments.filter((comment) => !comment.resolvedAt), [comments]);
  const fileComments = useMemo(
    () => activeComments.filter((comment) => comment.anchorType !== "text-range" || !comment.selectedQuote),
    [activeComments],
  );
  const pendingProposals = useMemo(
    () => proposals.filter((proposal) => proposal.status === "pending"),
    [proposals],
  );
  const detachedComments = useMemo(
    () => activeComments.filter((comment) => isMissingTextAnchor(comment, parsedMarkdown.content)),
    [activeComments, parsedMarkdown.content],
  );
  const detachedProposals = useMemo(
    () => proposals.filter((proposal) => isMissingTextAnchor(proposal, parsedMarkdown.content)),
    [parsedMarkdown.content, proposals],
  );
  const detachedAnchorCount = detachedComments.length + detachedProposals.length;
  const insertionPreview = useMemo(
    () => selectedInsertionOffset === null ? null : createInsertionPreview(markdown, selectedInsertionOffset),
    [markdown, selectedInsertionOffset],
  );
  const activeComment = useMemo(
    () => activeComments.find((comment) => comment.id === activeCommentCard?.commentId) || null,
    [activeComments, activeCommentCard],
  );
  const cancelFileComposer = () => {
    setFileComposerOpen(false);
    onNewCommentTextChange("");
  };
  const clearSelectedAnchor = useCallback(() => {
    onSelectedQuoteChange("");
    onSelectedInsertionOffsetChange(null);
  }, [onSelectedInsertionOffsetChange, onSelectedQuoteChange]);

  useEffect(() => {
    if (mode === "edit") return;
    if (composerFocusToken === 0) return;
    if (selectedQuote && anchorPoint) {
      setFileComposerOpen(false);
      setInlineComposerOpen(true);
      window.requestAnimationFrame(() => composerRef.current?.focus());
      return;
    }
    setFileComposerOpen(true);
    setAnchorPoint(null);
    clearSelectedAnchor();
  }, [anchorPoint, clearSelectedAnchor, composerFocusToken, mode, selectedQuote]);

  useEffect(() => {
    if (mode !== "edit" || composerFocusToken === 0) return;
    setEditComposerOpen(true);
    setFileComposerOpen(false);
    setInlineComposerOpen(false);
    setAnchorPoint(null);
    clearSelectedAnchor();
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }, [clearSelectedAnchor, composerFocusToken, mode]);

  useEffect(() => {
    if (!fileComposerOpen || selectedQuote) return;
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }, [fileComposerOpen, selectedQuote]);

  useEffect(() => {
    if (!selectedQuote || !anchorPoint || !inlineComposerOpen) return;
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }, [inlineComposerOpen, selectedQuote, anchorPoint]);

  useEffect(() => {
    if (!activeCommentCard && !anchorPoint) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveCommentCard(null);
      setAnchorPoint(null);
      setInlineComposerOpen(false);
      clearSelectedAnchor();
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
      setInlineComposerOpen(false);
      setAnchorPoint(null);
      clearSelectedAnchor();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeCommentCard, anchorPoint, clearSelectedAnchor]);

  const captureSelection = (event?: React.SyntheticEvent) => {
    const target = event?.target;
    if (target instanceof HTMLElement && target.closest("[data-comment-composer]")) return;
    if (target instanceof HTMLElement && target.closest("[data-inline-comment-marker]")) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    if (!selection || selectedText.length < 2 || !readSurfaceRef.current) {
      setAnchorPoint(null);
      setInlineComposerOpen(false);
      clearSelectedAnchor();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!readSurfaceRef.current.contains(range.commonAncestorContainer)) return;

    const openInlineComposer = event?.type !== "keyup";
    const rangeRect = range.getBoundingClientRect();
    const surfaceRect = readSurfaceRef.current.getBoundingClientRect();
    onSelectedQuoteChange(expandPartialWordSelection(markdown, selectedText).slice(0, 180));
    onSelectedInsertionOffsetChange(null);
    setActiveCommentCard(null);
    setFileCommentsOpen(false);
    setFileComposerOpen(false);
    setInlineComposerOpen(openInlineComposer);
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
      <section className="mx-auto w-full max-w-[880px] space-y-3">
        {(selectedQuote || selectedInsertionOffset !== null) && !editComposerOpen && (
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={selectedQuote ? "Add comment to source selection" : "Add comment at source cursor"}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-midnight/25 bg-studio-paper px-3 py-2 text-xs text-ink-muted shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-colors hover:border-midnight/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:min-h-9"
              onClick={() => {
                setEditComposerOpen(true);
                window.requestAnimationFrame(() => composerRef.current?.focus());
              }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
              <span className="truncate">{selectedQuote ? "Comment selection" : "Comment cursor"}</span>
            </button>
          </div>
        )}
        {editComposerOpen && (
          <form
            data-comment-composer
            onSubmit={(event) => {
              if (!newCommentText.trim()) {
                event.preventDefault();
                return;
              }
              onPostComment(event);
              setEditComposerOpen(false);
              clearSelectedAnchor();
              onNewCommentTextChange("");
            }}
            className="rounded-md border border-midnight/25 bg-studio-paper p-2 text-ink shadow-[0_10px_28px_rgba(0,0,0,0.14)]"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 px-1 text-xs text-ink-subtle">
                  <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
                  <span>{selectedQuote ? "Selection comment" : selectedInsertionOffset !== null ? "Cursor comment" : "File comment"}</span>
                </div>
                {selectedQuote && (
                  <p className="mt-1 line-clamp-2 border-l border-midnight/35 pl-2 text-xs leading-5 text-ink-muted">
                    {selectedQuote}
                  </p>
                )}
                {!selectedQuote && insertionPreview && (
                  <p className="mt-1 line-clamp-2 border-l border-midnight/35 pl-2 text-xs leading-5 text-ink-muted">
                    {insertionPreview}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cancel comment"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
                onClick={() => {
                  setEditComposerOpen(false);
                  clearSelectedAnchor();
                  onNewCommentTextChange("");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Textarea
              ref={composerRef}
              aria-label={selectedQuote ? "Inline comment" : selectedInsertionOffset !== null ? "Cursor comment" : "File comment"}
              placeholder="Comment"
              rows={2}
              value={newCommentText}
              onChange={(event) => onNewCommentTextChange(event.target.value)}
              required
              className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 md:h-8"
                disabled={!newCommentText.trim() || isPostingComment}
                onClick={(event) => {
                  onPostComment(event, "request");
                  setEditComposerOpen(false);
                  clearSelectedAnchor();
                  onNewCommentTextChange("");
                }}
              >
                <Bot className="h-3.5 w-3.5" />
                Ask
              </Button>
              <Button type="submit" size="sm" className="h-11 md:h-8" disabled={!newCommentText.trim() || isPostingComment}>
                <Send className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </form>
        )}
        <MarkdownSourceEditor
          initialMarkdown={parsedMarkdown.content}
          properties={parsedMarkdown.properties}
          onSelectionQuoteChange={(quote) => onSelectedQuoteChange(quote)}
          onInsertionOffsetChange={(offset) => {
            onSelectedInsertionOffsetChange(offset === null ? null : parsedMarkdown.propertySource.length + offset);
          }}
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
          "shadow-[0_1px_5px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.42)_inset]",
          "selection:bg-midnight-soft selection:text-document-ink sm:px-12 md:pr-28 lg:px-16 lg:pr-28",
        )}
      >
        <div data-file-comment-control className="mb-4 flex items-center justify-end gap-1.5 md:absolute md:right-4 md:top-4 md:z-10 md:mb-0">
          {pendingProposals.length > 0 && (
            <button
              type="button"
              aria-label={
                pendingProposals.length === 1
                  ? "Open pending suggestion"
                  : `Open first of ${pendingProposals.length} pending suggestions`
              }
              title="Pending suggestions"
              className="inline-flex h-11 items-center gap-1 rounded px-2.5 text-[11px] font-medium text-document-subtle transition-colors hover:bg-black/[0.035] hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
              onClick={() => {
                setFileCommentsOpen(false);
                setFileComposerOpen(false);
                setActiveCommentCard(null);
                setAnchorPoint(null);
                setInlineComposerOpen(false);
                clearSelectedAnchor();
                onOpenProposal(pendingProposals[0]);
              }}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>{pendingProposals.length}</span>
            </button>
          )}
          {fileComments.length > 0 && (
            <button
              type="button"
              aria-label={`Open ${fileComments.length} file ${fileComments.length === 1 ? "comment" : "comments"}`}
              title="File comments"
              className="inline-flex h-11 items-center gap-1 rounded px-2.5 text-[11px] font-medium text-document-subtle transition-colors hover:bg-black/[0.035] hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-2"
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
            className="inline-flex h-11 w-11 items-center justify-center rounded text-document-subtle transition-colors hover:bg-black/[0.035] hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:w-8"
            onClick={() => {
              setFileComposerOpen((open) => !open);
              setFileCommentsOpen(false);
              setActiveCommentCard(null);
              setAnchorPoint(null);
              setInlineComposerOpen(false);
              clearSelectedAnchor();
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
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
                onClick={() => setFileCommentsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {fileComments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-studio-line bg-studio-sunken/60 px-2.5 py-2">
                  <div className="mb-1 text-[11px] font-medium text-ink-subtle">
                    {getCommentAnchorLabel(comment)}
                  </div>
                  <CommentConversation comment={comment} onReply={onReplyToComment} compact />
                  {onResolveComment && (
                    <button
                      type="button"
                      aria-label="Resolve file comment"
                      title="Resolve"
                      className="mt-2 inline-flex h-11 items-center gap-1.5 rounded px-2 text-xs text-ink-subtle hover:bg-studio-paper hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-7"
                      onClick={() => onResolveComment(comment, true)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  )}
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
                setFileCommentsOpen(true);
                onNewCommentTextChange("");
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
                  className="inline-flex h-11 items-center gap-1.5 rounded px-2 text-xs text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8"
                  onClick={cancelFileComposer}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!newCommentText.trim() || isPostingComment}
                    onClick={(event) => {
                      onPostComment(event, "request");
                      setFileComposerOpen(false);
                      setFileCommentsOpen(true);
                      onNewCommentTextChange("");
                    }}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Ask
                  </Button>
                  <Button type="submit" size="sm" disabled={!newCommentText.trim() || isPostingComment}>
                    <Send className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
        {markdown.trim() ? (
          <>
            {parsedMarkdown.properties.length > 0 && (
              <div className="mb-8 border-y border-document-edge bg-transparent py-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {parsedMarkdown.properties.map((property, index) => (
                    <span key={`${property.key}:${index}`} className="text-xs leading-5 text-document-subtle">
                      <span className="font-medium text-document-muted">{property.key}</span>
                      <span className="mx-1 text-document-subtle">:</span>
                      <span>{property.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {detachedAnchorCount > 0 && (
              <div
                data-detached-anchor-notice
                className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-midnight/25 bg-midnight-mark px-3 py-2 text-sm text-document-muted"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-midnight-strong" aria-hidden />
                  <span className="truncate">
                    {detachedAnchorCount} {detachedAnchorCount === 1 ? "anchor needs" : "anchors need"} review
                  </span>
                </span>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center rounded px-2 text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                  onClick={() => {
                    const firstComment = detachedComments[0];
                    if (firstComment) {
                      setActiveCommentCard({ commentId: firstComment.id, top: 18, left: 16 });
                      setInlineComposerOpen(false);
                      setAnchorPoint(null);
                      clearSelectedAnchor();
                      return;
                    }
                    const firstProposal = detachedProposals[0];
                    if (firstProposal) onOpenProposal(firstProposal);
                  }}
                >
                  Review
                </button>
              </div>
            )}
            <MarkdownRenderer
              content={parsedMarkdown.content}
              currentFilePath={currentFilePath}
              projectFilePaths={projectFilePaths}
              onProjectFileLinkClick={onProjectFileLinkClick}
              activeTextHighlightId={activeCommentCard ? `comment:${activeCommentCard.commentId}` : activeProposalId ? `proposal:${activeProposalId}` : null}
              textHighlights={[
                ...activeComments
                  .filter((comment) => comment.anchorType === "text-range" && comment.selectedQuote)
                  .map((comment) => ({
                    id: `comment:${comment.id}`,
                    text: comment.selectedQuote!,
                    label: comment.type === "request" ? "agent request" : "comment",
                    kind: comment.type === "request" ? "suggestion" as const : "comment" as const,
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
                clearSelectedAnchor();
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
          <div className="min-h-[560px] pt-16 sm:pt-24">
            {onStartEditing ? (
              <button
                type="button"
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-transparent px-1 text-sm text-document-subtle transition-colors hover:text-document-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:min-h-9"
                onClick={onStartEditing}
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Start writing</span>
              </button>
            ) : (
              <p className="text-sm text-document-subtle">Start writing</p>
            )}
          </div>
        )}
        {activeComment && activeCommentCard && (
          <div
            data-comment-popover
            className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(72dvh,420px)] flex-col overflow-hidden rounded-md border border-midnight/25 bg-studio-paper p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] text-ink shadow-[0_-12px_36px_rgba(0,0,0,0.28)] md:absolute md:inset-x-auto md:bottom-auto md:top-[var(--comment-popover-top)] md:left-[var(--comment-popover-left)] md:z-20 md:block md:w-[min(310px,calc(100%-2rem))] md:max-h-none md:overflow-visible md:pb-2.5 md:shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
            style={overlayPositionStyle("--comment-popover-top", activeCommentCard.top, "--comment-popover-left", activeCommentCard.left)}
          >
            <div className="mb-2 flex shrink-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink">
                {activeComment.type === "request" ? (
                  <Bot className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
                )}
                <span className="truncate">{activeComment.type === "request" ? "Agent request" : "Comment thread"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onResolveComment && (
                  <button
                    type="button"
                    aria-label="Resolve comment"
                    title="Resolve"
                    className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-9 md:w-9"
                    onClick={() => {
                      onResolveComment(activeComment, true);
                      setActiveCommentCard(null);
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close comment"
                  className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-9 md:w-9"
                  onClick={() => setActiveCommentCard(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mb-2 flex shrink-0 items-center gap-1.5 text-[11px] text-ink-subtle">
              {activeComment.type === "request" ? (
                <Bot className="h-3.5 w-3.5 text-midnight-strong" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 text-midnight-strong" />
              )}
              <span className="truncate">{activeComment.selectedQuote || "Document note"}</span>
            </div>
            <CommentConversation comment={activeComment} onReply={onReplyToComment} />
          </div>
        )}
        {selectedQuote && anchorPoint && inlineComposerOpen && (
          <div
            data-inline-comment-composer
            className="fixed inset-x-3 bottom-3 z-50 w-auto pb-[env(safe-area-inset-bottom)] md:absolute md:inset-x-auto md:bottom-auto md:top-[var(--comment-composer-top)] md:left-[var(--comment-composer-left)] md:z-10 md:w-[min(340px,calc(100%-2rem))] md:pb-0"
            style={overlayPositionStyle("--comment-composer-top", anchorPoint.top, "--comment-composer-left", anchorPoint.left)}
          >
            <form
              data-comment-composer
              onSubmit={(event) => {
                onPostComment(event);
                setInlineComposerOpen(false);
                setAnchorPoint(null);
                clearSelectedAnchor();
              }}
              className="rounded-md border border-studio-line bg-studio-paper/95 p-2 text-ink shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur"
            >
              <div className="mb-2 rounded border border-studio-line bg-studio-sunken/70 px-2 py-1.5">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                  <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" aria-hidden />
                  <span>Selection</span>
                </div>
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
                className="min-h-20 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle focus-visible:ring-1"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded px-3 text-xs text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-8 md:px-0"
                  onClick={() => {
                    setAnchorPoint(null);
                    setInlineComposerOpen(false);
                    clearSelectedAnchor();
                  }}
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 px-3 md:h-8"
                    disabled={!newCommentText.trim() || isPostingComment}
                    onClick={(event) => {
                      onPostComment(event, "request");
                      setInlineComposerOpen(false);
                      setAnchorPoint(null);
                      clearSelectedAnchor();
                    }}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Ask
                  </Button>
                  <Button type="submit" size="sm" className="h-11 px-3 md:h-8" disabled={!newCommentText.trim() || isPostingComment}>
                    <Send className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

function overlayPositionStyle(topVar: string, top: number, leftVar: string, left: number) {
  return {
    [topVar]: `${top}px`,
    [leftVar]: `${left}px`,
  } as CSSProperties;
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

function createInsertionPreview(markdown: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(markdown.length, offset));
  const before = markdown.slice(Math.max(0, safeOffset - 80), safeOffset).trim();
  const after = markdown.slice(safeOffset, safeOffset + 80).trim();
  if (before && after) return `${before} | ${after}`;
  return before || after || "Start of file";
}

function isMissingTextAnchor(record: Pick<ChatComment | Proposal, "anchorType" | "selectedQuote">, markdown: string) {
  const quote = record.selectedQuote?.trim();
  if (record.anchorType !== "text-range" || !quote) return false;
  return !normalizeWhitespace(markdown).includes(normalizeWhitespace(quote));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCommentAnchorLabel(comment: ChatComment) {
  if (comment.type === "request") return "Agent request";
  if (comment.anchorType === "insertion-point") return "Insertion point";
  if (comment.anchorType === "block") return "Section";
  if (comment.anchorType === "text-range" && comment.selectedQuote) return "Saved text";
  return "Whole file";
}
