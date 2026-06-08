import type { RoomPersona } from "../../lib/personas";

export type RoomMode = "read" | "edit";
export type ProposalStatus = "pending" | "accepted" | "rejected";
export type ThreadAnchorType = "text-range" | "insertion-point" | "block" | "document";

export interface Proposal {
  id: string;
  title: string;
  comment: string;
  authorPersonaId: string;
  persona: RoomPersona;
  proposedMarkdown: string;
  createdAt: string;
  status: ProposalStatus;
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  createdAt: string;
  actorPersonaId: string;
  message: string;
  proposalId?: string;
}

export interface ChatComment {
  id: string;
  authorPersonaId: string;
  persona: RoomPersona;
  text: string;
  createdAt: string;
  type: "note" | "question" | "request" | "blocker" | "decision" | "uncertainty";
  anchorType?: ThreadAnchorType;
  selectedQuote?: string;
  createdFromMarkdown?: string;
  beforeContext?: string;
  afterContext?: string;
}
