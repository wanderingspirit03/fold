"use client";

import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../ui/avatar";

interface PersonaAvatarProps {
  persona?: RoomPersona | null;
  compact?: boolean;
  className?: string;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4768ff 0%, #8dd7c6 100%)",
  "linear-gradient(135deg, #0f766e 0%, #f2c572 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #f472b6 100%)",
  "linear-gradient(135deg, #1d4ed8 0%, #93c5fd 100%)",
] as const;

export function PersonaAvatar({ persona, compact = false, className }: PersonaAvatarProps) {
  const seed = persona ? hashString(`${persona.id}:${persona.kind}:${persona.name}`) : 0;
  const sizeClass = compact ? "h-5 w-5" : "h-7 w-7";
  const gradient = AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length];
  const fallback = personaInitials(persona);

  return (
    <Avatar
      className={cn("shadow-none", sizeClass, className)}
      aria-hidden="true"
      style={{ background: gradient }}
    >
      <AvatarFallback className="bg-transparent text-[10px] font-semibold uppercase text-white">{fallback}</AvatarFallback>
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
