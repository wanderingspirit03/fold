"use client";

import { Reply, Send, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment } from "./types";

interface CommentConversationProps {
  comment: ChatComment;
  onReply?: (comment: ChatComment, text: string, target?: CommentReplyTarget) => void;
  compact?: boolean;
}

export interface CommentReplyTarget {
  id: string;
  authorPersonaId: string;
  authorName: string;
  text: string;
}

export function CommentConversation({ comment, onReply, compact = false }: CommentConversationProps) {
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null);
  const replies = [...(comment.replies || [])].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const canReply = Boolean(onReply && !comment.resolvedAt);
  const rootTarget = {
    id: comment.id,
    authorPersonaId: comment.authorPersonaId,
    authorName: comment.persona?.name || "Comment",
    text: comment.text,
  };

  return (
    <div className={cn("min-h-0 space-y-2.5", compact && "space-y-2")}>
      <div
        className={cn(
          "space-y-2 border-l border-studio-line/80 pl-2.5",
          !compact && "max-h-[min(24dvh,180px)] overflow-y-auto pr-1 md:max-h-[min(40dvh,260px)]",
        )}
      >
        <ThreadMessage
          author={comment.persona?.name || "Comment"}
          persona={comment.persona}
          createdAt={comment.createdAt}
          text={comment.text}
          compact={compact}
          replyTarget={rootTarget}
          canReply={canReply}
          onReplyTarget={setReplyTarget}
        />
        {replies.map((reply) => (
          <ThreadMessage
            key={reply.id}
            author={reply.persona?.name || "Reply"}
            persona={reply.persona}
            createdAt={reply.createdAt}
            text={reply.text}
            parentAuthorName={reply.parentAuthorName}
            parentText={reply.parentText}
            compact={compact}
            replyTarget={{
              id: reply.id,
              authorPersonaId: reply.authorPersonaId,
              authorName: reply.persona?.name || "Reply",
              text: reply.text,
            }}
            canReply={canReply}
            onReplyTarget={setReplyTarget}
          />
        ))}
      </div>
      {canReply && (
        <form
          className="shrink-0 pt-0.5"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onReply?.(comment, text, replyTarget || undefined);
            setDraft("");
            setReplyTarget(null);
          }}
        >
          {replyTarget && (
            <div
              data-comment-reply-target
              className="mb-2 rounded bg-studio-sunken/70 px-2 py-1.5 text-[11px] text-ink-subtle"
            >
              <div className="flex min-h-7 items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Reply className="h-3 w-3 shrink-0 text-midnight-strong" aria-hidden />
                  <span className="truncate">to {replyTarget.authorName}</span>
                </span>
                <button
                  type="button"
                  aria-label="Clear reply target"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-7 md:w-7"
                  onClick={() => setReplyTarget(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="line-clamp-2 border-l border-midnight/35 pl-2 text-xs leading-5 text-ink-muted">
                {replyTarget.text}
              </p>
            </div>
          )}
          <Textarea
            aria-label="Reply to comment"
            placeholder="Reply"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-10 resize-none border-studio-line bg-studio-sunken text-sm text-ink placeholder:text-ink-subtle focus-visible:ring-1"
          />
          <div className="mt-1.5 flex justify-end">
            <Button type="submit" size="sm" disabled={!draft.trim()} className="h-11 px-3 md:h-8">
              <Send className="h-3.5 w-3.5" />
              Reply
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ThreadMessage({
  author,
  persona,
  createdAt,
  text,
  parentAuthorName,
  parentText,
  compact,
  replyTarget,
  canReply,
  onReplyTarget,
}: {
  author: string;
  persona?: ChatComment["persona"];
  createdAt: string;
  text: string;
  parentAuthorName?: string;
  parentText?: string;
  compact: boolean;
  replyTarget: CommentReplyTarget;
  canReply: boolean;
  onReplyTarget: (target: CommentReplyTarget) => void;
}) {
  return (
    <div className="group/message space-y-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <PersonaChip persona={persona} compact className="min-w-0" />
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[11px] text-ink-subtle">{formatTime(createdAt)}</span>
          {canReply && (
            <button
              type="button"
              aria-label={`Reply to ${author}`}
              title={`Reply to ${author}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-subtle opacity-100 transition-colors hover:bg-studio-sunken hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-7 md:w-7 md:opacity-0 md:group-hover/message:opacity-100 md:focus-visible:opacity-100"
              onClick={() => onReplyTarget(replyTarget)}
            >
              <Reply className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {parentAuthorName && (
        <div data-comment-parent-preview className="border-l border-midnight/30 pl-2 text-[11px] leading-4 text-ink-subtle">
          <p className="font-medium text-ink-subtle">to {parentAuthorName}</p>
          {parentText ? <p className="mt-0.5 line-clamp-2 text-ink-muted">{parentText}</p> : null}
        </div>
      )}
      <p className={cn("whitespace-pre-wrap text-sm text-ink-muted", compact ? "leading-5" : "leading-6")}>{text}</p>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
