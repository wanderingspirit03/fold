"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Key,
  MessageSquare,
  Pencil,
  Server,
  Users,
  XCircle,
} from "lucide-react";
import MarkdownRenderer from "../../../components/MarkdownRenderer";
import MarkdownTextareaEditor from "../../../components/MarkdownTextareaEditor";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Textarea } from "../../../components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  deriveRoomKey,
  decryptUpdate,
  encryptUpdate,
  EncryptedPayload,
} from "../../../lib/crypto";
import { cn } from "../../../lib/utils";
import type { RoomPersona } from "../../../lib/personas";

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface Proposal {
  id: string;
  title: string;
  comment: string;
  authorPersonaId: string;
  persona: RoomPersona;
  proposedMarkdown: string;
  createdAt: string;
  status: ProposalStatus;
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
  type: "note" | "question" | "blocker" | "decision" | "uncertainty";
}

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
  const [rightPanelTab, setRightPanelTab] = useState<"review" | "timeline" | "comments" | "personas">("review");

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
    setLocalMyPersona(assignWebPersona(roomId, clientId));
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
      <div className="flex min-h-dvh items-center justify-center bg-white p-4">
        <div className="w-full max-w-md rounded-xl border border-line-soft bg-white p-6 shadow-[0_0_18px_rgba(208,214,215,0.32)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-xs font-medium text-white">
              MD
            </div>
            <div>
              <h1 className="text-base font-medium text-ink">Room access</h1>
              <p className="text-sm text-ink-muted">Enter the fragment key.</p>
            </div>
          </div>

          <form onSubmit={handleConfigureKey} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="room-secret" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Key className="h-4 w-4" />
                Key
              </label>
              <Input
                id="room-secret"
                type="password"
                placeholder="Paste key"
                value={roomSecret}
                onChange={(event) => setRoomSecret(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="server-url" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Server className="h-4 w-4" />
                Server
              </label>
              <Input
                id="server-url"
                type="text"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Unlock room
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const pendingCount = proposals.filter((proposal) => proposal.status === "pending").length;
  const participants = uniquePersonas(proposals, comments, localMyPersona);

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col bg-white text-ink">
        <header className="sticky top-0 z-20 border-b border-line-soft bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-mono text-sm font-semibold">{roomId?.slice(0, 12)}</h1>
                  <ConnectionBadge connected={isConnected} ready={syncProgress} />
                </div>
                <p className="text-xs text-ink-muted">{logRecords.length} records</p>
              </div>
            </div>

            <Tabs value={editMode} onValueChange={(value) => setEditMode(value as "read" | "edit")}>
              <TabsList>
                <TabsTrigger value="read">
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Read
                </TabsTrigger>
                <TabsTrigger value="edit">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {localMyPersona && (
                <Badge className="hidden gap-2 sm:inline-flex">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: localMyPersona.color }}
                  />
                  {localMyPersona.name}
                </Badge>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleDownloadMarkdown} aria-label="Export Markdown">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Markdown</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {syncError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {syncError}
          </div>
        )}

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-3xl">
              {editMode === "read" ? (
                <div className="min-h-[620px] rounded-xl border border-line-soft bg-white px-6 py-8 shadow-[0_0_18px_rgba(208,214,215,0.28)] sm:px-12">
                  {markdown.trim() ? (
                    <MarkdownRenderer content={markdown} />
                  ) : (
                    <EmptyState
                      icon={<FileText className="h-5 w-5" />}
                      title="Empty document"
                      text="Switch to Edit to start."
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <MarkdownTextareaEditor
                    initialMarkdown={markdown}
                    onChange={(value) => {
                      if (!yTextRef.current || value === yTextRef.current.toString()) return;
                      yDocRef.current?.transact(() => {
                        yTextRef.current!.delete(0, yTextRef.current!.length);
                        yTextRef.current!.insert(0, value);
                      }, "local");
                    }}
                  />
                  <div className="rounded-xl border border-line-soft bg-bone p-3 text-sm text-ink-muted">
                    Changes sync privately.
                  </div>
                </div>
              )}
            </div>
          </main>

          <aside className="border-t border-line-soft bg-bone lg:border-l lg:border-t-0">
            <Tabs value={rightPanelTab} onValueChange={(value) => setRightPanelTab(value as typeof rightPanelTab)} className="flex h-full flex-col">
              <div className="border-b border-line-soft bg-white p-3">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="review">Proposals</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="personas">People</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-[360px] flex-1 overflow-y-auto p-4">
                <TabsContent value="review" className="mt-0 space-y-3">
                  <PanelHeader icon={<CheckCircle className="h-4 w-4" />} title="Proposals" count={pendingCount} />
                  {proposals.length === 0 ? (
                    <EmptyState
                      icon={<CheckCircle className="h-5 w-5" />}
                      title="No proposals"
                      text="Accepted and pending changes show here."
                    />
                  ) : (
                    <div className="space-y-2">
                      {proposals.map((proposal) => (
                        <button
                          key={proposal.id}
                          type="button"
                          onClick={() => setSelectedProposal(proposal)}
                          className="w-full rounded-xl border border-line-soft bg-white p-3 text-left transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <StatusBadge status={proposal.status} />
                            <span className="font-mono text-xs text-ink-subtle">
                              {formatTime(proposal.createdAt)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm font-medium text-ink">{proposal.title}</p>
                          <PersonaLine persona={proposal.persona} />
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="comments" className="mt-0 space-y-4">
                  <PanelHeader icon={<MessageSquare className="h-4 w-4" />} title="Comments" count={comments.length} />
                  <form onSubmit={handlePostComment} className="space-y-2 rounded-xl border border-line-soft bg-white p-3">
                    <Textarea
                      aria-label="Comment"
                      placeholder="Add comment"
                      rows={3}
                      value={newCommentText}
                      onChange={(event) => setNewCommentText(event.target.value)}
                      required
                    />
                    <div className="flex items-center justify-between gap-2">
                      <select
                        aria-label="Comment type"
                        className="h-8 rounded-lg border border-line-soft bg-white px-2 text-xs text-ink-muted"
                        value={newCommentType}
                        onChange={(event) => setNewCommentType(event.target.value as ChatComment["type"])}
                      >
                        <option value="note">Note</option>
                        <option value="question">Question</option>
                        <option value="blocker">Blocker</option>
                        <option value="decision">Decision</option>
                        <option value="uncertainty">Uncertainty</option>
                      </select>
                      <Button type="submit" size="sm">
                        Add
                      </Button>
                    </div>
                  </form>

                  {comments.length === 0 ? (
                    <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No comments" text="Room notes appear here." />
                  ) : (
                    <div className="space-y-2">
                      {comments.map((comment) => (
                        <div key={comment.id} className="rounded-xl border border-line-soft bg-white p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <PersonaLine persona={comment.persona} compact />
                            <Badge variant="muted" className="capitalize">
                              {comment.type}
                            </Badge>
                          </div>
                          <p className="text-sm leading-6 text-ink-muted">{comment.text}</p>
                          <p className="mt-2 font-mono text-xs text-ink-subtle">{formatTime(comment.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-0 space-y-3">
                  <PanelHeader icon={<Activity className="h-4 w-4" />} title="Timeline" count={timeline.length} />
                  {timeline.length === 0 ? (
                    <EmptyState icon={<Activity className="h-5 w-5" />} title="No events" text="Room events appear here." />
                  ) : (
                    <div className="space-y-3 border-l border-line-soft pl-4">
                      {timeline.map((event) => (
                        <div key={event.id} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ink-subtle" />
                          <p className="text-sm font-medium text-ink">{event.message}</p>
                          <p className="mt-1 font-mono text-xs text-ink-subtle">{formatTime(event.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="personas" className="mt-0 space-y-3">
                  <PanelHeader icon={<Users className="h-4 w-4" />} title="People" count={participants.length} />
                  {participants.map((persona) => (
                    <div key={persona.id} className="flex items-center gap-3 rounded-xl border border-line-soft bg-white p-3">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: persona.color || "#64748b" }}
                      >
                        {persona.name?.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{persona.name}</p>
                        <p className="text-xs text-ink-muted">{persona.label || "Participant"}</p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          </aside>
        </div>

        <Dialog open={Boolean(selectedProposal)} onOpenChange={(open) => !open && setSelectedProposal(null)}>
          <DialogContent>
            {selectedProposal && (
              <>
                <DialogHeader>
                  <div className="mb-2">
                    <StatusBadge status={selectedProposal.status} />
                  </div>
                  <DialogTitle>{selectedProposal.title}</DialogTitle>
                  <DialogDescription>{selectedProposal.comment || "Proposed Markdown replacement."}</DialogDescription>
                </DialogHeader>

                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line-soft bg-bone p-4">
                  <MarkdownRenderer content={selectedProposal.proposedMarkdown} />
                </div>

                {selectedProposal.status === "pending" && (
                  <DialogFooter>
                    <Button variant="outline" onClick={() => handleRejectProposal(selectedProposal)}>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button onClick={() => handleAcceptProposal(selectedProposal)}>
                      <CheckCircle className="h-4 w-4" />
                      Accept
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function ConnectionBadge({ connected, ready }: { connected: boolean; ready: boolean }) {
  if (!connected) return <Badge variant="danger">Offline</Badge>;
  if (!ready) return <Badge variant="warning">Syncing</Badge>;
  return <Badge variant="success">Live</Badge>;
}

function PanelHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        {icon}
        {title}
      </div>
      <Badge variant="muted">{count}</Badge>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-line-soft bg-white text-center">
      <div className="mb-2 text-ink-subtle">{icon}</div>
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      <p className="mt-1 text-xs text-ink-subtle">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge
      variant={status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning"}
      className="capitalize"
    >
      {status}
    </Badge>
  );
}

function PersonaLine({ persona, compact = false }: { persona?: RoomPersona; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", compact ? "" : "mt-2")}>
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: persona?.color || "#94a3b8" }}
      />
      <span className="truncate text-xs font-medium text-ink-muted">{persona?.name || "Unknown"}</span>
    </div>
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function assignWebPersona(roomId: string, participantFingerprint: string): RoomPersona {
  const seed = `${roomId}\0human\0${participantFingerprint}`;
  const hash = stableHash(seed);
  const names = ["Reader North", "Editor Vale", "Reviewer Stone", "Writer Quinn", "Archivist Reed", "Curator Lane"];
  const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#ca8a04", "#db2777", "#475569"];

  return {
    schema: "mdroom.persona.v1",
    id: stableHash(`persona\0${seed}`).toString(16).padStart(8, "0"),
    kind: "human",
    name: names[hash % names.length] ?? names[0],
    label: "Human",
    color: colors[(hash >>> 8) % colors.length] ?? colors[0],
    participantFingerprint,
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
