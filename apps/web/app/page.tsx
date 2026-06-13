"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, FileText, Github, Link2, Plus, Trash2 } from "lucide-react";
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
  key: string;
  name: string;
  visitedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [pasteUrl, setPasteUrl] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fold:recent-rooms");
    if (!stored) return;

    try {
      setRecentRooms(JSON.parse(stored));
    } catch {
      localStorage.removeItem("fold:recent-rooms");
    }
  }, []);

  const saveRoomToRecent = (roomId: string, key: string, name: string) => {
    const list: RecentRoom[] = [
      { roomId, key, name, visitedAt: new Date().toISOString() },
      ...recentRooms.filter((room) => room.roomId !== roomId),
    ].slice(0, 10);
    setRecentRooms(list);
    localStorage.setItem("fold:recent-rooms", JSON.stringify(list));
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

      saveRoomToRecent(roomId, matchKey[1], "Joined project");
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

      saveRoomToRecent(roomId, roomSecret, "Untitled project");
      router.push(`/room/${roomId}#key=${roomSecret}`);
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
                <Clock className="h-4 w-4 text-ink-muted" />
                <h2 className="text-xs font-medium uppercase text-ink-subtle">Projects</h2>
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

            <div className="max-h-[220px] overflow-y-auto p-2 md:max-h-none">
              {recentRooms.length === 0 ? (
                <div className="flex min-h-28 items-center gap-3 rounded-md px-2 text-ink-subtle">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-studio-line bg-studio-sunken">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-ink-muted">No recent projects</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentRooms.map((room) => (
                    <button
                      key={room.roomId}
                      type="button"
                      title={`Project id ${room.roomId}`}
                      onClick={() => router.push(`/room/${room.roomId}#key=${room.key}`)}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-studio-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{projectDisplayName(room)}</span>
                        <span className="block truncate text-[11px] text-ink-subtle">{recentProjectDetail(room)}</span>
                      </span>
                    </button>
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
            </div>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function projectDisplayName(room: RecentRoom) {
  return /^Project [a-zA-Z0-9_-]{4,}$/.test(room.name) ? "Joined project" : room.name;
}

function recentProjectDetail(room: RecentRoom) {
  const date = new Date(room.visitedAt);
  if (Number.isNaN(date.getTime())) return "Private workspace";
  return `Private workspace · ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}
