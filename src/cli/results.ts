import type { MarkdownDocumentSummary } from '../rooms/markdown-snapshot.js';
import type { ProjectSummary } from '../rooms/project-state.js';
import type { RoomComment } from '../rooms/comments.js';
import type { ProposalStatus, ProposalView } from '../rooms/proposals.js';
import type { TimelineEvent } from '../rooms/timeline.js';

export interface PublicRoomResult {
  roomId: string;
  alias: string | null;
  appUrl: string;
  syncUrl: string;
  serverUrl: string;
  serverRoomUrl: string;
  url: string;
  token: string;
  hasClientKey: boolean;
}

export interface SafeRoomResult {
  roomId: string;
  alias: string | null;
  appUrl: string;
  syncUrl: string;
  serverUrl: string;
  serverRoomUrl: string;
  hasClientKey: boolean;
}

export interface MetadataResult {
  path: string;
  saved: boolean;
}

export interface PublishResult {
  schema: 'fold.publish.result.v1';
  ok: true;
  mode: 'server-backed';
  room: PublicRoomResult;
  metadata: MetadataResult;
  document: MarkdownDocumentSummary;
  project: ProjectSummary;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface ExportResult {
  schema: 'fold.export.result.v1';
  ok: true;
  mode: 'server-backed';
  room: SafeRoomResult;
  metadata: {
    path: string;
    found: boolean;
  };
  output: {
    path: string | null;
    written: boolean;
    bytes: number;
    sha256: string;
    paths?: string[];
  };
  document: MarkdownDocumentSummary & {
    markdown: string;
  };
  project: ProjectSummary;
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface StatusResult {
  schema: 'fold.status.result.v1';
  ok: true;
  mode: 'server-backed';
  room: SafeRoomResult;
  metadata: {
    path: string;
    found: boolean;
    sourcePath: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  document: MarkdownDocumentSummary | null;
  project: ProjectSummary | null;
  server: {
    checked: true;
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface ContextResult {
  schema: 'fold.context.result.v1';
  ok: true;
  mode: 'agent-context';
  room: SafeRoomResult;
  document: MarkdownDocumentSummary;
  project: ProjectSummary;
  files: Array<{ path: string; markdown: string; bytes: number; sha256: string }>;
  comments: {
    unresolved: RoomComment[];
  };
  proposals: {
    pending: ProposalListItem[];
    accepted: ProposalListItem[];
    rejected: ProposalListItem[];
  };
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface ResumeResult {
  schema: 'fold.resume.result.v1';
  ok: true;
  mode: 'agent-resume';
  room: SafeRoomResult;
  metadata: {
    path: string;
    alias: string;
    imported: boolean;
  };
  skill: {
    url: string;
    install: {
      required: false;
      repeatAgents: string;
      ghSkill: string;
      skillsSh: string;
    };
  };
  status: StatusResult;
  export: ExportResult | null;
  context: ContextResult;
  requests: CommentsResult;
  comments: CommentsResult;
  proposals: ProposalsResult;
  nextCommands: {
    propose: string | null;
    requests: string;
    comments: string;
    proposals: string;
    reply: string;
    context: string;
  };
}

export interface PatchResult {
  schema: 'fold.patch.result.v1';
  ok: true;
  mode: 'suggestion';
  room: SafeRoomResult;
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
  schema: 'fold.propose.result.v1';
  ok: true;
  mode: 'proposal';
  room: SafeRoomResult;
  metadata: {
    path: string;
    found: boolean;
  };
  base: MarkdownDocumentSummary;
  proposed: MarkdownDocumentSummary;
  project: {
    base: ProjectSummary;
    proposed: ProjectSummary;
  };
  proposal: ProposalSummaryResult;
  timeline: TimelineEvent;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface ProposalsResult {
  schema: 'fold.proposals.result.v1';
  ok: true;
  mode: 'proposal-list';
  room: SafeRoomResult;
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

export interface ProposalSummaryResult {
  id: string;
  kind: ProposalView['kind'];
  title: string;
  comment: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  persona: ProposalView['persona'];
  base: MarkdownDocumentSummary;
  proposed: MarkdownDocumentSummary;
  path?: string;
  project?: ProjectSummary;
}

export interface ShowProposalResult {
  schema: 'fold.show-proposal.result.v1';
  ok: true;
  mode: 'proposal';
  room: SafeRoomResult;
  proposal: ProposalView;
  timeline: TimelineEvent[];
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface DecideProposalResult {
  schema: 'fold.accept.result.v1' | 'fold.reject.result.v1';
  ok: true;
  mode: 'proposal-decision';
  room: SafeRoomResult;
  proposal: ProposalSummaryResult;
  status: 'accepted' | 'rejected';
  document: MarkdownDocumentSummary | null;
  project: ProjectSummary | null;
  timeline: TimelineEvent;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface RoomProfileResult {
  schema: 'fold.room.add.result.v1' | 'fold.room.show.result.v1' | 'fold.room.set-url.result.v1';
  ok: true;
  room: PublicRoomResult;
  metadata: {
    path: string;
    alias: string;
  };
}

export interface RoomCreateResult {
  schema: 'fold.room.create.result.v1';
  ok: true;
  mode: 'server-backed';
  room: PublicRoomResult;
  metadata: {
    path: string;
    alias: string;
    saved: true;
  };
  document: MarkdownDocumentSummary;
  project: ProjectSummary;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}

export interface RoomListResult {
  schema: 'fold.room.list.result.v1';
  ok: true;
  metadata: {
    path: string;
  };
  rooms: SafeRoomResult[];
}

export interface RoomForgetResult {
  schema: 'fold.room.forget.result.v1';
  ok: true;
  metadata: {
    path: string;
    alias: string;
  };
}

export interface RoomInviteResult {
  schema: 'fold.room.invite.result.v1';
  ok: true;
  audience: 'human' | 'agent';
  room: PublicRoomResult | SafeRoomResult;
  warnings: string[];
  invite: {
    text: string;
    skillUrl: string | null;
  };
}

export interface CommentsResult {
  schema: 'fold.comments.result.v1';
  ok: true;
  mode: 'comment-list';
  room: SafeRoomResult;
  filters: {
    type: 'all' | 'comment' | 'request';
    open: boolean;
    path: string | null;
  };
  comments: RoomComment[];
  server: {
    recordCount: number;
    latestSeq: number | null;
  };
}

export interface CommentResult {
  schema: 'fold.comment.result.v1' | 'fold.reply.result.v1';
  ok: true;
  mode: 'comment';
  room: SafeRoomResult;
  comment: RoomComment;
  server: {
    recordCount: number;
    latestSeq: number;
  };
}
