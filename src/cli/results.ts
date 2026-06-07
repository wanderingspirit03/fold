import type { MarkdownDocumentSummary } from '../rooms/markdown-snapshot.js';

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
  mode: 'local-token';
  room: PublicRoomResult;
  metadata: MetadataResult;
  document: MarkdownDocumentSummary;
  todo: string[];
}

export interface ExportResult {
  schema: 'mdroom.export.result.v1';
  ok: true;
  mode: 'local-token';
  room: PublicRoomResult;
  metadata: {
    path: string;
    found: true;
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
  todo: string[];
}

export interface StatusResult {
  schema: 'mdroom.status.result.v1';
  ok: true;
  mode: 'local-token';
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
    checked: false;
    reason: string;
  };
  todo: string[];
}
