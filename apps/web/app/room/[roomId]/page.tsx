"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import { AgentBench } from "../../../components/room/AgentBench";
import { DocumentSurface } from "../../../components/room/DocumentSurface";
import { RoomAccessGate } from "../../../components/room/RoomAccessGate";
import { RoomShell } from "../../../components/room/RoomShell";
import { ThreadReviewDialog } from "../../../components/room/ThreadReviewDialog";
import type { ChatComment, CollaborationPresence, FileConflict, FileVersion, Proposal, TimelineEvent } from "../../../components/room/types";
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
const COMMENT_EVENT_SENDER_ID = "web-client:comment-event";
const CLI_COMMENT_EVENT_SENDER_ID = "fold-cli:comment-event";
const PRESENCE_SENDER_ID = "web-client:presence";
const FILE_VERSION_SENDER_ID = "web-client:version";
const LIVE_FILE_PATH = "reports/launch-review.md";
const DEFAULT_PROJECT_FILE_PATH = "docs/PLAN.md";
const PRESENCE_TTL_MS = 75_000;
const PRESENCE_ACTIVITY_IDLE_DELAY_MS = 4_000;
type PresenceActivity = NonNullable<CollaborationPresence["activity"]>;

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
  const [hasRemoteProjectState, setHasRemoteProjectState] = useState(false);
  const [projectPrimaryPath, setProjectPrimaryPath] = useState("");
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
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [fileConflicts, setFileConflicts] = useState<Record<string, FileConflict>>({});
  const [presenceByClientId, setPresenceByClientId] = useState<Record<string, CollaborationPresence>>({});
  const [presenceClock, setPresenceClock] = useState(() => Date.now());
  const [presenceActivity, setPresenceActivity] = useState<PresenceActivity>("idle");
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
  const presenceActivityTimerRef = useRef<number | null>(null);
  const virtualFilesRef = useRef(virtualFiles);
  const projectFileUpdatedAtRef = useRef(projectFileUpdatedAt);
  const fileConflictsRef = useRef(fileConflicts);
  const localMyPersonaRef = useRef<RoomPersona | null>(localMyPersona);
  const selectedFilePathRef = useRef(selectedFilePath);
  const editModeRef = useRef(editMode);
  const hasRemoteProjectStateRef = useRef(false);
  const projectPrimaryPathRef = useRef("");
  const bootstrappedInitialProjectRef = useRef(false);
  const replayedRecordCountRef = useRef(0);

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
      participantFingerprint: getOrCreateParticipantFingerprint(clientId),
    }));
  }, [roomId, clientId]);

  useEffect(() => {
    virtualFilesRef.current = virtualFiles;
  }, [virtualFiles]);

  useEffect(() => {
    localMyPersonaRef.current = localMyPersona;
  }, [localMyPersona]);

  useEffect(() => {
    selectedFilePathRef.current = selectedFilePath;
  }, [selectedFilePath]);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    projectFileUpdatedAtRef.current = projectFileUpdatedAt;
  }, [projectFileUpdatedAt]);

  useEffect(() => {
    fileConflictsRef.current = fileConflicts;
  }, [fileConflicts]);

  useEffect(() => {
    if (!roomId || hasLoadedPreferredFile) return;
    const knownFiles = createProjectFiles(selectedFilePath, virtualFilesRef.current, [], []);
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
        setFileConflicts({});
        fileConflictsRef.current = {};
        setPresenceByClientId({});
        setProjectFileUpdatedAt({});
        projectFileUpdatedAtRef.current = {};
        setHasRemoteProjectState(false);
        setProjectPrimaryPath("");
        hasRemoteProjectStateRef.current = false;
        projectPrimaryPathRef.current = "";
        bootstrappedInitialProjectRef.current = false;
        replayedRecordCountRef.current = 0;

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
    replayedRecordCountRef.current += 1;

    const payload: EncryptedPayload = {
      nonce: rec.nonce,
      ciphertext: rec.ciphertext,
    };

    if (rec.senderId.startsWith("fold-cli:proposal")) {
      const parsed = await decryptJson<any>(payload, cryptKey, rec);
      const proposedProject = isProjectSnapshot(parsed.proposedProject)
        ? normalizeProjectSnapshot(parsed.proposedProject)
        : undefined;
      const fallbackFilePath = proposedProject?.primaryPath || projectPrimaryPathRef.current || LIVE_FILE_PATH;
      setProposals((prev) => upsertProposal(prev, {
        id: parsed.id,
        title: parsed.title,
        comment: parsed.comment,
        authorPersonaId: parsed.authorPersonaId,
        persona: parsed.persona,
        proposedMarkdown: parsed.proposedMarkdown || parsed.proposed?.markdown || "",
        proposedSha256: typeof parsed.proposed?.sha256 === "string" ? parsed.proposed.sha256 : undefined,
        createdAt: parsed.createdAt,
        status: "pending",
        kind: parsed.kind,
        filePath: parsed.filePath || parsed.path || fallbackFilePath,
        anchorType: parsed.anchorType || parsed.anchor?.anchorType,
        selectedQuote: parsed.selectedQuote || parsed.anchor?.selectedQuote,
        createdFromMarkdown: parsed.createdFromMarkdown || parsed.anchor?.createdFromMarkdown,
        diff: typeof parsed.diff === "string" ? parsed.diff : undefined,
        beforeContext: parsed.beforeContext || parsed.anchor?.beforeContext,
        afterContext: parsed.afterContext || parsed.anchor?.afterContext,
        proposedProject,
      }));
      return;
    }

    if (rec.senderId.startsWith(COMMENT_EVENT_SENDER_ID) || rec.senderId.startsWith(CLI_COMMENT_EVENT_SENDER_ID)) {
      const parsed = await decryptJson<TimelineEvent>(payload, cryptKey, rec);
      setTimeline((prev) => [parsed, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setComments((prev) => applyCommentEvent(prev, parsed));
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
      if (parsed.type === "comment_resolved" || parsed.type === "comment_reopened") {
        setComments((prev) => applyCommentEvent(prev, parsed));
      }
      if (parsed.type === "comment_replied") {
        setComments((prev) => applyCommentEvent(prev, parsed));
      }
      return;
    }

    if (rec.senderId.startsWith("web-client:comment") || rec.senderId.startsWith("fold-cli:comment")) {
      const parsed = await decryptJson<ChatComment>(payload, cryptKey, rec);
      setComments((prev) => upsertComment(prev, parsed));
      return;
    }

    if (rec.senderId.startsWith(FILE_VERSION_SENDER_ID)) {
      const parsed = await decryptJson<FileVersion>(payload, cryptKey, rec);
      if (isFileVersion(parsed)) {
        setFileVersions((prev) => upsertFileVersion(prev, parsed));
      }
      return;
    }

    if (rec.senderId.startsWith(PRESENCE_SENDER_ID)) {
      const parsed = await decryptJson<CollaborationPresence>(payload, cryptKey, rec);
      if (isCollaborationPresence(parsed)) {
        setPresenceByClientId((prev) => upsertPresence(prev, parsed));
        setPresenceClock(Date.now());
      }
      return;
    }

    if (rec.senderId.startsWith(PROJECT_SENDER_ID)) {
      const parsed = await decryptJson<ProjectSnapshot>(payload, cryptKey, rec);
      if (!isProjectSnapshot(parsed)) return;
      applyProjectSnapshot(parsed, { respectLocalDrafts: true });
      return;
    }

    if (rec.senderId.startsWith("web-client:file")) {
      const parsed = await decryptJson<ProjectFileSnapshot>(payload, cryptKey, rec);
      if (parsed.type !== "project_file_snapshot" || !parsed.path) return;
      const path = normalizeProjectFilePath(parsed.path);
      if (!path || isStaleProjectFileSnapshot(projectFileUpdatedAtRef.current[path], parsed.updatedAt)) return;
      if (shouldDeferRemoteProjectFile(path, parsed.markdown, parsed.updatedAt)) {
        deferRemoteProjectFile(path, parsed);
        return;
      }
      const isFirstRemoteProjectFile = !hasRemoteProjectStateRef.current;
      hasRemoteProjectStateRef.current = true;
      if (!projectPrimaryPathRef.current) projectPrimaryPathRef.current = path;
      setHasRemoteProjectState(true);
      setProjectPrimaryPath((current) => current || path);
      if (isFirstRemoteProjectFile) {
        setSelectedFilePath(path);
      }
      setVirtualFiles((prev) => (
        isFirstRemoteProjectFile ? { [path]: parsed.markdown } : { ...prev, [path]: parsed.markdown }
      ));
      markProjectFileUpdatedAt(path, parsed.updatedAt);
      clearFileConflict(path);
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
        schema: "fold.timeline-event.v1",
        id: `ev-acc-${proposal.id}`,
        type: "proposal_accepted",
        createdAt,
        actorPersonaId: localMyPersona.id,
        proposalId: proposal.id,
        documentSha256: proposal.proposedSha256 || null,
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

  const applyProjectSnapshot = (snapshot: ProjectSnapshot, options: { respectLocalDrafts?: boolean } = {}) => {
    const normalized = normalizeProjectSnapshot(snapshot);
    const files = Object.fromEntries(normalized.files.map((file) => [file.path, file.markdown]));
    const updatedAt = Object.fromEntries(normalized.files.map((file) => [file.path, normalized.updatedAt]));
    const nextConflicts: Record<string, FileConflict> = {};
    if (options.respectLocalDrafts) {
      for (const file of normalized.files) {
        if (isStaleProjectFileSnapshot(projectFileUpdatedAtRef.current[file.path], normalized.updatedAt)) {
          files[file.path] = virtualFilesRef.current[file.path] ?? "";
          updatedAt[file.path] = projectFileUpdatedAtRef.current[file.path] ?? normalized.updatedAt;
          if (fileConflictsRef.current[file.path]) {
            nextConflicts[file.path] = fileConflictsRef.current[file.path];
          }
          continue;
        }

        if (!shouldDeferRemoteProjectFile(file.path, file.markdown, normalized.updatedAt)) continue;

        const existingConflict = fileConflictsRef.current[file.path];
        if (!existingConflict || !isStaleProjectFileSnapshot(existingConflict.remoteUpdatedAt, normalized.updatedAt)) {
          nextConflicts[file.path] = createFileConflict(file.path, file.markdown, normalized.updatedAt);
        } else {
          nextConflicts[file.path] = existingConflict;
        }
        clearPendingProjectFileTimer(file.path);
        files[file.path] = virtualFilesRef.current[file.path] ?? "";
        updatedAt[file.path] = projectFileUpdatedAtRef.current[file.path] ?? normalized.updatedAt;
      }

      const incomingPaths = new Set(normalized.files.map((file) => file.path));
      for (const path of Object.keys(virtualFilesRef.current)) {
        if (incomingPaths.has(path) || path === LIVE_FILE_PATH) continue;
        if (isStaleProjectFileSnapshot(projectFileUpdatedAtRef.current[path], normalized.updatedAt)) {
          files[path] = virtualFilesRef.current[path] ?? "";
          updatedAt[path] = projectFileUpdatedAtRef.current[path] ?? normalized.updatedAt;
          if (fileConflictsRef.current[path]) {
            nextConflicts[path] = fileConflictsRef.current[path];
          }
          continue;
        }
        if (!fileSaveTimersRef.current[path] && !fileConflictsRef.current[path]) continue;

        const existingConflict = fileConflictsRef.current[path];
        if (!existingConflict || !isStaleProjectFileSnapshot(existingConflict.remoteUpdatedAt, normalized.updatedAt)) {
          nextConflicts[path] = createFileConflict(path, "", normalized.updatedAt, undefined, { remoteDeleted: true });
        } else {
          nextConflicts[path] = existingConflict;
        }
        clearPendingProjectFileTimer(path);
        files[path] = virtualFilesRef.current[path] ?? "";
        updatedAt[path] = projectFileUpdatedAtRef.current[path] ?? normalized.updatedAt;
      }
    }
    hasRemoteProjectStateRef.current = true;
    projectPrimaryPathRef.current = normalized.primaryPath;
    projectFileUpdatedAtRef.current = updatedAt;
    fileConflictsRef.current = nextConflicts;
    setHasRemoteProjectState(true);
    setProjectPrimaryPath(normalized.primaryPath);
    setVirtualFiles(files);
    setProjectFileUpdatedAt(updatedAt);
    setFileConflicts(nextConflicts);
    if (!hasLoadedPreferredFile || !files[selectedFilePath]) {
      setSelectedFilePath(normalized.primaryPath);
    }
  };

  const persistProjectSnapshot = async (snapshot: ProjectSnapshot) => {
    if (!keyRef.current) return;
    const normalized = normalizeProjectSnapshot(snapshot);
    const senderId = `${PROJECT_SENDER_ID}:web-${Date.now()}`;
    const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(normalized)), keyRef.current, {
      roomId,
      senderId,
    });
    const response = await postEncryptedRecord(senderId, encrypted);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    applyProjectSnapshot(normalized);
  };

  useEffect(() => {
    if (!syncProgress || !isKeyConfigured || !keyRef.current || hasRemoteProjectStateRef.current || bootstrappedInitialProjectRef.current) return;
    if (replayedRecordCountRef.current > 0 || (yTextRef.current?.toString() ?? "")) return;
    bootstrappedInitialProjectRef.current = true;

    const snapshot = normalizeProjectSnapshot({
      schema: PROJECT_SCHEMA,
      primaryPath: DEFAULT_PROJECT_FILE_PATH,
      files: Object.entries(virtualFilesRef.current).map(([path, markdown]) => ({ path, markdown })),
      updatedAt: new Date().toISOString(),
    });

    void persistProjectSnapshot(snapshot).catch((err) => {
      bootstrappedInitialProjectRef.current = false;
      setSyncError(`Could not save encrypted project seed: ${String(err)}`);
    });
  }, [isKeyConfigured, syncProgress, roomId]);

  const handleRejectProposal = async (proposal: Proposal) => {
    if (!keyRef.current || !localMyPersona) return;

    try {
      const createdAt = new Date().toISOString();
      const eventRecord: TimelineEvent = {
        schema: "fold.timeline-event.v1",
        id: `ev-rej-${proposal.id}`,
        type: "proposal_rejected",
        createdAt,
        actorPersonaId: localMyPersona.id,
        proposalId: proposal.id,
        documentSha256: null,
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
      clearPresenceActivity();
    } catch (err) {
      setSyncError(`Could not post comment: ${String(err)}`);
    }
  };

  const handleResolveComment = async (comment: ChatComment, resolved: boolean) => {
    if (!keyRef.current || !localMyPersona) return;

    try {
      const createdAt = new Date().toISOString();
      const eventRecord: TimelineEvent = {
        id: `ev-comment-${resolved ? "res" : "open"}-${comment.id}-${Date.now()}`,
        type: resolved ? "comment_resolved" : "comment_reopened",
        createdAt,
        actorPersonaId: localMyPersona.id,
        commentId: comment.id,
        filePath: comment.filePath || selectedFilePath,
        message: `${resolved ? "Resolved" : "Reopened"} comment on ${comment.selectedQuote || comment.filePath || "document"}`,
      };
      const encryptedEvent = await encryptUpdate(encoder.encode(JSON.stringify(eventRecord)), keyRef.current, {
        roomId,
        senderId: `${COMMENT_EVENT_SENDER_ID}:${eventRecord.id}`,
      });
      const response = await postEncryptedRecord(`${COMMENT_EVENT_SENDER_ID}:${eventRecord.id}`, encryptedEvent);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      setComments((prev) => applyCommentEvent(prev, eventRecord));
    } catch (err) {
      setSyncError(`Could not update comment: ${String(err)}`);
    }
  };

  const handleReplyToComment = async (
    comment: ChatComment,
    text: string,
    target?: { id: string; authorPersonaId: string; authorName: string },
  ) => {
    const trimmed = text.trim();
    if (!trimmed || !keyRef.current || !localMyPersona) return;

    try {
      const createdAt = new Date().toISOString();
      const replyId = Math.random().toString(36).slice(2, 11);
      const eventRecord: TimelineEvent = {
        id: `ev-comment-reply-${comment.id}-${replyId}`,
        type: "comment_replied",
        createdAt,
        actorPersonaId: localMyPersona.id,
        commentId: comment.id,
        filePath: comment.filePath || selectedFilePath,
        message: `Replied to comment on ${comment.selectedQuote || comment.filePath || "document"}`,
        reply: {
          id: replyId,
          authorPersonaId: localMyPersona.id,
          persona: localMyPersona,
          text: trimmed,
          createdAt,
          ...(target
            ? {
                parentId: target.id,
                parentAuthorPersonaId: target.authorPersonaId,
                parentAuthorName: target.authorName,
              }
            : {}),
        },
      };
      const encryptedEvent = await encryptUpdate(encoder.encode(JSON.stringify(eventRecord)), keyRef.current, {
        roomId,
        senderId: `${COMMENT_EVENT_SENDER_ID}:${eventRecord.id}`,
      });
      const response = await postEncryptedRecord(`${COMMENT_EVENT_SENDER_ID}:${eventRecord.id}`, encryptedEvent);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      setComments((prev) => applyCommentEvent(prev, eventRecord));
      clearPresenceActivity();
    } catch (err) {
      setSyncError(`Could not reply to comment: ${String(err)}`);
    }
  };

  const handleCreateFileVersion = async (title: string) => {
    if (!keyRef.current || !localMyPersona) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const currentMarkdown = selectedFilePath === LIVE_FILE_PATH
      ? markdown
      : virtualFiles[selectedFilePath] || "";

    try {
      const createdAt = new Date().toISOString();
      const id = Math.random().toString(36).slice(2, 11);
      const record: FileVersion = {
        schema: "fold.file_version.v1",
        id,
        title: trimmedTitle,
        filePath: selectedFilePath,
        markdown: currentMarkdown,
        createdAt,
        authorPersonaId: localMyPersona.id,
        persona: localMyPersona,
      };
      const senderId = `${FILE_VERSION_SENDER_ID}:${id}`;
      const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), keyRef.current, {
        roomId,
        senderId,
      });
      const response = await postEncryptedRecord(senderId, encrypted);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      setFileVersions((prev) => upsertFileVersion(prev, record));
    } catch (err) {
      setSyncError(`Could not save encrypted version: ${String(err)}`);
    }
  };

  const handleRestoreFileVersion = (version: FileVersion) => {
    if (version.filePath !== selectedFilePath) return;
    setSelectedQuote("");
    setNewCommentText("");
    clearPresenceActivity();
    if (selectedFilePath !== LIVE_FILE_PATH) {
      setVirtualFiles((current) => ({ ...current, [selectedFilePath]: version.markdown }));
      void persistProjectFileSnapshot(selectedFilePath, version.markdown);
      return;
    }
    if (!yTextRef.current || version.markdown === yTextRef.current.toString()) return;
    yDocRef.current?.transact(() => {
      yTextRef.current!.delete(0, yTextRef.current!.length);
      yTextRef.current!.insert(0, version.markdown);
    }, "local");
  };

  const persistProjectFileSnapshot = async (path: string, nextMarkdown: string, updatedAt = new Date().toISOString()) => {
    if (path === LIVE_FILE_PATH || !keyRef.current || !localMyPersona) return;

    try {
      const record: ProjectFileSnapshot = {
        type: "project_file_snapshot",
        path,
        markdown: nextMarkdown,
        updatedAt,
        authorPersonaId: localMyPersona.id,
        persona: localMyPersona,
      };
      markProjectFileUpdatedAt(path, updatedAt);
      const senderId = `web-client:file:${Math.random().toString(36).slice(2, 11)}`;
      const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), keyRef.current, {
        roomId,
        senderId,
      });
      const res = await postEncryptedRecord(senderId, encrypted);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
    } catch (err) {
      setSyncError(`Could not save encrypted project file: ${String(err)}`);
    }
  };

  const scheduleProjectFileSnapshot = (path: string, nextMarkdown: string) => {
    if (path === LIVE_FILE_PATH) return;
    const updatedAt = new Date().toISOString();
    markProjectFileUpdatedAt(path, updatedAt);
    clearTimeout(fileSaveTimersRef.current[path]);
    fileSaveTimersRef.current[path] = setTimeout(() => {
      delete fileSaveTimersRef.current[path];
      void persistProjectFileSnapshot(path, nextMarkdown, updatedAt);
    }, 700);
  };

  const flushProjectFileSnapshot = (path: string, nextMarkdown?: string) => {
    if (path === LIVE_FILE_PATH || !fileSaveTimersRef.current[path]) return;
    clearPendingProjectFileTimer(path);
    void persistProjectFileSnapshot(path, nextMarkdown ?? virtualFilesRef.current[path] ?? "");
  };

  const shouldDeferRemoteProjectFile = (path: string, remoteMarkdown: string, remoteUpdatedAt: string) => {
    if (!fileSaveTimersRef.current[path] && !fileConflictsRef.current[path]) return false;
    const localMarkdown = virtualFilesRef.current[path] ?? "";
    if (localMarkdown === remoteMarkdown) return false;
    return !isStaleProjectFileSnapshot(projectFileUpdatedAtRef.current[path], remoteUpdatedAt);
  };

  const deferRemoteProjectFile = (path: string, snapshot: ProjectFileSnapshot) => {
    const existingConflict = fileConflictsRef.current[path];
    if (existingConflict && isStaleProjectFileSnapshot(existingConflict.remoteUpdatedAt, snapshot.updatedAt)) return;

    clearPendingProjectFileTimer(path);
    const conflict = createFileConflict(path, snapshot.markdown, snapshot.updatedAt, snapshot.persona);
    fileConflictsRef.current = { ...fileConflictsRef.current, [path]: conflict };
    setFileConflicts((current) => ({ ...current, [path]: conflict }));
  };

  const createFileConflict = (
    path: string,
    remoteMarkdown: string,
    remoteUpdatedAt: string,
    persona?: RoomPersona,
    options: { remoteDeleted?: boolean } = {},
  ): FileConflict => ({
    path,
    localMarkdown: virtualFilesRef.current[path] ?? "",
    localUpdatedAt: projectFileUpdatedAtRef.current[path],
    remoteMarkdown,
    remoteDeleted: options.remoteDeleted,
    remoteUpdatedAt,
    persona,
    createdAt: new Date().toISOString(),
  });

  const clearFileConflict = (path: string) => {
    if (!fileConflictsRef.current[path]) return;
    const { [path]: _cleared, ...rest } = fileConflictsRef.current;
    fileConflictsRef.current = rest;
    setFileConflicts(rest);
  };

  const clearPendingProjectFileTimer = (path: string) => {
    if (!fileSaveTimersRef.current[path]) return;
    clearTimeout(fileSaveTimersRef.current[path]);
    delete fileSaveTimersRef.current[path];
  };

  const handleUseIncomingFileConflict = (conflict: FileConflict) => {
    clearPendingProjectFileTimer(conflict.path);
    if (conflict.remoteDeleted) {
      const { [conflict.path]: _deleted, ...rest } = virtualFilesRef.current;
      const nextSelectedPath = selectedFilePathRef.current === conflict.path
        ? nextSelectedPathAfterDeletion(rest, projectPrimaryPathRef.current)
        : selectedFilePathRef.current;
      setVirtualFiles(rest);
      setSelectedFilePath(nextSelectedPath);
      markProjectFileUpdatedAt(conflict.path, conflict.remoteUpdatedAt);
      clearFileConflict(conflict.path);
      setSelectedQuote("");
      setNewCommentText("");
      clearPresenceActivity();
      return;
    }
    setVirtualFiles((current) => ({ ...current, [conflict.path]: conflict.remoteMarkdown }));
    markProjectFileUpdatedAt(conflict.path, conflict.remoteUpdatedAt);
    clearFileConflict(conflict.path);
    setSelectedFilePath(conflict.path);
    setSelectedQuote("");
    setNewCommentText("");
    clearPresenceActivity();
  };

  const handleKeepLocalFileConflict = (conflict: FileConflict) => {
    clearPendingProjectFileTimer(conflict.path);
    const localMarkdown = virtualFilesRef.current[conflict.path] ?? conflict.localMarkdown;
    clearFileConflict(conflict.path);
    setSelectedFilePath(conflict.path);
    void persistProjectFileSnapshot(conflict.path, localMarkdown);
  };

  const markProjectFileUpdatedAt = (path: string, updatedAt: string) => {
    projectFileUpdatedAtRef.current = {
      ...projectFileUpdatedAtRef.current,
      [path]: updatedAt,
    };
    setProjectFileUpdatedAt((prev) => ({ ...prev, [path]: updatedAt }));
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

  const markPresenceActivity = (activity: Exclude<PresenceActivity, "idle">) => {
    if (presenceActivityTimerRef.current) window.clearTimeout(presenceActivityTimerRef.current);
    setPresenceActivity(activity);
    presenceActivityTimerRef.current = window.setTimeout(() => {
      presenceActivityTimerRef.current = null;
      setPresenceActivity("idle");
    }, PRESENCE_ACTIVITY_IDLE_DELAY_MS);
  };

  const clearPresenceActivity = () => {
    if (presenceActivityTimerRef.current) {
      window.clearTimeout(presenceActivityTimerRef.current);
      presenceActivityTimerRef.current = null;
    }
    setPresenceActivity("idle");
  };

  useEffect(() => {
    return () => {
      if (presenceActivityTimerRef.current) window.clearTimeout(presenceActivityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!roomId || !isKeyConfigured || !isConnected || !localMyPersona || !keyRef.current) return;

    let cancelled = false;
    const sendPresence = async () => {
      const key = keyRef.current;
      if (!key || cancelled) return;

      try {
        const now = Date.now();
        const record: CollaborationPresence = {
          schema: "fold.presence.v1",
          clientId,
          authorPersonaId: localMyPersona.id,
          persona: localMyPersona,
          filePath: selectedFilePath,
          mode: editMode,
          status: editMode === "edit" ? "editing" : "viewing",
          activity: presenceActivity,
          updatedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + PRESENCE_TTL_MS).toISOString(),
        };
        const senderId = `${PRESENCE_SENDER_ID}:${clientId}`;
        const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), key, {
          roomId,
          senderId,
        });
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "encrypted-update",
              update: {
                senderId,
                ...encrypted,
              },
            }),
          );
        } else {
          await postEncryptedRecord(senderId, encrypted);
        }
        setPresenceByClientId((prev) => upsertPresence(prev, record));
        setPresenceClock(Date.now());
      } catch {
        // Presence is a soft collaboration hint; document sync errors are surfaced separately.
      }
    };

    void sendPresence();
    const timer = window.setInterval(() => void sendPresence(), 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [clientId, editMode, isConnected, isKeyConfigured, localMyPersona, presenceActivity, roomId, selectedFilePath, serverUrl]);

  useEffect(() => {
    if (!roomId || !isKeyConfigured) return;

    let cancelled = false;
    const sendLeavePresence = async () => {
      const key = keyRef.current;
      const persona = localMyPersonaRef.current;
      const socket = socketRef.current;
      if (!key || !persona || cancelled || socket?.readyState !== WebSocket.OPEN) return;

      try {
        const now = Date.now();
        const senderId = `${PRESENCE_SENDER_ID}:${clientId}`;
        const record: CollaborationPresence = {
          schema: "fold.presence.v1",
          clientId,
          authorPersonaId: persona.id,
          persona,
          filePath: selectedFilePathRef.current,
          mode: editModeRef.current,
          status: "left",
          activity: "idle",
          updatedAt: new Date(now).toISOString(),
          expiresAt: new Date(now).toISOString(),
        };
        const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), key, {
          roomId,
          senderId,
        });
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(
          JSON.stringify({
            type: "encrypted-update",
            update: {
              senderId,
              ...encrypted,
            },
          }),
        );
      } catch {
        // Leave presence is best-effort; stale collaborators still expire via TTL.
      }
    };
    const onPageHide = () => {
      void sendLeavePresence();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      void sendLeavePresence();
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [clientId, isKeyConfigured, roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

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
    clearPresenceActivity();
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
      clearPresenceActivity();
      setEditMode("read");
      void persistProjectFileSnapshot(importedPath, text);
    } catch (err) {
      setSyncError(`Could not import Markdown file: ${String(err)}`);
    }
  };

  const projectFiles = useMemo(
    () => createProjectFiles(
      selectedFilePath,
      virtualFiles,
      comments,
      proposals,
      projectFileUpdatedAt,
      activePresencesByFile(presenceByClientId, presenceClock),
      fileConflicts,
      !hasRemoteProjectState,
      projectPrimaryPath || LIVE_FILE_PATH,
    ),
    [selectedFilePath, virtualFiles, comments, proposals, projectFileUpdatedAt, presenceByClientId, presenceClock, fileConflicts, hasRemoteProjectState, projectPrimaryPath],
  );
  const projectName = useMemo(
    () => deriveProjectName(virtualFiles, projectPrimaryPath || DEFAULT_PROJECT_FILE_PATH),
    [projectPrimaryPath, virtualFiles],
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
    : virtualFiles[selectedFilePath] ?? "";
  const defaultRecordFilePath = projectPrimaryPath || LIVE_FILE_PATH;
  const selectedFileComments = comments.filter((comment) => (comment.filePath || defaultRecordFilePath) === selectedFilePath);
  const selectedFileActiveComments = selectedFileComments.filter((comment) => !comment.resolvedAt);
  const selectedFileProposals = proposals.filter((proposal) => (proposal.filePath || defaultRecordFilePath) === selectedFilePath);
  const selectedProposalIds = new Set(selectedFileProposals.map((proposal) => proposal.id));
  const selectedCommentIds = new Set(selectedFileComments.map((comment) => comment.id));
  const selectedFileTimeline = timeline.filter((event) => {
    if (event.proposalId) return selectedProposalIds.has(event.proposalId);
    if (event.commentId) return selectedCommentIds.has(event.commentId);
    if (event.filePath) return event.filePath === selectedFilePath;
    return true;
  });
  const selectedFilePendingCount = selectedFileProposals.filter((proposal) => proposal.status === "pending").length;
  const selectedFileVersions = fileVersions.filter((version) => version.filePath === selectedFilePath);
  const selectedFileConflict = fileConflicts[selectedFilePath] || null;
  const selectedFilePresences = activePresencesForFile(presenceByClientId, selectedFilePath, presenceClock);
  const selectedFileParticipants = uniquePersonas(selectedFileProposals, selectedFileComments, selectedFileVersions, selectedFilePresences, localMyPersona);
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
        projectName={projectName}
        files={projectFiles}
        selectedFilePath={selectedFilePath}
        connected={isConnected}
        ready={syncProgress}
        recordCount={logRecords.length}
        pendingCount={selectedFilePendingCount}
        conflictCount={selectedFileConflict ? 1 : 0}
        reviewCount={selectedFileActiveComments.length + selectedFilePendingCount + (selectedFileConflict ? 1 : 0)}
        selectedQuote={selectedQuote}
        persona={localMyPersona}
        activePresences={selectedFilePresences}
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
          clearPresenceActivity();
        }}
        document={
          <DocumentSurface
            mode={editMode}
            markdown={selectedMarkdown}
            selectedQuote={selectedQuote}
            onSelectedQuoteChange={setSelectedQuote}
            comments={selectedFileComments}
            proposals={selectedFileProposals}
            activeProposalId={selectedProposal?.id ?? null}
            onOpenProposal={setSelectedProposal}
            onResolveComment={handleResolveComment}
            onReplyToComment={handleReplyToComment}
            onStartEditing={() => setEditMode("edit")}
            newCommentText={newCommentText}
            composerFocusToken={composerFocusToken}
            onNewCommentTextChange={(value) => {
              setNewCommentText(value);
              if (value.trim()) markPresenceActivity("commenting");
              else clearPresenceActivity();
            }}
            onPostComment={handlePostComment}
            onMarkdownCommit={(value) => flushProjectFileSnapshot(selectedFilePath, value)}
            onMarkdownChange={(value) => {
              markPresenceActivity("typing");
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
            markdown={selectedMarkdown}
            comments={selectedFileComments}
            proposals={selectedFileProposals}
            versions={selectedFileVersions}
            conflict={selectedFileConflict}
            timeline={selectedFileTimeline}
            participants={selectedFileParticipants}
            selectedQuote={selectedQuote}
            onOpenProposal={setSelectedProposal}
            onAcceptProposal={handleAcceptProposal}
            onRejectProposal={handleRejectProposal}
            onResolveComment={handleResolveComment}
            onReplyToComment={handleReplyToComment}
            onCreateVersion={handleCreateFileVersion}
            onRestoreVersion={handleRestoreFileVersion}
            onUseIncomingConflict={handleUseIncomingFileConflict}
            onKeepLocalConflict={handleKeepLocalFileConflict}
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
  return [{ ...next, replies: sortCommentReplies(next.replies || []) }, ...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function upsertFileVersion(versions: FileVersion[], next: FileVersion): FileVersion[] {
  const existingIndex = versions.findIndex((version) => version.id === next.id);
  if (existingIndex === -1) return [next, ...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const clone = [...versions];
  clone[existingIndex] = { ...clone[existingIndex], ...next };
  return clone.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function applyCommentEvent(comments: ChatComment[], event: TimelineEvent): ChatComment[] {
  if (!event.commentId) return comments;
  return comments.map((comment) => {
    if (comment.id !== event.commentId) return comment;
    if (event.type === "comment_resolved") {
      return {
        ...comment,
        resolvedAt: event.createdAt,
        resolvedByPersonaId: event.actorPersonaId,
      };
    }
    if (event.type === "comment_reopened") {
      const { resolvedAt, resolvedByPersonaId, ...reopened } = comment;
      return reopened;
    }
    if (event.type === "comment_replied" && event.reply) {
      const replies = comment.replies || [];
      if (replies.some((reply) => reply.id === event.reply?.id)) return comment;
      return {
        ...comment,
        replies: sortCommentReplies([...replies, event.reply]),
      };
    }
    return comment;
  });
}

function sortCommentReplies(replies: NonNullable<ChatComment["replies"]>) {
  return [...replies].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function uniquePersonas(
  proposals: Proposal[],
  comments: ChatComment[],
  versions: FileVersion[],
  presences: CollaborationPresence[],
  local: RoomPersona | null,
): RoomPersona[] {
  const personas = [
    ...presences.map((presence) => presence.persona),
    ...proposals.map((proposal) => proposal.persona),
    ...comments.map((comment) => comment.persona),
    ...comments.flatMap((comment) => (comment.replies || []).map((reply) => reply.persona)),
    ...versions.map((version) => version.persona),
    ...(local ? [local] : []),
  ].filter(Boolean);
  const byId = new Map<string, RoomPersona>();
  for (const persona of personas) {
    byId.set(persona.id, persona);
  }
  return Array.from(byId.values());
}

function getOrCreateParticipantFingerprint(fallback: string) {
  const storageKey = "fold:participant-fingerprint:v1";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;

    const created = window.crypto?.randomUUID?.() || fallback;
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return fallback;
  }
}

function upsertPresence(
  presences: Record<string, CollaborationPresence>,
  next: CollaborationPresence,
): Record<string, CollaborationPresence> {
  const existing = presences[next.clientId];
  if (existing && existing.updatedAt >= next.updatedAt) return presences;
  return {
    ...presences,
    [next.clientId]: next,
  };
}

function isStaleProjectFileSnapshot(currentUpdatedAt: string | undefined, nextUpdatedAt: string) {
  if (!currentUpdatedAt) return false;
  const currentTime = Date.parse(currentUpdatedAt);
  const nextTime = Date.parse(nextUpdatedAt);
  if (!Number.isNaN(currentTime) && !Number.isNaN(nextTime)) {
    return nextTime < currentTime;
  }
  return nextUpdatedAt < currentUpdatedAt;
}

function activePresencesForFile(
  presences: Record<string, CollaborationPresence>,
  filePath: string,
  now: number,
): CollaborationPresence[] {
  return Object.values(presences)
    .filter((presence) => presence.status !== "left" && presence.filePath === filePath && new Date(presence.expiresAt).getTime() > now)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function isCollaborationPresence(value: unknown): value is CollaborationPresence {
  if (!value || typeof value !== "object") return false;
  const presence = value as CollaborationPresence;
  return presence.schema === "fold.presence.v1"
    && typeof presence.clientId === "string"
    && typeof presence.filePath === "string"
    && presence.persona?.schema === "fold.persona.v1"
    && (presence.mode === "read" || presence.mode === "edit")
    && (presence.status === "viewing" || presence.status === "editing" || presence.status === "left")
    && (!presence.activity || presence.activity === "idle" || presence.activity === "typing" || presence.activity === "commenting")
    && typeof presence.updatedAt === "string"
    && typeof presence.expiresAt === "string";
}

function isFileVersion(value: unknown): value is FileVersion {
  if (!value || typeof value !== "object") return false;
  const version = value as FileVersion;
  return version.schema === "fold.file_version.v1"
    && typeof version.id === "string"
    && typeof version.title === "string"
    && typeof version.filePath === "string"
    && typeof version.markdown === "string"
    && typeof version.createdAt === "string"
    && typeof version.authorPersonaId === "string"
    && version.persona?.schema === "fold.persona.v1";
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

function nextSelectedPathAfterDeletion(files: Record<string, string>, primaryPath: string) {
  if (primaryPath && Object.prototype.hasOwnProperty.call(files, primaryPath)) return primaryPath;
  return Object.keys(files).sort()[0] || DEFAULT_PROJECT_FILE_PATH;
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
  comments: ChatComment[],
  proposals: Proposal[],
  updatedAtByPath: Record<string, string> = {},
  presencesByPath: Map<string, CollaborationPresence[]> = new Map(),
  conflictsByPath: Record<string, FileConflict> = {},
  includeLegacyLiveFile = true,
  defaultRecordFilePath = LIVE_FILE_PATH,
) {
  const filesByPath = new Map<string, { name: string; path: string; folder: string; status?: string; markdown?: string }>();
  const commentCounts = countRecordsByFile(comments.filter((comment) => !comment.resolvedAt), defaultRecordFilePath);
  const pendingProposalCounts = countRecordsByFile(proposals.filter((proposal) => proposal.status === "pending"), defaultRecordFilePath);
  const addFile = (path: string, status?: string, markdown = "") => {
    const normalized = normalizeProjectFilePath(path);
    if (!normalized) return;
    filesByPath.set(normalized, {
      name: normalized.split("/").pop() || normalized,
      path: normalized,
      folder: folderForPath(normalized),
      status,
      markdown,
    });
  };

  Object.entries(virtualFiles).forEach(([path, markdown]) => addFile(path, undefined, markdown));
  if (includeLegacyLiveFile) {
    filesByPath.set(LIVE_FILE_PATH, {
      name: "launch-review.md",
      path: LIVE_FILE_PATH,
      folder: "reports",
      status: "live",
    });
  }

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
    status: file.status,
    updatedAt: updatedAtByPath[file.path],
    commentCount: commentCounts.get(file.path) || 0,
    pendingCount: pendingProposalCounts.get(file.path) || 0,
    conflictCount: conflictsByPath[file.path] ? 1 : 0,
    activePresences: presencesByPath.get(file.path) || [],
  }));
}

function deriveProjectName(
  virtualFiles: Record<string, string>,
  primaryPath: string,
) {
  const candidatePaths = [
    normalizeProjectFilePath(primaryPath),
    DEFAULT_PROJECT_FILE_PATH,
    "README.md",
    "docs/README.md",
    "docs/PLAN.md",
    ...Object.keys(virtualFiles).sort(),
  ].filter(Boolean);

  for (const path of candidatePaths) {
    const markdown = virtualFiles[path];
    const title = firstMarkdownHeading(markdown);
    if (title) return title;
  }

  return "Fold project";
}

function firstMarkdownHeading(markdown = "") {
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,2})\s+(.+?)\s*#*\s*$/.exec(line.trim());
    if (!match) continue;
    const title = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();
    if (title) return title.slice(0, 80);
  }
  return "";
}

function activePresencesByFile(
  presences: Record<string, CollaborationPresence>,
  now: number,
): Map<string, CollaborationPresence[]> {
  const byPath = new Map<string, CollaborationPresence[]>();
  for (const presence of Object.values(presences)) {
    if (presence.status === "left") continue;
    if (new Date(presence.expiresAt).getTime() <= now) continue;
    const list = byPath.get(presence.filePath) || [];
    list.push(presence);
    byPath.set(presence.filePath, list);
  }
  for (const [path, list] of Array.from(byPath.entries())) {
    byPath.set(path, list.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }
  return byPath;
}

function countRecordsByFile(records: Array<{ filePath?: string }>, defaultFilePath = LIVE_FILE_PATH) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const path = record.filePath || defaultFilePath;
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
  const warningLines = warnings.length
    ? ["", "Reachability warning:", ...warnings.map((warning) => `- ${warning}`)]
    : [];
  return {
    alias,
    skillUrl,
    warnings,
    text: [
      "Join this Fold project room:",
      ...warningLines,
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
    "docs/architecture/e2ee.md": [
      "# E2EE Architecture",
      "",
      "Fold keeps Markdown, comments, proposals, project snapshots, personas, and presence activity inside encrypted room records.",
      "",
      "## Current Boundaries",
      "",
      "- Server-visible: room id, sequence, sender id.",
      "- Client-visible: decrypted Markdown and collaboration payloads.",
      "- Open question: signed checkpoints for fork detection.",
    ].join("\n"),
    "docs/architecture/project-sync.md": [
      "# Project Sync",
      "",
      "Project files are replayed from encrypted records and presented as a normal Markdown tree.",
      "",
      "## Goals",
      "",
      "- Preserve portable `.md` files.",
      "- Keep project navigation fast.",
      "- Let agents propose changes without direct mutation.",
    ].join("\n"),
    "docs/runbooks/agent-handoff.md": [
      "# Agent Handoff Runbook",
      "",
      "Use the Copy agent handoff action to copy the secure CLI handoff for this project.",
      "",
      "## Flow",
      "",
      "1. Save the room alias.",
      "2. Export the encrypted project locally.",
      "3. Submit proposals instead of overwriting accepted content.",
    ].join("\n"),
    "docs/runbooks/review-flow.md": [
      "# Review Flow",
      "",
      "Review work should stay close to the Markdown file.",
      "",
      "- Open unresolved comments from the toolbar.",
      "- Accept or reject pending suggestions in the review drawer.",
      "- Keep resolved notes quiet unless explicitly opened.",
    ].join("\n"),
    "research/renderer-fidelity.md": [
      "# Renderer Fidelity",
      "",
      "Read mode should stay sanitized and Markdown-native.",
      "",
      "## Cases",
      "",
      "- Frontmatter properties",
      "- GFM tables and task lists",
      "- Math and code fences",
      "- Mermaid diagrams",
    ].join("\n"),
    "research/milkdown-prototype.md": [
      "# Milkdown Prototype",
      "",
      "Milkdown remains the first polished editor candidate after Markdown round-trip checks.",
      "",
      "## Measure",
      "",
      "- Import/export fidelity",
      "- Selection comment behavior",
      "- Source-mode escape hatch",
    ].join("\n"),
    "notes/meeting-product-review.md": [
      "# Product Review Notes",
      "",
      "The workspace should feel like a real project editor rather than a single shared document.",
      "",
      "- Keep the file tree visible on desktop.",
      "- Keep comments inline.",
      "- Keep agent handoff near the top chrome.",
    ].join("\n"),
    "notes/meeting-security-review.md": [
      "# Security Review Notes",
      "",
      "The UI should be clear about E2EE without turning security state into a dashboard.",
      "",
      "- Show compact E2EE status.",
      "- Avoid implying the server can read Markdown.",
      "- Keep plaintext routing metadata documented.",
    ].join("\n"),
    "reports/e2ee-notes.md": [
      "# E2EE Notes",
      "",
      "The server stores encrypted room records and plaintext routing metadata only.",
      "",
      "Comments, proposals, personas, and Markdown payloads remain encrypted client-side.",
    ].join("\n"),
    "reports/agent-handoff-review.md": [
      "---",
      "title: Agent Handoff Review",
      "owner: product",
      "status: draft",
      "---",
      "",
      "# Agent Handoff Review",
      "",
      "This report is intentionally long enough to stress the Fold reading surface. It should feel like a real Markdown artifact created by a coding agent: dense, useful, and easy to scan without becoming a dashboard.",
      "",
      "## Summary",
      "",
      "Fold should let a human open a project, inspect what agents changed, and respond directly inside the Markdown file. The document should remain the center of gravity while comments, suggestions, and handoff controls stay close enough to use without taking over the page.",
      "",
      "- Markdown remains the durable source of truth.",
      "- Comments attach to selected text or the whole file.",
      "- Suggestions are reviewable before they change accepted content.",
      "- Agent handoff data stays encrypted with the room payloads.",
      "",
      "## Decisions",
      "",
      "| Area | Decision | Reason |",
      "| --- | --- | --- |",
      "| Document model | Markdown canonical | Agents already produce portable `.md` files. |",
      "| Collaboration | Inline first | Readers should not jump to a heavy side rail. |",
      "| Sharing | Room link plus key | The server should not read room content. |",
      "| Editor | Source-first for now | Round-trip fidelity matters more than block controls. |",
      "",
      "## Open Review Items",
      "",
      "- [x] Keep the file tree visible on desktop.",
      "- [x] Make mobile project navigation a drawer.",
      "- [x] Add quiet typing/commenting presence without exposing content to the server.",
      "- [x] Add encrypted named versions for restore points.",
      "- [ ] Decide whether production avatars should be vendored rather than remote.",
      "",
      "> Agent notes should be useful without becoming noisy. The best version of this surface feels like a calm project editor that happens to understand encrypted collaboration.",
      "",
      "## Proposed Agent Flow",
      "",
      "1. Human creates or opens a Fold project room.",
      "2. Human copies the secure agent handoff.",
      "3. Agent reads the room skill and exports the encrypted project locally.",
      "4. Agent proposes a Markdown change instead of mutating accepted content directly.",
      "5. Human reviews the suggestion inline, accepts it, rejects it, or asks for another pass.",
      "",
      "## Example Patch Command",
      "",
      "```bash",
      "fold propose ./fold-project \\",
      "  --room room-launch-review \\",
      "  --title \"Tighten handoff language\" \\",
      "  --comment \"Clarifies proposal-first workflow and E2EE boundaries.\" \\",
      "  --json",
      "```",
      "",
      "## Mermaid Diagram",
      "",
      "```mermaid",
      "flowchart LR",
      "  Human[Human reviewer] --> Room[Fold project room]",
      "  Room --> Agent[Agent export]",
      "  Agent --> Proposal[Encrypted proposal]",
      "  Proposal --> Review[Inline review]",
      "```",
      "",
      "## Notes For The Next Pass",
      "",
      "The long-document case should keep line length comfortable, preserve the quiet document-paper feel, and avoid turning every status into a badge. If the reader can scan this report, open a comment, and return to the same place without friction, the room is moving in the right direction.",
      "",
      "A second pass should test this same file in bright mode and with several overlapping comments. That will tell us whether annotations stay legible without making the Markdown feel over-marked.",
    ].join("\n"),
  };
}
