import { randomUUID } from 'node:crypto';
import type { EncryptedUpdateRecord, IncomingEncryptedUpdate } from '../server/append-log.js';
import type { RoomPersona } from './personas.js';
import type { RoomAccess } from './room-reference.js';
import { decryptJsonRecord, encryptJsonRecord } from './timeline.js';

export const COMMENT_EVENT_SENDER_ID_PREFIX = 'web-client:comment-event';
export const COMMENT_SENDER_ID_PREFIX = 'web-client:comment';
export const CLI_COMMENT_EVENT_SENDER_ID_PREFIX = 'fold-cli:comment-event';
export const CLI_COMMENT_SENDER_ID_PREFIX = 'fold-cli:comment';

export type ThreadAnchorType = 'text-range' | 'insertion-point' | 'block' | 'document';

export interface CommentReply {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  text: string;
  createdAt: string;
  parentId?: string;
  parentAuthorPersonaId?: string;
  parentAuthorName?: string;
}

export interface RoomComment {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  filePath?: string;
  text: string;
  replies?: CommentReply[];
  createdAt: string;
  resolvedAt?: string;
  resolvedByPersonaId?: string;
  type: 'note';
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
}

export interface CommentEvent {
  id: string;
  type: 'comment_replied' | 'comment_resolved' | 'comment_reopened';
  createdAt: string;
  actorPersonaId: string;
  message: string;
  commentId: string;
  filePath?: string;
  reply?: CommentReply;
}

export async function createEncryptedCommentRecord(
  access: RoomAccess,
  comment: RoomComment,
): Promise<IncomingEncryptedUpdate> {
  return encryptJsonRecord(access, `${CLI_COMMENT_SENDER_ID_PREFIX}:${comment.id}`, comment);
}

export async function createEncryptedCommentEvent(
  access: RoomAccess,
  event: CommentEvent,
): Promise<IncomingEncryptedUpdate> {
  return encryptJsonRecord(access, `${CLI_COMMENT_EVENT_SENDER_ID_PREFIX}:${event.id}`, event);
}

export function createComment(input: {
  persona: RoomPersona;
  text: string;
  markdown: string;
  filePath: string;
  selectedQuote?: string;
}): RoomComment {
  return {
    id: randomUUID().slice(0, 12),
    authorPersonaId: input.persona.id,
    persona: input.persona,
    filePath: input.filePath,
    text: input.text,
    createdAt: new Date().toISOString(),
    type: 'note',
    ...createCommentAnchor(input.markdown, input.selectedQuote ?? ''),
  };
}

export function createCommentReplyEvent(input: {
  comment: RoomComment;
  persona: RoomPersona;
  text: string;
}): CommentEvent {
  const createdAt = new Date().toISOString();
  const reply: CommentReply = {
    id: randomUUID().slice(0, 12),
    authorPersonaId: input.persona.id,
    persona: input.persona,
    text: input.text,
    createdAt,
  };
  return {
    id: `ev-comment-reply-${input.comment.id}-${reply.id}`,
    type: 'comment_replied',
    createdAt,
    actorPersonaId: input.persona.id,
    commentId: input.comment.id,
    filePath: input.comment.filePath,
    message: `Replied to comment on ${input.comment.selectedQuote || input.comment.filePath || 'document'}`,
    reply,
  };
}

export async function replayCommentsFromRecords(
  access: RoomAccess,
  records: EncryptedUpdateRecord[],
): Promise<RoomComment[]> {
  let comments: RoomComment[] = [];
  for (const record of records) {
    if (isCommentEventSender(record.senderId)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (isCommentEvent(value)) comments = applyCommentEvent(comments, value);
      continue;
    }
    if (isCommentSender(record.senderId)) {
      const value = await decryptJsonRecord(access, record, record.senderId);
      if (isRoomComment(value)) comments = upsertComment(comments, value);
    }
  }
  return comments.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function upsertComment(comments: RoomComment[], next: RoomComment): RoomComment[] {
  if (comments.some((comment) => comment.id === next.id)) return comments;
  return [{ ...next, replies: sortReplies(next.replies || []) }, ...comments];
}

function applyCommentEvent(comments: RoomComment[], event: CommentEvent): RoomComment[] {
  return comments.map((comment) => {
    if (comment.id !== event.commentId) return comment;
    if (event.type === 'comment_replied' && event.reply) {
      const replies = comment.replies || [];
      if (replies.some((reply) => reply.id === event.reply?.id)) return comment;
      return { ...comment, replies: sortReplies([...replies, event.reply]) };
    }
    if (event.type === 'comment_resolved') {
      return { ...comment, resolvedAt: event.createdAt, resolvedByPersonaId: event.actorPersonaId };
    }
    if (event.type === 'comment_reopened') {
      const { resolvedAt, resolvedByPersonaId, ...reopened } = comment;
      return reopened;
    }
    return comment;
  });
}

function createCommentAnchor(markdown: string, selectedQuote: string): Pick<RoomComment, 'anchorType' | 'selectedQuote' | 'createdFromMarkdown' | 'beforeContext' | 'afterContext'> {
  const quote = selectedQuote.trim();
  if (!quote) return { anchorType: 'document', createdFromMarkdown: markdown.slice(0, 320) };

  const index = markdown.indexOf(quote);
  if (index === -1) {
    return { anchorType: 'text-range', selectedQuote: quote, createdFromMarkdown: markdown.slice(0, 320) };
  }

  return {
    anchorType: 'text-range',
    selectedQuote: quote,
    createdFromMarkdown: markdown.slice(Math.max(0, index - 160), index + quote.length + 160),
    beforeContext: markdown.slice(Math.max(0, index - 120), index),
    afterContext: markdown.slice(index + quote.length, index + quote.length + 120),
  };
}

function sortReplies(replies: CommentReply[]) {
  return [...replies].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function isRoomComment(value: unknown): value is RoomComment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoomComment>;
  return typeof candidate.id === 'string'
    && typeof candidate.authorPersonaId === 'string'
    && candidate.persona?.schema === 'fold.persona.v1'
    && typeof candidate.text === 'string'
    && typeof candidate.createdAt === 'string'
    && candidate.type === 'note';
}

function isCommentSender(senderId: string) {
  return senderId.startsWith(COMMENT_SENDER_ID_PREFIX) || senderId.startsWith(CLI_COMMENT_SENDER_ID_PREFIX);
}

function isCommentEventSender(senderId: string) {
  return senderId.startsWith(COMMENT_EVENT_SENDER_ID_PREFIX) || senderId.startsWith(CLI_COMMENT_EVENT_SENDER_ID_PREFIX);
}

function isCommentEvent(value: unknown): value is CommentEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommentEvent>;
  return typeof candidate.id === 'string'
    && (candidate.type === 'comment_replied' || candidate.type === 'comment_resolved' || candidate.type === 'comment_reopened')
    && typeof candidate.createdAt === 'string'
    && typeof candidate.actorPersonaId === 'string'
    && typeof candidate.commentId === 'string'
    && typeof candidate.message === 'string';
}
