"use client";

import { Send, X } from "lucide-react";
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
  };

  return (
    <div className={cn("space-y-2.5", compact && "space-y-2")}>
      <div className="space-y-2 border-l border-studio-line/80 pl-2.5">
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
            compact={compact}
            replyTarget={{
              id: reply.id,
              authorPersonaId: reply.authorPersonaId,
              authorName: reply.persona?.name || "Reply",
            }}
            canReply={canReply}
            onReplyTarget={setReplyTarget}
          />
        ))}
      </div>
      {canReply && (
        <form
          className="pt-0.5"
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
            <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2 rounded bg-studio-sunken/70 px-2 text-[11px] text-ink-subtle">
              <span className="truncate">Replying to {replyTarget.authorName}</span>
              <button
                type="button"
                aria-label="Clear reply target"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-7 md:w-7"
                onClick={() => setReplyTarget(null)}
              >
                <X className="h-3 w-3" />
              </button>
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
              className="inline-flex h-11 items-center rounded px-2 text-[11px] text-ink-subtle opacity-100 transition-colors hover:bg-studio-sunken hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-auto md:px-1.5 md:py-0.5 md:opacity-0 md:group-hover/message:opacity-100 md:focus-visible:opacity-100"
              onClick={() => onReplyTarget(replyTarget)}
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {parentAuthorName && (
        <p className="text-[11px] leading-4 text-ink-subtle">to {parentAuthorName}</p>
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
