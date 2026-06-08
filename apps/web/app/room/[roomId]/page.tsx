"use client";

import React, { useEffect, useRef, useState } from "react";
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
const DOCUMENT_SENDER_ID = "mdroom-cli:document";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId as string;

  const [roomSecret, setRoomSecret] = useState("");
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8787");
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [clientId] = useState(() => `web-client-${Math.random().toString(36).slice(2, 11)}`);

  const [markdown, setMarkdown] = useState("");
  const [editMode, setEditMode] = useState<"read" | "edit">("read");
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
  const [newCommentType, setNewCommentType] = useState<ChatComment["type"]>("note");
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [selectedQuote, setSelectedQuote] = useState("");

  const yDocRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const expectedSeqRef = useRef(1);
  const keyRef = useRef<CryptoKey | null>(null);

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

    if (rec.senderId.startsWith("mdroom-cli:proposal")) {
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
        anchorType: parsed.anchorType || parsed.anchor?.anchorType,
        selectedQuote: parsed.selectedQuote || parsed.anchor?.selectedQuote,
        createdFromMarkdown: parsed.createdFromMarkdown || parsed.anchor?.createdFromMarkdown,
        beforeContext: parsed.beforeContext || parsed.anchor?.beforeContext,
        afterContext: parsed.afterContext || parsed.anchor?.afterContext,
      }));
      return;
    }

    if (rec.senderId.startsWith("mdroom-cli:event")) {
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
      setComments((prev) => [parsed, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
      const documentUpdate = createMarkdownReplacementUpdate(
        yTextRef.current.toString(),
        proposal.proposedMarkdown,
      );
      const encryptedDocument = await encryptUpdate(documentUpdate, keyRef.current, {
        roomId,
        senderId: DOCUMENT_SENDER_ID,
      });
      const documentResponse = await postEncryptedRecord(DOCUMENT_SENDER_ID, encryptedDocument);
      if (!documentResponse.ok) throw new Error(`Server returned ${documentResponse.status}`);

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
        senderId: `mdroom-cli:event:${eventRecord.id}`,
      });
      const eventResponse = await postEncryptedRecord(`mdroom-cli:event:${eventRecord.id}`, encryptedEvent);
      if (!eventResponse.ok) throw new Error(`Server returned ${eventResponse.status}`);
      setSelectedProposal(null);
    } catch (err) {
      setSyncError(`Could not accept proposal: ${String(err)}`);
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
        senderId: `mdroom-cli:event:${eventRecord.id}`,
      });
      await postEncryptedRecord(`mdroom-cli:event:${eventRecord.id}`, encryptedEvent);
      setSelectedProposal(null);
    } catch (err) {
      setSyncError(`Could not reject proposal: ${String(err)}`);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !keyRef.current || !localMyPersona) return;

    try {
      const id = Math.random().toString(36).slice(2, 11);
      const record: ChatComment = {
        id,
        authorPersonaId: localMyPersona.id,
        persona: localMyPersona,
        text: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        type: newCommentType,
        ...createCommentAnchor(markdown, selectedQuote),
      };
      const encrypted = await encryptUpdate(encoder.encode(JSON.stringify(record)), keyRef.current, {
        roomId,
        senderId: `web-client:comment:${id}`,
      });
      const res = await postEncryptedRecord(`web-client:comment:${id}`, encrypted);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setNewCommentText("");
    } catch (err) {
      setSyncError(`Could not post comment: ${String(err)}`);
    }
  };

  const focusComposer = () => {
    setComposerFocusToken((current) => current + 1);
  };

  const handleAddNoteAtSelection = () => {
    setNewCommentType("note");
    setNewCommentText((current) => current || "");
    focusComposer();
  };

  const handleAskAgentAtSelection = () => {
    setNewCommentType("request");
    setNewCommentText(`Please review this passage and suggest a precise Markdown edit:\n\n"${selectedQuote}"`);
    focusComposer();
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
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${roomId || "document"}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const pendingCount = proposals.filter((proposal) => proposal.status === "pending").length;
  const participants = uniquePersonas(proposals, comments, localMyPersona);

  return (
    <>
      <RoomShell
        roomId={roomId}
        connected={isConnected}
        ready={syncProgress}
        recordCount={logRecords.length}
        pendingCount={pendingCount}
        persona={localMyPersona}
        mode={editMode}
        error={syncError}
        onBack={() => router.push("/")}
        onExport={handleDownloadMarkdown}
        onModeChange={setEditMode}
        document={
          <DocumentSurface
            mode={editMode}
            markdown={markdown}
            selectedQuote={selectedQuote}
            onSelectedQuoteChange={setSelectedQuote}
            onAddNoteAtSelection={handleAddNoteAtSelection}
            onAskAgentAtSelection={handleAskAgentAtSelection}
            onMarkdownChange={(value) => {
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
            comments={comments}
            proposals={proposals}
            timeline={timeline}
            participants={participants}
            selectedQuote={selectedQuote}
            newCommentText={newCommentText}
            newCommentType={newCommentType}
            composerFocusToken={composerFocusToken}
            onNewCommentTextChange={setNewCommentText}
            onNewCommentTypeChange={setNewCommentType}
            onPostComment={handlePostComment}
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
