"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import { AgentBench } from "../../../components/room/AgentBench";
import { DocumentSurface } from "../../../components/room/DocumentSurface";
import { RoomAccessGate } from "../../../components/room/RoomAccessGate";
import { RoomShell } from "../../../components/room/RoomShell";
import { ThreadReviewDialog } from "../../../components/room/ThreadReviewDialog";
import type { ChatComment, Proposal, TimelineEvent } from "../../../components/room/types";
import {
  deriveRoomKey,
  decryptUpdate,
  encryptUpdate,
  EncryptedPayload,
} from "../../../lib/crypto";
import { assignWebPersona, type RoomPersona } from "../../../lib/personas";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DOCUMENT_SENDER_ID = "fold-cli:document";
const PROJECT_SCHEMA = "fold.project.v1";
const PROJECT_SENDER_ID = "fold-cli:project";
const LIVE_FILE_PATH = "reports/launch-review.md";
const DEFAULT_PROJECT_FILE_PATH = "docs/PLAN.md";

interface ProjectFileSnapshot {
  type: "project_file_snapshot";
  path: string;
  markdown: string;
  updatedAt: string;
  authorPersonaId: string;
  persona: RoomPersona;
}

interface ProjectSnapshot {
  schema: typeof PROJECT_SCHEMA;
  primaryPath: string;
  files: Array<{ path: string; markdown: string }>;
  updatedAt: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId as string;

  const [roomSecret, setRoomSecret] = useState("");
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8787");
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [clientId] = useState(() => `web-client-${Math.random().toString(36).slice(2, 11)}`);

  const [markdown, setMarkdown] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState(DEFAULT_PROJECT_FILE_PATH);
  const [virtualFiles, setVirtualFiles] = useState<Record<string, string>>(() => createInitialVirtualFiles());
  const [projectFileUpdatedAt, setProjectFileUpdatedAt] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState<"read" | "edit">("read");
  const [hasLoadedPreferredFile, setHasLoadedPreferredFile] = useState(false);
  const [pendingPreferredFilePath, setPendingPreferredFilePath] = useState("");
  const [localMyPersona, setLocalMyPersona] = useState<RoomPersona | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [syncProgress, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [logRecords, setLogRecords] = useState<any[]>([]);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [comments, setComments] = useState<ChatComment[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const [newCommentText, setNewCommentText] = useState("");
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [selectedQuote, setSelectedQuote] = useState("");

  const yDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const expectedSeqRef = useRef(1);
  const keyRef = useRef<CryptoKey | null>(null);
  const fileSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const virtualFilesRef = useRef(virtualFiles);

  useEffect(() => {
    const hash = window.location.hash;
    const match = /#key=([a-zA-Z0-9_-]+)/.exec(hash);
    if (match?.[1]) {
      setRoomSecret(match[1]);
      setIsKeyConfigured(true);
    }
  }, []);

  useEffect(() => {
    if (!roomId || !clientId) return;
    setLocalMyPersona(assignWebPersona({
      roomId,
      participantKind: "human",
      participantFingerprint: clientId,
    }));
  }, [roomId, clientId]);

  useEffect(() => {
    virtualFilesRef.current = virtualFiles;
  }, [virtualFiles]);

  useEffect(() => {
    if (!roomId || hasLoadedPreferredFile) return;
    const knownFiles = createProjectFiles(selectedFilePath, virtualFilesRef.current, {}, [], []);
    let storedPath = "";
    try {
      storedPath = window.localStorage.getItem(lastOpenedFileStorageKey(roomId)) || "";
    } catch {
      storedPath = "";
    }
    const initialFile = chooseInitialProjectFile(storedPath, knownFiles);
    const normalizedStored = storedPath ? normalizeProjectFilePath(storedPath) : "";
    if (normalizedStored && normalizedStored !== initialFile && !knownFiles.some((file) => file.path === normalizedStored)) {
      setPendingPreferredFilePath(normalizedStored);
    }
    setSelectedFilePath(initialFile);
    setHasLoadedPreferredFile(true);
  }, [hasLoadedPreferredFile, roomId, selectedFilePath]);

  useEffect(() => {
    if (!roomId || !hasLoadedPreferredFile || !selectedFilePath) return;
    if (pendingPreferredFilePath && selectedFilePath !== pendingPreferredFilePath) return;
    try {
      window.localStorage.setItem(lastOpenedFileStorageKey(roomId), selectedFilePath);
    } catch {
      // Last-opened file is convenience state; failing to persist should not affect the room.
    }
  }, [hasLoadedPreferredFile, pendingPreferredFilePath, roomId, selectedFilePath]);

  const handleConfigureKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomSecret) return;
    window.location.hash = `key=${roomSecret}`;
    setIsKeyConfigured(true);
  };

  useEffect(() => {
    if (!roomId || !roomSecret || !isKeyConfigured || !serverUrl) return;

    let destroyed = false;
    const yDoc = new Y.Doc();
    const yText = yDoc.getText("markdown");
    yDocRef.current = yDoc;
    yTextRef.current = yText;
    expectedSeqRef.current = 1;

    const setupSync = async () => {
      try {
        setSyncDone(false);
        setSyncError(null);
        setLogRecords([]);
        setProposals([]);
        setTimeline([]);
        setComments([]);
        setProjectFileUpdatedAt({});

        const cryptoKey = await deriveRoomKey(roomId, roomSecret);
        keyRef.current = cryptoKey;

        yText.observe(() => {
          setMarkdown(yText.toString());
        });

        yDoc.on("update", async (update: Uint8Array, origin: unknown) => {
          const socket = socketRef.current;
          if (origin === "remote" || !socket || socket.readyState !== WebSocket.OPEN) return;

          try {
            const encrypted = await encryptUpdate(update, cryptoKey, {
              roomId,
              senderId: DOCUMENT_SENDER_ID,
            });
            socket.send(
              JSON.stringify({
                type: "encrypted-update",
                update: {
                  senderId: DOCUMENT_SENDER_ID,
                  ...encrypted,
                },
              }),
            );
          } catch (err) {
            setSyncError(`Could not send update: ${String(err)}`);
          }
        });

        const wsProtocol = serverUrl.startsWith("https:") ? "wss:" : "ws:";
        const wsUrl = `${serverUrl
          .replace(/^https?:/, wsProtocol)
          .replace(/\/$/, "")}/rooms/${encodeURIComponent(roomId)}/ws`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!destroyed) setIsConnected(true);
        };

        socket.onmessage = async (event) => {
          if (destroyed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "sync-complete") {
              setMarkdown(yText.toString());
              setSyncDone(true);
              return;
            }
            if (data.type === "encrypted-update" && data.record) {
              await handleRoomRecord(data.record, cryptoKey, yDoc, yText);
            }
          } catch (err) {
            setSyncError(`Could not process room update: ${String(err)}`);
          }
        };

        socket.onclose = () => {
          if (!destroyed) setIsConnected(false);
        };

        socket.onerror = () => {
          if (!destroyed) setSyncError("Could not connect to the room server.");
        };

        setMarkdown(yText.toString());
      } catch (err) {
        setSyncError(`Sync failed: ${String(err)}`);
      }
    };

    void setupSync();

    return () => {
      destroyed = true;
      Object.values(fileSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
      fileSaveTimersRef.current = {};
      socketRef.current?.close();
      yDoc.destroy();
      setIsConnected(false);
    };
  }, [roomId, roomSecret, isKeyConfigured, serverUrl, clientId]);

  const handleRoomRecord = async (
    rec: any,
    cryptKey: CryptoKey,
    yDoc: Y.Doc,
    yText: Y.Text,
  ) => {
    if (rec.seq !== expectedSeqRef.current) {
      setSyncError(`Missing or reordered record. Expected ${expectedSeqRef.current}, received ${rec.seq}.`);
      expectedSeqRef.current = rec.seq + 1;
    } else {
      expectedSeqRef.current += 1;
    }

    setLogRecords((prev) => [...prev, rec]);

    const payload: EncryptedPayload = {
      nonce: rec.nonce,
      ciphertext: rec.ciphertext,
    };

    if (rec.senderId.startsWith("fold-cli:proposal")) {
      const parsed = await decryptJson<any>(payload, cryptKey, rec);
      setProposals((prev) => upsertProposal(prev, {
        id: parsed.id,
        title: parsed.title,
        comment: parsed.comment,
        authorPersonaId: parsed.authorPersonaId,
        persona: parsed.persona,
        proposedMarkdown: parsed.proposedMarkdown || parsed.proposed?.markdown || "",
        createdAt: parsed.createdAt,
        status: "pending",
        kind: parsed.kind,
        filePath: parsed.filePath || parsed.path || LIVE_FILE_PATH,
        anchorType: parsed.anchorType || parsed.anchor?.anchorType,
        selectedQuote: parsed.selectedQuote || parsed.anchor?.selectedQuote,
        createdFromMarkdown: parsed.createdFromMarkdown || parsed.anchor?.createdFromMarkdown,
        beforeContext: parsed.beforeContext || parsed.anchor?.beforeContext,
        afterContext: parsed.afterContext || parsed.anchor?.afterContext,
        proposedProject: isProjectSnapshot(parsed.proposedProject) ? parsed.proposedProject : undefined,
      }));
      return;
    }

    if (rec.senderId.startsWith("fold-cli:event")) {
      const parsed = await decryptJson<TimelineEvent>(payload, cryptKey, rec);
      setTimeline((prev) => [parsed, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (parsed.type === "proposal_accepted" || parsed.type === "proposal_rejected") {
        const status = parsed.type === "proposal_accepted" ? "accepted" : "rejected";
        setProposals((prev) =>
          prev.map((proposal) =>
            proposal.id === parsed.proposalId ? { ...proposal, status } : proposal,
          ),
        );
      }
      return;
    }

    if (rec.senderId.startsWith("web-client:comment")) {
      const parsed = await decryptJson<ChatComment>(payload, cryptKey, rec);
      setComments((prev) => upsertComment(prev, parsed));
      return;
    }

    if (rec.senderId.startsWith(PROJECT_SENDER_ID)) {
      const parsed = await decryptJson<ProjectSnapshot>(payload, cryptKey, rec);
      if (!isProjectSnapshot(parsed)) return;
      applyProjectSnapshot(parsed);
      return;
    }

    if (rec.senderId.startsWith("web-client:file")) {
      const parsed = await decryptJson<ProjectFileSnapshot>(payload, cryptKey, rec);
      if (parsed.type !== "project_file_snapshot" || !parsed.path) return;
      setVirtualFiles((prev) => ({ ...prev, [parsed.path]: parsed.markdown }));
      setProjectFileUpdatedAt((prev) => ({ ...prev, [parsed.path]: parsed.updatedAt }));
      return;
    }

    const bytes = await decryptUpdate(payload, cryptKey, {
      roomId: rec.roomId,
      senderId: rec.senderId,
    });
    Y.applyUpdate(yDoc, bytes, "remote");
    setMarkdown(yText.toString());
  };

  const decryptJson = async <T,>(payload: EncryptedPayload, key: CryptoKey, rec: any): Promise<T> => {
    const bytes = await decryptUpdate(payload, key, {
      roomId: rec.roomId,
      senderId: rec.senderId,
    });
    return JSON.parse(decoder.decode(bytes));
  };

  const handleAcceptProposal = async (proposal: Proposal) => {
    if (!keyRef.current || !yTextRef.current || !localMyPersona) return;

    try {
      const acceptedProject = proposal.proposedProject ? normalizeProjectSnapshot(proposal.proposedProject) : null;
      const acceptedPrimaryMarkdown = acceptedProject
        ? acceptedProject.files.find((file) => file.path === acceptedProject.primaryPath)?.markdown ?? proposal.proposedMarkdown
        : proposal.proposedMarkdown;
      const documentUpdate = createMarkdownReplacementUpdate(
        yTextRef.current.toString(),
        acceptedPrimaryMarkdown,
      );
      const encryptedDocument = await encryptUpdate(documentUpdate, keyRef.current, {
        roomId,
        senderId: DOCUMENT_SENDER_ID,
      });
      const documentResponse = await postEncryptedRecord(DOCUMENT_SENDER_ID, encryptedDocument);
      if (!documentResponse.ok) throw new Error(`Server returned ${documentResponse.status}`);

      if (acceptedProject) {
        const senderId = `${PROJECT_SENDER_ID}:${Date.now()}`;
        const encryptedProject = await encryptUpdate(encoder.encode(JSON.stringify(acceptedProject)), keyRef.current, {
          roomId,
          senderId,
        });
        const projectResponse = await postEncryptedRecord(senderId, encryptedProject);
        if (!projectResponse.ok) throw new Error(`Server returned ${projectResponse.status}`);
        applyProjectSnapshot(acceptedProject);
      }

      const createdAt = new Date().toISOString();
      const eventRecord: TimelineEvent = {
        id: `ev-acc-${proposal.id}`,
        type: "proposal_accepted",
        createdAt,
        actorPersonaId: localMyPersona.id,
        proposalId: proposal.id,
        message: `Accepted ${proposal.title}`,
      };
      const encryptedEvent = await encryptUpdate(encoder.encode(JSON.stringify(eventRecord)), keyRef.current, {
        roomId,
        senderId: `fold-cli:event:${eventRecord.id}`,
      });
      const eventResponse = await postEncryptedRecord(`fold-cli:event:${eventRecord.id}`, encryptedEvent);
      if (!eventResponse.ok) throw new Error(`Server returned ${eventResponse.status}`);
      setSelectedProposal(null);
    } catch (err) {
      setSyncError(`Could not accept proposal: ${String(err)}`);
    }
  };

  const applyProjectSnapshot = (snapshot: ProjectSnapshot) => {
    const normalized = normalizeProjectSnapshot(snapshot);
    const files = Object.fromEntries(normalized.files.map((file) => [file.path, file.markdown]));
    const updatedAt = Object.fromEntries(normalized.files.map((file) => [file.path, normalized.updatedAt]));
    setVirtualFiles(files);
    setProjectFileUpdatedAt(updatedAt);
    if (!hasLoadedPreferredFile || !files[selectedFilePath]) {
      setSelectedFilePath(normalized.primaryPath);
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    if (!keyRef.current || !localMyPersona) return;

    try {
      const createdAt = new Date().toISOString();
      const eventRecord: TimelineEvent = {
        id: `ev-rej-${proposal.id}`,
        type: "proposal_rejected",
        createdAt,
        actorPersonaId: localMyPersona.id,
        proposalId: proposal.id,
        message: `Rejected ${proposal.title}`,
      };
      const encryptedEvent = await encryptUpdate(encoder.encode(JSON.stringify(eventRecord)), keyRef.current, {
        roomId,
        senderId: `fold-cli:event:${eventRecord.id}`,
      });
      await postEncryptedRecord(`fold-cli:event:${eventRecord.id}`, encryptedEvent);
      setSelectedProposal(null);
    } catch (err) {
      setSyncError(`Could not reject proposal: ${String(err)}`);
    }
  };

  const handlePostComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newCommentText.trim() || !keyRef.current || !localMyPersona) return;
    const currentMarkdown = selectedFilePath === LIVE_FILE_PATH
      ? markdown
      : virtualFiles[selectedFilePath] || "";

    try {
      const id = Math.random().toString(36).slice(2, 11);
      const record: ChatComment = {
        id,
        authorPersonaId: localMyPersona.id,
        persona: localMyPersona,
        filePath: selectedFilePath,
        text: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        type: "note",
        ...createCommentAnchor(currentMarkdown, selectedQuote),
      };
      const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), keyRef.current, {
        roomId,
        senderId: `web-client:comment:${id}`,
      });
      const res = await postEncryptedRecord(`web-client:comment:${id}`, encrypted);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setComments((prev) => upsertComment(prev, record));
      setNewCommentText("");
      setSelectedQuote("");
    } catch (err) {
      setSyncError(`Could not post comment: ${String(err)}`);
    }
  };

  const persistProjectFileSnapshot = async (path: string, nextMarkdown: string) => {
    if (path === LIVE_FILE_PATH || !keyRef.current || !localMyPersona) return;

    try {
      const updatedAt = new Date().toISOString();
      const record: ProjectFileSnapshot = {
        type: "project_file_snapshot",
        path,
        markdown: nextMarkdown,
        updatedAt,
        authorPersonaId: localMyPersona.id,
        persona: localMyPersona,
      };
      const senderId = `web-client:file:${Math.random().toString(36).slice(2, 11)}`;
      const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), keyRef.current, {
        roomId,
        senderId,
      });
      const res = await postEncryptedRecord(senderId, encrypted);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setProjectFileUpdatedAt((prev) => ({ ...prev, [path]: updatedAt }));
    } catch (err) {
      setSyncError(`Could not save encrypted project file: ${String(err)}`);
    }
  };

  const scheduleProjectFileSnapshot = (path: string, nextMarkdown: string) => {
    if (path === LIVE_FILE_PATH) return;
    clearTimeout(fileSaveTimersRef.current[path]);
    fileSaveTimersRef.current[path] = setTimeout(() => {
      delete fileSaveTimersRef.current[path];
      void persistProjectFileSnapshot(path, nextMarkdown);
    }, 700);
  };

  const flushProjectFileSnapshot = (path: string, nextMarkdown?: string) => {
    if (path === LIVE_FILE_PATH || !fileSaveTimersRef.current[path]) return;
    clearTimeout(fileSaveTimersRef.current[path]);
    delete fileSaveTimersRef.current[path];
    void persistProjectFileSnapshot(path, nextMarkdown ?? virtualFilesRef.current[path] ?? "");
  };

  const postEncryptedRecord = (senderId: string, encrypted: EncryptedPayload) => {
    return fetch(`${serverUrl.replace(/\/$/, "")}/rooms/${encodeURIComponent(roomId)}/updates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        update: {
          senderId,
          ...encrypted,
        },
      }),
    });
  };

  const handleDownloadMarkdown = () => {
    const currentMarkdown = selectedFilePath === LIVE_FILE_PATH
      ? markdown
      : virtualFiles[selectedFilePath] || "";
    const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedFilePath.split("/").pop() || `${roomId || "document"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateProjectFile = (rawPath: string) => {
    const path = normalizeProjectFilePath(rawPath);
    if (!path || path === LIVE_FILE_PATH) return;
    const existingMarkdown = virtualFilesRef.current[path];
    const nextMarkdown = existingMarkdown ?? initialMarkdownForPath(path);
    setVirtualFiles((current) => ({ ...current, [path]: current[path] ?? nextMarkdown }));
    setSelectedFilePath(path);
    setSelectedQuote("");
    setNewCommentText("");
    setEditMode("edit");
    void persistProjectFileSnapshot(path, nextMarkdown);
  };
  const handleImportProjectFile = async (file: File) => {
    const baseName = file.name || "imported.md";
    const importedPath = uniqueProjectFilePath(
      normalizeProjectFilePath(`docs/${baseName}`),
      virtualFilesRef.current,
    );
    if (!importedPath || importedPath === LIVE_FILE_PATH) return;

    try {
      const text = await file.text();
      setVirtualFiles((current) => ({ ...current, [importedPath]: text }));
      setSelectedFilePath(importedPath);
      setSelectedQuote("");
      setNewCommentText("");
      setEditMode("read");
      void persistProjectFileSnapshot(importedPath, text);
    } catch (err) {
      setSyncError(`Could not import Markdown file: ${String(err)}`);
    }
  };

  const projectFiles = useMemo(
    () => createProjectFiles(selectedFilePath, virtualFiles, projectFileUpdatedAt, comments, proposals),
    [selectedFilePath, virtualFiles, projectFileUpdatedAt, comments, proposals],
  );
  useEffect(() => {
    if (!pendingPreferredFilePath) return;
    if (projectFiles.some((file) => file.path === pendingPreferredFilePath)) {
      setSelectedFilePath(pendingPreferredFilePath);
      setPendingPreferredFilePath("");
      return;
    }
    if (syncProgress) setPendingPreferredFilePath("");
  }, [pendingPreferredFilePath, projectFiles, syncProgress]);

  const selectedMarkdown = selectedFilePath === LIVE_FILE_PATH
    ? markdown
    : virtualFiles[selectedFilePath] || `# ${selectedFilePath}\n\nNo local Markdown loaded for this file yet.`;
  const selectedFileComments = comments.filter((comment) => (comment.filePath || LIVE_FILE_PATH) === selectedFilePath);
  const selectedFileProposals = proposals.filter((proposal) => (proposal.filePath || LIVE_FILE_PATH) === selectedFilePath);
  const selectedProposalIds = new Set(selectedFileProposals.map((proposal) => proposal.id));
  const selectedFileTimeline = timeline.filter((event) => !event.proposalId || selectedProposalIds.has(event.proposalId));
  const selectedFilePendingCount = selectedFileProposals.filter((proposal) => proposal.status === "pending").length;
  const selectedFileParticipants = uniquePersonas(selectedFileProposals, selectedFileComments, localMyPersona);
  const agentInvite = useMemo(() => {
    if (!roomId || !roomSecret || typeof window === "undefined") return null;
    return createAgentInvite({
      roomId,
      roomSecret,
      appUrl: window.location.origin,
      syncUrl: serverUrl,
    });
  }, [roomId, roomSecret, serverUrl]);

  if (!isKeyConfigured) {
    return (
      <RoomAccessGate
        roomSecret={roomSecret}
        serverUrl={serverUrl}
        onRoomSecretChange={setRoomSecret}
        onServerUrlChange={setServerUrl}
        onSubmit={handleConfigureKey}
      />
    );
  }

  return (
    <>
      <RoomShell
        roomId={roomId}
        files={projectFiles}
        selectedFilePath={selectedFilePath}
        connected={isConnected}
        ready={syncProgress}
        recordCount={logRecords.length}
        pendingCount={selectedFilePendingCount}
        reviewCount={selectedFileComments.length + selectedFilePendingCount}
        selectedQuote={selectedQuote}
        persona={localMyPersona}
        mode={editMode}
        error={syncError}
        onBack={() => router.push("/")}
        onExport={handleDownloadMarkdown}
        agentInvite={agentInvite}
        onCreateFile={handleCreateProjectFile}
        onImportFile={handleImportProjectFile}
        onFocusCommentComposer={() => setComposerFocusToken((token) => token + 1)}
        onModeChange={(nextMode) => {
          if (editMode === "edit" && nextMode !== "edit") flushProjectFileSnapshot(selectedFilePath);
          setEditMode(nextMode);
        }}
        onFileSelect={(path) => {
          flushProjectFileSnapshot(selectedFilePath);
          setSelectedFilePath(path);
          setSelectedQuote("");
          setNewCommentText("");
        }}
        document={
          <DocumentSurface
            mode={editMode}
            markdown={selectedMarkdown}
            selectedQuote={selectedQuote}
            onSelectedQuoteChange={setSelectedQuote}
            comments={selectedFileComments}
            proposals={selectedFileProposals}
            onOpenProposal={setSelectedProposal}
            newCommentText={newCommentText}
            composerFocusToken={composerFocusToken}
            onNewCommentTextChange={setNewCommentText}
            onPostComment={handlePostComment}
            onMarkdownCommit={(value) => flushProjectFileSnapshot(selectedFilePath, value)}
            onMarkdownChange={(value) => {
              if (selectedFilePath !== LIVE_FILE_PATH) {
                setVirtualFiles((current) => ({ ...current, [selectedFilePath]: value }));
                scheduleProjectFileSnapshot(selectedFilePath, value);
                return;
              }
              if (!yTextRef.current || value === yTextRef.current.toString()) return;
              yDocRef.current?.transact(() => {
                yTextRef.current!.delete(0, yTextRef.current!.length);
                yTextRef.current!.insert(0, value);
              }, "local");
            }}
          />
        }
        bench={
          <AgentBench
            filePath={selectedFilePath}
            comments={selectedFileComments}
            proposals={selectedFileProposals}
            timeline={selectedFileTimeline}
            participants={selectedFileParticipants}
            selectedQuote={selectedQuote}
            onOpenProposal={setSelectedProposal}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
          />
        }
      />
      <ThreadReviewDialog
        proposal={selectedProposal}
        onClose={() => setSelectedProposal(null)}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
      />
    </>
  );
}

function upsertProposal(proposals: Proposal[], next: Proposal): Proposal[] {
  const existing = proposals.find((proposal) => proposal.id === next.id);
  if (!existing) return [next, ...proposals];
  return proposals.map((proposal) => (proposal.id === next.id ? { ...proposal, ...next } : proposal));
}

function upsertComment(comments: ChatComment[], next: ChatComment): ChatComment[] {
  if (comments.some((comment) => comment.id === next.id)) return comments;
  return [next, ...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function uniquePersonas(
  proposals: Proposal[],
  comments: ChatComment[],
  local: RoomPersona | null,
): RoomPersona[] {
  const personas = [
    ...proposals.map((proposal) => proposal.persona),
    ...comments.map((comment) => comment.persona),
    ...(local ? [local] : []),
  ].filter(Boolean);
  const byId = new Map<string, RoomPersona>();
  for (const persona of personas) {
    byId.set(persona.id, persona);
  }
  return Array.from(byId.values());
}

function createCommentAnchor(
  markdown: string,
  selectedQuote: string,
): Pick<ChatComment, "anchorType" | "selectedQuote" | "createdFromMarkdown" | "beforeContext" | "afterContext"> {
  const quote = selectedQuote.trim();
  if (!quote) {
    return {
      anchorType: "document",
      createdFromMarkdown: markdown.slice(0, 320),
    };
  }

  const index = markdown.indexOf(quote);
  if (index === -1) {
    return {
      anchorType: "text-range",
      selectedQuote: quote,
      createdFromMarkdown: markdown.slice(0, 320),
    };
  }

  return {
    anchorType: "text-range",
    selectedQuote: quote,
    createdFromMarkdown: markdown.slice(Math.max(0, index - 160), index + quote.length + 160),
    beforeContext: markdown.slice(Math.max(0, index - 120), index),
    afterContext: markdown.slice(index + quote.length, index + quote.length + 120),
  };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function createMarkdownReplacementUpdate(currentMarkdown: string, replacementMarkdown: string): Uint8Array {
  const doc = new Y.Doc();
  try {
    const text = doc.getText("markdown");
    text.insert(0, currentMarkdown);
    const beforeReplacement = Y.encodeStateVector(doc);
    text.delete(0, text.length);
    text.insert(0, replacementMarkdown);
    return Y.encodeStateAsUpdate(doc, beforeReplacement);
  } finally {
    doc.destroy();
  }
}

function normalizeProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  const byPath = new Map<string, string>();
  for (const file of snapshot.files) {
    const path = normalizeProjectFilePath(file.path);
    if (!path) continue;
    byPath.set(path, file.markdown);
  }
  const files = Array.from(byPath.entries())
    .map(([path, markdown]) => ({ path, markdown }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const primaryPath = normalizeProjectFilePath(snapshot.primaryPath);
  return {
    schema: PROJECT_SCHEMA,
    primaryPath: files.some((file) => file.path === primaryPath) ? primaryPath : files[0]?.path ?? DEFAULT_PROJECT_FILE_PATH,
    files,
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };
}

function isProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProjectSnapshot>;
  return (
    candidate.schema === PROJECT_SCHEMA &&
    typeof candidate.primaryPath === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.files) &&
    candidate.files.every((file) => (
      file &&
      typeof file === "object" &&
      typeof (file as { path?: unknown }).path === "string" &&
      typeof (file as { markdown?: unknown }).markdown === "string"
    ))
  );
}

function createProjectFiles(
  selectedFilePath: string,
  virtualFiles: Record<string, string>,
  projectFileUpdatedAt: Record<string, string>,
  comments: ChatComment[],
  proposals: Proposal[],
) {
  const filesByPath = new Map<string, { name: string; path: string; folder: string; status?: string }>();
  const commentCounts = countRecordsByFile(comments);
  const pendingProposalCounts = countRecordsByFile(proposals.filter((proposal) => proposal.status === "pending"));
  const addFile = (path: string, status?: string) => {
    const normalized = normalizeProjectFilePath(path);
    if (!normalized) return;
    filesByPath.set(normalized, {
      name: normalized.split("/").pop() || normalized,
      path: normalized,
      folder: folderForPath(normalized),
      status,
    });
  };

  Object.keys(virtualFiles).forEach((path) => addFile(path));
  [
    { name: "launch-review.md", path: LIVE_FILE_PATH, folder: "reports", status: "live" },
  ].forEach((file) => filesByPath.set(file.path, file));

  const files = Array.from(filesByPath.values()).sort((a, b) => {
    const folderOrder = ["docs", "reports", ""];
    const ai = folderOrder.indexOf(a.folder);
    const bi = folderOrder.indexOf(b.folder);
    if (a.folder !== b.folder) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.folder.localeCompare(b.folder);
    return a.name.localeCompare(b.name);
  });

  return files.map((file) => ({
    ...file,
    active: file.path === selectedFilePath,
    status: file.status || (projectFileUpdatedAt[file.path] ? "synced" : undefined),
    commentCount: commentCounts.get(file.path) || 0,
    pendingCount: pendingProposalCounts.get(file.path) || 0,
  }));
}

function countRecordsByFile(records: Array<{ filePath?: string }>) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const path = record.filePath || LIVE_FILE_PATH;
    counts.set(path, (counts.get(path) || 0) + 1);
  }
  return counts;
}

function lastOpenedFileStorageKey(roomId: string) {
  return `fold:last-opened-file:${roomId}`;
}

function chooseInitialProjectFile(
  storedPath: string,
  files: Array<{ path: string }>,
) {
  const available = new Set(files.map((file) => file.path));
  const normalizedStored = storedPath ? normalizeProjectFilePath(storedPath) : "";
  const candidates = [
    normalizedStored,
    DEFAULT_PROJECT_FILE_PATH,
    "README.md",
    "docs/README.md",
    LIVE_FILE_PATH,
    files[0]?.path || "",
  ];
  return candidates.find((path) => path && available.has(path)) || DEFAULT_PROJECT_FILE_PATH;
}

function normalizeProjectFilePath(rawPath: string) {
  const trimmed = rawPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!trimmed) return "";
  const collapsed = trimmed
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!collapsed) return "";
  return collapsed.toLowerCase().endsWith(".md") ? collapsed : `${collapsed}.md`;
}

function uniqueProjectFilePath(path: string, existingFiles: Record<string, string>) {
  const normalized = normalizeProjectFilePath(path);
  if (!normalized) return "";
  const existing = new Set([...Object.keys(existingFiles), LIVE_FILE_PATH]);
  if (!existing.has(normalized)) return normalized;

  const parts = normalized.split("/");
  const fileName = parts.pop() || "imported.md";
  const folder = parts.join("/");
  const stem = fileName.replace(/\.md$/i, "");
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${folder ? `${folder}/` : ""}${stem}-${index}.md`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${folder ? `${folder}/` : ""}${stem}-${Date.now()}.md`;
}

function folderForPath(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] || "" : "";
}

function initialMarkdownForPath(path: string) {
  const name = path.split("/").pop()?.replace(/\.md$/i, "") || "Untitled";
  const title = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ") || "Untitled";
  return `# ${title}\n\n`;
}

function createAgentInvite({
  roomId,
  roomSecret,
  appUrl,
  syncUrl,
}: {
  roomId: string;
  roomSecret: string;
  appUrl: string;
  syncUrl: string;
}) {
  const alias = `room-${roomId.slice(0, 8)}`;
  const normalizedAppUrl = appUrl.replace(/\/$/, "");
  const normalizedSyncUrl = syncUrl.replace(/\/$/, "");
  const warnings = shareabilityWarnings({
    appUrl: normalizedAppUrl,
    syncUrl: normalizedSyncUrl,
  });
  const token = createRoomToken({
    roomId,
    roomSecret,
    appUrl: normalizedAppUrl,
    syncUrl: normalizedSyncUrl,
  });
  const skillUrl = `${normalizedAppUrl}/.well-known/fold/agent-skill.md`;
  return {
    alias,
    skillUrl,
    warnings,
    text: [
      "Join this Fold project room:",
      "",
      `1. Read the agent skill: ${skillUrl}`,
      "",
      "2. Save the room alias:",
      `   fold room add ${JSON.stringify(token)} --alias ${JSON.stringify(alias)}`,
      "",
      "   If the Fold CLI is not globally installed in this repo, use:",
      `   npm run --silent cli -- room add ${JSON.stringify(token)} --alias ${JSON.stringify(alias)}`,
      "",
      "3. Confirm access:",
      `   fold status --room ${JSON.stringify(alias)} --json`,
      "",
      "4. Work through proposals, not direct mutation:",
      `   fold export --room ${JSON.stringify(alias)} --output ./fold-project --json`,
      `   fold propose ./fold-project --room ${JSON.stringify(alias)} --title "Describe the change" --comment "Summarize what changed." --json`,
    ].join("\n"),
  };
}

function shareabilityWarnings(access: { appUrl: string; syncUrl: string }) {
  const warnings: string[] = [];
  for (const [label, value] of [["appUrl", access.appUrl], ["syncUrl", access.syncUrl]] as const) {
    const host = new URL(value).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      warnings.push(`${label} ${value} may only be reachable on this machine or local network.`);
    }
  }
  return warnings;
}

function createRoomToken(access: { roomId: string; roomSecret: string; appUrl: string; syncUrl: string }) {
  const encoded = base64UrlEncode(JSON.stringify({
    v: 1,
    roomId: access.roomId,
    roomSecret: access.roomSecret,
    appUrl: access.appUrl,
    syncUrl: access.syncUrl,
  }));
  return `fold:v1:${encoded}`;
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createInitialVirtualFiles(): Record<string, string> {
  return {
    "docs/PLAN.md": [
      "# Project Plan",
      "",
      "Fold is moving from a single Markdown room toward an encrypted collaborative project.",
      "",
      "## Next",
      "",
      "- Keep Markdown canonical.",
      "- Make file navigation real.",
      "- Add inline comment markers.",
      "- Keep review overlays lightweight.",
    ].join("\n"),
    "docs/AGENTS.md": [
      "# Agent Notes",
      "",
      "Future coding agents should preserve the E2EE model and treat raw Markdown as the durable source of truth.",
      "",
      "## UI Direction",
      "",
      "Use a dark-first project workspace with compact file navigation and inline comments.",
    ].join("\n"),
    "docs/UI.md": [
      "# UI Direction",
      "",
      "The app should feel closer to an editor than a dashboard.",
      "",
      "- Left project file sidebar",
      "- Center Markdown file",
      "- Small inline comment markers",
      "- Review drawer only when opened",
    ].join("\n"),
    "docs/DESIGN.md": [
      "# Design Direction",
      "",
      "Borrow Obsidian's calm file-first feel without cloning its brand.",
      "",
      "## Tokens",
      "",
      "- Dark layered panes",
      "- Midnight blue accent",
      "- Quiet document typography",
    ].join("\n"),
    "reports/e2ee-notes.md": [
      "# E2EE Notes",
      "",
      "The server stores encrypted room records and plaintext routing metadata only.",
      "",
      "Comments, proposals, personas, and Markdown payloads remain encrypted client-side.",
    ].join("\n"),
  };
}
