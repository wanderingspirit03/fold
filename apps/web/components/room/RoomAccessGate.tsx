"use client";

import { Key, Server } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface RoomAccessGateProps {
  roomSecret: string;
  serverUrl: string;
  onRoomSecretChange: (value: string) => void;
  onServerUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function RoomAccessGate({
  roomSecret,
  serverUrl,
  onRoomSecretChange,
  onServerUrlChange,
  onSubmit,
}: RoomAccessGateProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-studio p-4 text-ink">
      <div className="w-full max-w-md rounded-[10px] border border-studio-line bg-document p-6 shadow-[0_18px_60px_rgba(50,43,34,0.12)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink font-mono text-xs font-semibold text-white">
            MD
          </div>
          <div>
            <h1 className="text-base font-semibold text-ink">Unlock room</h1>
            <p className="text-sm text-ink-muted">The key stays in the browser fragment.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="room-secret" className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Key className="h-4 w-4" />
              Room key
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
            Open encrypted studio
          </Button>
        </form>
      </div>
    </div>
  );
}
