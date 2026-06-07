import type { MarkdownDocumentSummary } from '../rooms/markdown-snapshot.js';
import type { ProposalStatus, ProposalView } from '../rooms/proposals.js';
import type { TimelineEvent } from '../rooms/timeline.js';

export interface PublicRoomResult {
  roomId: string;
  serverUrl: string;
  serverRoomUrl: string;
  url: string;
  token: string;
  hasClientKey: true;
}

export interface MetadataResult {
  path: string;
  saved: boolean;
}

export interface PublishResult {
  schema: 'mdroom.publish.result.v1';
  ok: true;
  mode: 'server-backed';
  room: PublicRoomResult;
  metadata: MetadataResult;
  document: MarkdownDocumentSummary;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface ExportResult {
  schema: 'mdroom.export.result.v1';
  ok: true;
  mode: 'server-backed';
  room: PublicRoomResult;
  metadata: {
    path: string;
    found: boolean;
  };
  output: {
    path: string | null;
    written: boolean;
    bytes: number;
    sha256: string;
  };
  document: MarkdownDocumentSummary & {
    markdown: string;
  };
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface StatusResult {
  schema: 'mdroom.status.result.v1';
  ok: true;
  mode: 'server-backed';
  room: PublicRoomResult;
  metadata: {
    path: string;
    found: boolean;
    sourcePath: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  document: MarkdownDocumentSummary | null;
  server: {
    checked: true;
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface PatchResult {
  schema: 'mdroom.patch.result.v1';
  ok: true;
  mode: 'suggestion';
  room: PublicRoomResult;
  metadata: {
    path: string;
    found: boolean;
  };
  base: MarkdownDocumentSummary;
  proposed: MarkdownDocumentSummary;
  suggestion: {
    id: string;
    kind: 'whole-document-replacement';
    baseSha256: string;
    proposedSha256: string;
  };
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface ProposeResult {
  schema: 'mdroom.propose.result.v1';
  ok: true;
  mode: 'proposal';
  room: PublicRoomResult;
  metadata: {
    path: string;
    found: boolean;
  };
  base: MarkdownDocumentSummary;
  proposed: MarkdownDocumentSummary;
  proposal: ProposalView;
  timeline: TimelineEvent;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface ProposalsResult {
  schema: 'mdroom.proposals.result.v1';
  ok: true;
  mode: 'proposal-list';
  room: PublicRoomResult;
  proposals: ProposalListItem[];
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface ProposalListItem {
  id: string;
  title: string;
  comment: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  persona: ProposalView['persona'];
  base: MarkdownDocumentSummary;
  proposed: MarkdownDocumentSummary;
}

export interface ShowProposalResult {
  schema: 'mdroom.show-proposal.result.v1';
  ok: true;
  mode: 'proposal';
  room: PublicRoomResult;
  proposal: ProposalView;
  timeline: TimelineEvent[];
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface DecideProposalResult {
  schema: 'mdroom.accept.result.v1' | 'mdroom.reject.result.v1';
  ok: true;
  mode: 'proposal-decision';
  room: PublicRoomResult;
  proposal: ProposalView;
  status: 'accepted' | 'rejected';
  document: MarkdownDocumentSummary | null;
  timeline: TimelineEvent;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}
