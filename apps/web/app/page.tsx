"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, Bot, Clock, FileText, Github, Inbox, Link2, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { toBase64Url } from "../lib/crypto";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

interface RecentRoom {
  roomId: string;
  name: string;
  visitedAt: string;
  source?: "created" | "joined" | "agent";
  archivedAt?: string;
  pendingCount?: number;
  unresolvedCount?: number;
  requestCount?: number;
}

type WorkspaceView = "recent" | "shared" | "agents" | "review" | "archive";

export default function HomePage() {
  const router = useRouter();
  const [pasteUrl, setPasteUrl] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("recent");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fold:recent-rooms");
    if (!stored) return;

    try {
      setRecentRooms(normalizeRecentRooms(JSON.parse(stored)));
    } catch {
      localStorage.removeItem("fold:recent-rooms");
    }
  }, []);

  const persistRecentRooms = (rooms: RecentRoom[]) => {
    setRecentRooms(rooms);
    localStorage.setItem("fold:recent-rooms", JSON.stringify(rooms));
  };

  const saveRoomToRecent = (roomId: string, name: string, source: NonNullable<RecentRoom["source"]>) => {
    const list: RecentRoom[] = [
      {
        ...recentRooms.find((room) => room.roomId === roomId),
        roomId,
        name,
        source,
        visitedAt: new Date().toISOString(),
        archivedAt: undefined,
      },
      ...recentRooms.filter((room) => room.roomId !== roomId),
    ].slice(0, 10);
    persistRecentRooms(list);
  };

  const handleJoinUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const value = pasteUrl.trim();
    if (!value) return;

    try {
      const url = new URL(value);
      const roomId = url.pathname.split("/").filter(Boolean).pop() || "";
      const matchKey = /#key=([a-zA-Z0-9_-]+)/.exec(url.hash);

      if (!roomId || !matchKey?.[1]) {
        window.alert("Paste a project link with /room/:id#key=...");
        return;
      }

      saveRoomToRecent(roomId, "Joined project", "joined");
      router.push(`/room/${roomId}#key=${matchKey[1]}`);
    } catch {
      window.alert("Paste a full project link.");
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const secretBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const roomSecret = toBase64Url(secretBytes);
      const roomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const roomId = toBase64Url(roomBytes);
      const currentParams = new URLSearchParams(window.location.search);
      const roomParams = new URLSearchParams();
      if (currentParams.get("template") === "demo") roomParams.set("template", "demo");
      const onboarding = currentParams.get("onboarding");
      if (onboarding) roomParams.set("onboarding", onboarding);
      const roomQuery = roomParams.toString() ? `?${roomParams.toString()}` : "";

      saveRoomToRecent(roomId, "Untitled project", "created");
      router.push(`/room/${roomId}${roomQuery}#key=${roomSecret}`);
    } catch (err) {
      window.alert(`Could not create project: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClearHistory = () => {
    setRecentRooms([]);
    localStorage.removeItem("fold:recent-rooms");
  };

  const handleOpenRoom = (room: RecentRoom) => {
    persistRecentRooms([
      {
        ...room,
        source: room.source || inferRoomSource(room),
        visitedAt: new Date().toISOString(),
      },
      ...recentRooms.filter((item) => item.roomId !== room.roomId),
    ].slice(0, 10));
    router.push(`/room/${room.roomId}`);
  };

  const handleSetArchived = (room: RecentRoom, archived: boolean) => {
    const next = recentRooms.map((item) => (
      item.roomId === room.roomId
        ? { ...item, archivedAt: archived ? new Date().toISOString() : undefined }
        : item
    ));
    persistRecentRooms(next);
    if (archived && workspaceView !== "archive") {
      const remainingInView = visibleRoomsForView(next, workspaceView).length;
      if (remainingInView === 0) setWorkspaceView("recent");
    }
  };

  const activeRooms = recentRooms.filter((room) => !room.archivedAt);
  const visibleRooms = visibleRoomsForView(recentRooms, workspaceView);
  const workspaceViews = workspaceViewItems(recentRooms);
  const currentView = workspaceViews.find((view) => view.id === workspaceView) || workspaceViews[0];

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-studio text-ink">
        <header className="border-b border-studio-line bg-studio-paper">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span aria-hidden className="fold-logo-mark h-8 w-8 shrink-0" />
              <div>
                <h1 className="text-sm font-medium">Fold</h1>
                <p className="text-xs text-ink-muted">Encrypted Markdown projects</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" aria-label="GitHub">
                    <a href="https://github.com/wanderingspirit03/fold" target="_blank" rel="noreferrer">
                      <Github className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open repository</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="grid min-h-[calc(100dvh-56px)] content-start items-start md:grid-cols-[300px_minmax(0,1fr)] md:content-stretch md:items-stretch">
          <aside className="border-b border-studio-line bg-studio-paper md:border-b-0 md:border-r">
            <div className="flex h-11 items-center justify-between border-b border-studio-line px-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-ink-muted" />
                <h2 className="text-xs font-medium uppercase text-ink-subtle">Workspace</h2>
              </div>
              {recentRooms.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleClearHistory} aria-label="Clear recent projects">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear recent</TooltipContent>
                </Tooltip>
              )}
            </div>

            <nav aria-label="Project workspace views" className="grid grid-cols-2 gap-1 border-b border-studio-line p-2 md:grid-cols-1">
              {workspaceViews.map((view) => {
                const Icon = view.icon;
                const selected = workspaceView === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setWorkspaceView(view.id)}
                    className={`flex h-9 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong ${
                      selected
                        ? "bg-midnight-soft text-ink"
                        : "text-ink-muted hover:bg-studio-sunken hover:text-ink"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{view.label}</span>
                    <span className="font-mono text-[11px] text-ink-subtle">{view.count}</span>
                  </button>
                );
              })}
            </nav>

            <div className="max-h-[260px] overflow-y-auto p-2 md:max-h-none">
              {visibleRooms.length === 0 ? (
                <div className="flex min-h-28 items-center gap-3 rounded-md px-2 text-ink-subtle">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-studio-sunken">
                    <currentView.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-ink-muted">{emptyViewLabel(workspaceView, activeRooms.length)}</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {visibleRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="group flex min-h-11 items-center gap-1 rounded-md px-1 transition-colors hover:bg-studio-sunken"
                    >
                      <button
                        type="button"
                        title={`Project id ${room.roomId}`}
                        onClick={() => handleOpenRoom(room)}
                        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{projectDisplayName(room)}</span>
                          <span className="block truncate text-[11px] text-ink-subtle">{recentProjectDetail(room)}</span>
                        </span>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={room.archivedAt ? `Restore ${projectDisplayName(room)}` : `Archive ${projectDisplayName(room)}`}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-subtle opacity-100 transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            onClick={() => handleSetArchived(room, !room.archivedAt)}
                          >
                            {room.archivedAt ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{room.archivedAt ? "Restore" : "Archive"}</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 px-4 py-6 sm:px-8 lg:px-12 lg:py-8">
            <div className="mx-auto w-full max-w-2xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Open project</h2>
                  <p className="mt-1 text-sm text-ink-muted">Private Markdown workspace.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-studio-line bg-studio-paper">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-studio-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-midnight-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-midnight-strong">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{isCreating ? "Creating project" : "Create project"}</span>
                      <span className="block truncate text-xs text-ink-subtle">Start a private Markdown workspace</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                </button>

                <form onSubmit={handleJoinUrl} className="border-t border-studio-line px-4 py-3">
                  <label htmlFor="room-link" className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-muted">
                    <Link2 className="h-4 w-4 text-ink-subtle" />
                    Join project
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="room-link"
                      type="text"
                      placeholder="https://.../room/id#key=..."
                      value={pasteUrl}
                      onChange={(event) => setPasteUrl(event.target.value)}
                      required
                    />
                    <Button type="submit" variant="outline">
                      Join
                    </Button>
                  </div>
                </form>
              </div>

              {activeRooms.length > 0 && (
                <div className="mt-5 border-t border-studio-line pt-4">
                  <h3 className="text-xs font-medium uppercase text-ink-subtle">Local index</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <WorkspaceStat label="active" value={activeRooms.length} />
                    <WorkspaceStat label="shared" value={recentRooms.filter((room) => !room.archivedAt && inferRoomSource(room) === "joined").length} />
                    <WorkspaceStat label="review" value={recentRooms.filter((room) => !room.archivedAt && roomNeedsReview(room)).length} />
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function WorkspaceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-studio-line text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-mono text-xs text-ink-muted">{value}</span>
    </div>
  );
}

function projectDisplayName(room: RecentRoom) {
  return /^Project [a-zA-Z0-9_-]{4,}$/.test(room.name) ? "Joined project" : room.name;
}

function recentProjectDetail(room: RecentRoom) {
  const date = new Date(room.visitedAt);
  const source = roomSourceLabel(inferRoomSource(room));
  const reviewText = roomReviewSummary(room);
  if (Number.isNaN(date.getTime())) return `${source}${reviewText}`;
  return `${source} · ${date.toLocaleDateString([], { month: "short", day: "numeric" })}${reviewText}`;
}

function roomReviewSummary(room: RecentRoom) {
  const parts = [
    room.requestCount ? `${room.requestCount} ${room.requestCount === 1 ? "request" : "requests"}` : "",
    room.pendingCount ? `${room.pendingCount} ${room.pendingCount === 1 ? "suggestion" : "suggestions"}` : "",
    room.unresolvedCount ? `${room.unresolvedCount} ${room.unresolvedCount === 1 ? "comment" : "comments"}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
}

function workspaceViewItems(rooms: RecentRoom[]) {
  return [
    {
      id: "recent" as const,
      label: "Recent",
      icon: Clock,
      count: rooms.filter((room) => !room.archivedAt).length,
    },
    {
      id: "shared" as const,
      label: "Shared",
      icon: Users,
      count: rooms.filter((room) => !room.archivedAt && inferRoomSource(room) === "joined").length,
    },
    {
      id: "agents" as const,
      label: "Agents",
      icon: Bot,
      count: rooms.filter((room) => !room.archivedAt && inferRoomSource(room) === "agent").length,
    },
    {
      id: "review" as const,
      label: "Review",
      icon: Inbox,
      count: rooms.filter((room) => !room.archivedAt && roomNeedsReview(room)).length,
    },
    {
      id: "archive" as const,
      label: "Archive",
      icon: Archive,
      count: rooms.filter((room) => room.archivedAt).length,
    },
  ];
}

function visibleRoomsForView(rooms: RecentRoom[], view: WorkspaceView) {
  const sorted = [...rooms].sort((left, right) => dateValue(right.visitedAt) - dateValue(left.visitedAt));
  if (view === "archive") return sorted.filter((room) => room.archivedAt);
  const active = sorted.filter((room) => !room.archivedAt);
  if (view === "shared") return active.filter((room) => inferRoomSource(room) === "joined");
  if (view === "agents") return active.filter((room) => inferRoomSource(room) === "agent");
  if (view === "review") return active.filter(roomNeedsReview);
  return active;
}

function normalizeRecentRooms(value: unknown): RecentRoom[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((room): room is RecentRoom => (
      Boolean(room) &&
      typeof room === "object" &&
      typeof (room as RecentRoom).roomId === "string"
    ))
    .map((room) => ({
      roomId: room.roomId,
      name: typeof room.name === "string" ? room.name : "Joined project",
      visitedAt: typeof room.visitedAt === "string" ? room.visitedAt : new Date(0).toISOString(),
      source: normalizeRoomSource(room.source) || inferRoomSource(room),
      archivedAt: typeof room.archivedAt === "string" ? room.archivedAt : undefined,
      pendingCount: typeof room.pendingCount === "number" ? room.pendingCount : undefined,
      unresolvedCount: typeof room.unresolvedCount === "number" ? room.unresolvedCount : undefined,
      requestCount: typeof room.requestCount === "number" ? room.requestCount : undefined,
    }));
}

function normalizeRoomSource(value: unknown): RecentRoom["source"] | undefined {
  return value === "created" || value === "joined" || value === "agent" ? value : undefined;
}

function inferRoomSource(room: RecentRoom): NonNullable<RecentRoom["source"]> {
  if (room.source) return room.source;
  if (/agent/i.test(room.name)) return "agent";
  if (/untitled|created/i.test(room.name)) return "created";
  return "joined";
}

function roomSourceLabel(source: NonNullable<RecentRoom["source"]>) {
  if (source === "created") return "Created here";
  if (source === "agent") return "Created by agent";
  return "Shared link";
}

function roomNeedsReview(room: RecentRoom) {
  return (room.pendingCount || 0) + (room.unresolvedCount || 0) + (room.requestCount || 0) > 0;
}

function emptyViewLabel(view: WorkspaceView, activeCount: number) {
  if (view === "recent") return activeCount > 0 ? "No active projects" : "No recent projects";
  if (view === "shared") return "No shared projects";
  if (view === "agents") return "No agent-created projects";
  if (view === "review") return "No projects need review";
  return "Archive is empty";
}

function dateValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
