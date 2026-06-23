"use client";

import { Key, Server } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface RoomAccessGateProps {
  roomSecret: string;
  serverUrl: string;
  error?: string | null;
  onRoomSecretChange: (value: string) => void;
  onServerUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function RoomAccessGate({
  roomSecret,
  serverUrl,
  error,
  onRoomSecretChange,
  onServerUrlChange,
  onSubmit,
}: RoomAccessGateProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-studio p-4 text-ink">
      <div className="w-full max-w-md rounded-md border border-studio-line bg-studio-paper p-6 shadow-[0_14px_48px_rgba(0,0,0,0.28)]">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden className="fold-logo-mark h-9 w-9 shrink-0" />
          <div>
            <h1 className="text-base font-semibold text-ink">Open private project</h1>
            <p className="text-sm text-ink-muted">Fragment key required.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="room-secret" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Key className="h-4 w-4" />
              Project key
            </label>
            <Input
              id="room-secret"
              type="password"
              placeholder="Paste fragment key"
              value={roomSecret}
              onChange={(event) => onRoomSecretChange(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="server-url" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Server className="h-4 w-4" />
              Sync server
            </label>
            <Input
              id="server-url"
              type="text"
              value={serverUrl}
              onChange={(event) => onServerUrlChange(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full">
            Open encrypted project
          </Button>
        </form>
      </div>
    </div>
  );
}
