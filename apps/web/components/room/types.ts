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
  createdAt: string;
  status: ProposalStatus;
  filePath?: string;
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
  proposedProject?: {
    schema: "fold.project.v1";
    primaryPath: string;
    files: Array<{ path: string; markdown: string }>;
    updatedAt: string;
  };
}

export interface TimelineEvent {
  id: string;
  type: string;
  createdAt: string;
  actorPersonaId: string;
  message: string;
  proposalId?: string;
  commentId?: string;
  filePath?: string;
}

export interface ChatComment {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  filePath?: string;
  text: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedByPersonaId?: string;
  type: "note";
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
}

export interface CollaborationPresence {
  schema: "fold.presence.v1";
  clientId: string;
  authorPersonaId: string;
  persona: RoomPersona;
  filePath: string;
  mode: RoomMode;
  status: "viewing" | "editing";
  activity?: "idle" | "typing" | "commenting";
  updatedAt: string;
  expiresAt: string;
}
