import type { RoomPersona } from "../../lib/personas";

export type RoomMode = "read" | "edit";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type ThreadAnchorType = "text-range" | "insertion-point" | "block" | "document";

export interface Proposal {
  id: string;
  kind?: "whole-document-replacement" | "file-replacement" | "project-replacement";
  title: string;
  comment: string;
  authorPersonaId: string;
  persona: RoomPersona;
  proposedMarkdown: string;
  proposedSha256?: string;
  createdAt: string;
  status: ProposalStatus;
  filePath?: string;
  targetPaths?: string[];
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  diff?: string;
  beforeContext?: string;
  afterContext?: string;
  replies?: ChatCommentReply[];
  proposedProject?: {
    schema: "fold.project.v1";
    primaryPath: string;
    files: Array<{ path: string; markdown: string }>;
    updatedAt: string;
  };
}

export interface TimelineEvent {
  schema?: "fold.timeline-event.v1";
  id: string;
  type: string;
  createdAt: string;
  actorPersonaId: string;
  message: string;
  proposalId?: string;
  documentSha256?: string | null;
  commentId?: string;
  filePath?: string;
  reply?: ChatCommentReply;
  acceptedProject?: Proposal["proposedProject"];
}

export interface ChatCommentReply {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  text: string;
  createdAt: string;
  parentId?: string;
  parentAuthorPersonaId?: string;
  parentAuthorName?: string;
  parentText?: string;
}

export interface ChatComment {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  filePath?: string;
  text: string;
  replies?: ChatCommentReply[];
  createdAt: string;
  resolvedAt?: string;
  resolvedByPersonaId?: string;
  type: "note" | "request";
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
}

export interface FileVersion {
  schema: "fold.file_version.v1";
  id: string;
  title: string;
  filePath: string;
  markdown: string;
  createdAt: string;
  authorPersonaId: string;
  persona: RoomPersona;
}

export interface FileConflict {
  path: string;
  localMarkdown: string;
  localUpdatedAt?: string;
  remoteMarkdown: string;
  remoteDeleted?: boolean;
  remoteUpdatedAt: string;
  persona?: RoomPersona;
  createdAt: string;
}

export interface CollaborationPresence {
  schema: "fold.presence.v1";
  clientId: string;
  authorPersonaId: string;
  persona: RoomPersona;
  filePath: string;
  mode: RoomMode;
  status: "viewing" | "editing" | "left";
  activity?: "idle" | "typing" | "commenting";
  updatedAt: string;
  expiresAt: string;
}
