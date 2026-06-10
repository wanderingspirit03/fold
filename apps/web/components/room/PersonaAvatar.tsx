"use client";

import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface PersonaAvatarProps {
  persona?: RoomPersona | null;
  compact?: boolean;
  className?: string;
}

const STUDIO_AVATARS = [
  "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png",
  "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png",
  "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png",
  "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-16.png",
] as const;

export function PersonaAvatar({ persona, compact = false, className }: PersonaAvatarProps) {
  const seed = persona ? hashString(`${persona.id}:${persona.kind}:${persona.name}`) : 0;
  const sizeClass = compact ? "h-5 w-5" : "h-7 w-7";
  const avatarSrc = STUDIO_AVATARS[seed % STUDIO_AVATARS.length];
  const fallback = personaInitials(persona);

  return (
    <Avatar
      className={cn(
        "bg-transparent shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-1 ring-studio-paper",
        sizeClass,
        className,
      )}
      aria-hidden="true"
    >
      <AvatarImage src={avatarSrc} alt="" className="scale-110 rounded-full object-cover" />
      <AvatarFallback className="text-[9px] uppercase text-ink-muted">{fallback}</AvatarFallback>
    </Avatar>
  );
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function personaInitials(persona?: RoomPersona | null) {
  if (!persona?.name) return "F";
  const words = persona.name.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}
