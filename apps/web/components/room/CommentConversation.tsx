"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { PersonaChip } from "./PersonaChip";
import type { ChatComment } from "./types";

interface CommentConversationProps {
  comment: ChatComment;
  onReply?: (comment: ChatComment, text: string) => void;
  compact?: boolean;
}

export function CommentConversation({ comment, onReply, compact = false }: CommentConversationProps) {
  const [draft, setDraft] = useState("");
  const replies = [...(comment.replies || [])].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const canReply = Boolean(onReply && !comment.resolvedAt);

  return (
    <div className="space-y-2">
      <p className={cn("whitespace-pre-wrap text-sm text-ink-muted", compact ? "leading-5" : "leading-6")}>{comment.text}</p>
      {replies.length > 0 && (
        <div className="space-y-2 border-l border-studio-line pl-2.5">
          {replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <PersonaChip persona={reply.persona} compact className="min-w-0" />
                <span className="shrink-0 font-mono text-[11px] text-ink-subtle">{formatTime(reply.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-5 text-ink-muted">{reply.text}</p>
            </div>
          ))}
        </div>
      )}
      {canReply && (
        <form
          className="pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onReply?.(comment, text);
            setDraft("");
          }}
        >
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
