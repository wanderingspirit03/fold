"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, FileText, Github, Link2, Plus, Trash2 } from "lucide-react";
import { toBase64Url } from "../lib/crypto";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
    const stored = localStorage.getItem("mdroom:recent-rooms");
    if (!stored) return;

    try {
      setRecentRooms(JSON.parse(stored));
    } catch {
      localStorage.removeItem("mdroom:recent-rooms");
    }
  }, []);

  const saveRoomToRecent = (roomId: string, key: string, name: string) => {
    const list: RecentRoom[] = [
      { roomId, key, name, visitedAt: new Date().toISOString() },
      ...recentRooms.filter((room) => room.roomId !== roomId),
    ].slice(0, 10);
    setRecentRooms(list);
    localStorage.setItem("mdroom:recent-rooms", JSON.stringify(list));
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
        window.alert("Paste a room link with /room/:id#key=...");
        return;
      }

      saveRoomToRecent(roomId, matchKey[1], `Room ${roomId.slice(0, 8)}`);
      router.push(`/room/${roomId}#key=${matchKey[1]}`);
    } catch {
      window.alert("Paste a full room link.");
    }
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const secretBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const roomSecret = toBase64Url(secretBytes);
      const roomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const roomId = toBase64Url(roomBytes);

      saveRoomToRecent(roomId, roomSecret, "Untitled room");
      router.push(`/room/${roomId}#key=${roomSecret}`);
    } catch (err) {
      window.alert(`Could not create room: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClearHistory = () => {
    setRecentRooms([]);
    localStorage.removeItem("mdroom:recent-rooms");
  };

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-white text-ink">
        <header className="border-b border-line-soft bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-medium text-white">
                MD
              </div>
              <div>
                <h1 className="text-sm font-medium">Agent MD Rooms</h1>
                <p className="text-xs text-ink-muted">Encrypted Markdown rooms</p>
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" aria-label="GitHub">
                  <a href="https://github.com/wanderingspirit03/agent-md-rooms" target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open repository</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-line-soft bg-white p-5 shadow-[0_0_18px_rgba(208,214,215,0.32)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Open a room</h2>
                <p className="mt-1 text-sm text-ink-muted">Create one, or join with a link.</p>
              </div>
              <Badge variant="muted">Local keys</Badge>
            </div>

            <div className="space-y-5">
              <Button className="w-full justify-between" onClick={handleCreateRoom} disabled={isCreating}>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {isCreating ? "Creating" : "Create room"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <form onSubmit={handleJoinUrl} className="space-y-2">
                <label htmlFor="room-link" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                  <Link2 className="h-4 w-4" />
                  Join room
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
          </section>

          <section className="rounded-xl border border-line-soft bg-bone p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-ink-muted" />
                <h2 className="text-sm font-medium">Recent</h2>
              </div>
              {recentRooms.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>

            {recentRooms.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-line-soft bg-white text-center">
                <FileText className="mb-2 h-5 w-5 text-ink-subtle" />
                <p className="text-sm font-medium text-ink-muted">No recent rooms</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRooms.map((room) => (
                  <button
                    key={room.roomId}
                    type="button"
                    onClick={() => router.push(`/room/${room.roomId}#key=${room.key}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line-soft bg-white p-3 text-left transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{room.name}</p>
                      <p className="truncate font-mono text-xs text-ink-muted">{room.roomId.slice(0, 12)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
