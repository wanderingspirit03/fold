"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Command,
  Download,
  File,
  FileText,
  FolderClosed,
  FolderOpen,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  MessageSquarePlus,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { RoomPersona } from "../../lib/personas";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ThemeToggle } from "../ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { PersonaAvatar } from "./PersonaAvatar";
import { SecurityStrip } from "./SecurityStrip";
import type { CollaborationPresence, RoomMode } from "./types";
import {
  getFirstEnabledIndex,
  getLastEnabledIndex,
  getNextEnabledIndex,
  isSubsequence,
  rankCommandPaletteItems,
} from "../../lib/command-palette";

interface RoomShellProps {
  roomId: string;
  projectName: string;
  files: ProjectFile[];
  selectedFilePath: string;
  connected: boolean;
  ready: boolean;
  recordCount: number;
  pendingCount: number;
  requestCount?: number;
  reviewCount: number;
  conflictCount?: number;
  selectedQuote?: string;
  persona?: RoomPersona | null;
  activePresences?: CollaborationPresence[];
  mode: RoomMode;
  error?: string | null;
  humanInvite?: HumanInvite | null;
  agentInvite?: AgentInvite | null;
  onBack: () => void;
  onExport: () => void;
  onModeChange: (mode: RoomMode) => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onImportFile: (file: File) => void;
  onRenameProject: (name: string) => void;
  onCopyProjectLink?: () => void;
  onFocusCommentComposer?: () => void;
  document: ReactNode;
  bench: ReactNode;
}

export function RoomShell({
  roomId,
  projectName,
  files,
  selectedFilePath,
  connected,
  ready,
  pendingCount,
  requestCount = 0,
  reviewCount,
  conflictCount = 0,
  selectedQuote = "",
  persona,
  activePresences = [],
  mode,
  error,
  humanInvite,
  agentInvite,
  onBack,
  onExport,
  onModeChange,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  onImportFile,
  onRenameProject,
  onCopyProjectLink,
  onFocusCommentComposer,
  document,
  bench,
}: RoomShellProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [projectFilesOpen, setProjectFilesOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [projectLinkCopied, setProjectLinkCopied] = useState(false);
  const [agentInviteCopied, setAgentInviteCopied] = useState(false);
  const [recentFilePaths, setRecentFilePaths] = useState<string[]>([]);
  const [tourReplayToken, setTourReplayToken] = useState(0);
  const [onboardingProgress, setOnboardingProgress] = useState<RoomOnboardingProgress>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const readModeCommentComposer = mode === "read" ? onFocusCommentComposer : undefined;
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? files[0],
    [files, selectedFilePath],
  );
  const selectedFileDetail = selectedFile ? filePathDetail(selectedFile) : "";
  const selectedFileSavedLabel = selectedFile?.updatedAt ? `Saved ${formatRelativeTime(selectedFile.updatedAt)}` : "";
  const recentStorageKey = `fold:recent-files:${roomId}`;
  const recentFiles = useMemo(
    () => recentFilePaths
      .map((path) => files.find((file) => file.path === path))
      .filter((file): file is ProjectFile => Boolean(file))
      .slice(0, 4),
    [files, recentFilePaths],
  );
  const reviewLabel = reviewCount > 0
    ? `Open review, ${reviewCount} ${reviewCount === 1 ? "item" : "items"}`
    : "Open review";
  const commentCount = Math.max(0, reviewCount - requestCount - pendingCount - conflictCount);
  const securityLabel = !connected ? "E2EE offline" : !ready ? "E2EE replaying" : "E2EE";
  const humanInviteHasWarnings = Boolean(humanInvite?.warnings?.length);
  const humanInviteAriaLabel = projectLinkCopied
    ? "Invite link copied"
    : humanInviteHasWarnings
      ? "Copy invite link with local network warning"
      : "Copy invite link";
  const humanInviteTooltip = projectLinkCopied
    ? "Copied"
    : humanInviteHasWarnings
      ? "Copy invite link, local URLs"
      : "Copy invite link";
  const agentInviteHasWarnings = Boolean(agentInvite?.warnings?.length);
  const agentInviteAriaLabel = agentInviteCopied
    ? "Agent handoff copied"
    : agentInviteHasWarnings
      ? "Copy agent handoff with local network warning"
      : "Copy agent handoff";
  const agentInviteTooltip = agentInviteCopied
    ? "Copied"
    : agentInviteHasWarnings
      ? "Copy agent handoff, local URLs"
      : "Copy agent handoff";

  useEffect(() => {
    if (!selectedFilePath) return;
    let storedPaths: string[] = [];
    try {
      const stored = window.localStorage.getItem(recentStorageKey);
      storedPaths = stored ? JSON.parse(stored) : [];
    } catch {
      storedPaths = [];
    }

    const next = [selectedFilePath, ...storedPaths.filter((path) => path !== selectedFilePath)].slice(0, 8);
    setRecentFilePaths(next);
    try {
      window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
    } catch {
      // Recent files are convenience state; failing to persist should not block navigation.
    }
  }, [recentStorageKey, selectedFilePath]);

  useEffect(() => {
    setOnboardingProgress(readRoomOnboardingProgress(roomId));
  }, [roomId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || commandOpen) return;
      if (projectFilesOpen) {
        event.preventDefault();
        setProjectFilesOpen(false);
        return;
      }
      if (reviewOpen) {
        event.preventDefault();
        setReviewOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandOpen, projectFilesOpen, reviewOpen]);

  const copyProjectLink = async () => {
    await copyText(humanInvite?.text || window.location.href);
    setProjectLinkCopied(true);
    updateOnboardingProgress({ inviteCopiedAt: new Date().toISOString() });
    window.setTimeout(() => setProjectLinkCopied(false), 1400);
    onCopyProjectLink?.();
  };
  const copyAgentInvite = async () => {
    if (!agentInvite) return;
    await copyText(agentInvite.text);
    setAgentInviteCopied(true);
    updateOnboardingProgress({ agentHandoffCopiedAt: new Date().toISOString() });
    window.setTimeout(() => setAgentInviteCopied(false), 1400);
  };
  const focusProjectTitle = () => {
    setProjectFilesOpen(true);
    window.requestAnimationFrame(() => {
      const titleButton = Array.from(window.document.querySelectorAll<HTMLButtonElement>("[data-project-title]"))
        .find((element) => element.offsetParent !== null);
      titleButton?.focus();
      titleButton?.click();
    });
  };
  const openProjectSetup = () => setTourReplayToken((token) => token + 1);
  const updateOnboardingProgress = (patch: RoomOnboardingProgress) => {
    setOnboardingProgress((current) => {
      const next = { ...current, ...patch };
      writeRoomOnboardingProgress(roomId, next);
      return next;
    });
  };
  const openImportPicker = () => importInputRef.current?.click();
  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onImportFile(file);
  };

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-studio text-ink">
        <input
          ref={importInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleImportFileChange}
        />
        <div className="grid min-h-dvh md:grid-cols-[286px_minmax(0,1fr)]">
          <ProjectFileSidebar
            roomId={roomId}
            projectName={projectName}
            files={files}
            recentFiles={recentFiles}
            onBack={onBack}
            onCopyProjectLink={copyProjectLink}
            onRenameProject={onRenameProject}
            projectLinkCopied={projectLinkCopied}
            humanInviteHasWarnings={humanInviteHasWarnings}
            humanInviteAriaLabel={humanInviteAriaLabel}
            humanInviteTooltip={humanInviteTooltip}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
            onImportFile={openImportPicker}
            onOpenReview={() => setReviewOpen(true)}
          />

          <div className="min-w-0 border-l border-studio-line bg-studio-sunken">
            <header className="sticky top-0 z-30 border-b border-studio-line bg-studio-paper/95 backdrop-blur">
              <div className="hidden h-12 items-center justify-between gap-3 px-4 md:flex">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileSwitcherButton
                    selectedFile={selectedFile}
                    detail={selectedFileDetail}
                    savedLabel={selectedFileSavedLabel}
                    securityLabel={securityLabel}
                    connected={connected}
                    ready={ready}
                    onOpen={() => setCommandOpen(true)}
                    showMetadata
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCommandOpen(true)}
                        aria-label="Open command palette"
                        className="hidden md:inline-flex"
                      >
                        <Command className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Command palette</TooltipContent>
                  </Tooltip>
                  <ThemeToggle />
                  <div data-onboarding-target="read-edit" className="hidden rounded-md border border-studio-line bg-studio-sunken p-0.5 md:flex">
                    <ModeButton active={mode === "read"} onClick={() => onModeChange("read")}>
                      <FileText className="h-3.5 w-3.5" />
                      Read
                    </ModeButton>
                    <ModeButton active={mode === "edit"} onClick={() => onModeChange("edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </ModeButton>
                  </div>
                  <PresenceStack presences={activePresences} fallbackPersona={persona} />
                  <ReviewStatusControl
                    commentCount={commentCount}
                    requestCount={requestCount}
                    pendingCount={pendingCount}
                    conflictCount={conflictCount}
                    reviewLabel={reviewLabel}
                    onAddComment={readModeCommentComposer}
                    onOpenReview={() => setReviewOpen(true)}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void copyAgentInvite()}
                        aria-label={agentInviteAriaLabel}
                        disabled={!agentInvite}
                        data-onboarding-target="agent-handoff"
                      >
                        {agentInviteCopied ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        <span className="sr-only" aria-live="polite">
                          {agentInviteCopied ? "Agent handoff copied" : ""}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{agentInviteTooltip}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onExport} aria-label="Export Markdown" className="hidden md:inline-flex">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export Markdown</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="md:hidden">
                <div className="flex h-12 items-center gap-1.5 px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setProjectFilesOpen(true)}
                    aria-label="Open project files"
                    className="h-11 w-11 shrink-0"
                    data-onboarding-target="project-files-toggle"
                  >
                    <FolderClosed className="h-4 w-4" />
                  </Button>
                  <FileSwitcherButton
                    selectedFile={selectedFile}
                    detail={selectedFileDetail}
                    savedLabel={selectedFileSavedLabel}
                    securityLabel={securityLabel}
                    connected={connected}
                    ready={ready}
                    onOpen={() => setCommandOpen(true)}
                    compact
                  />
                  <MobilePresenceHint presences={activePresences} />
                  <ReviewStatusControl
                    commentCount={commentCount}
                    requestCount={requestCount}
                    pendingCount={pendingCount}
                    conflictCount={conflictCount}
                    reviewLabel={reviewLabel}
                    onAddComment={readModeCommentComposer}
                    onOpenReview={() => setReviewOpen(true)}
                    mobile
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void copyAgentInvite()}
                        aria-label={agentInviteAriaLabel}
                        disabled={!agentInvite}
                        className="h-11 w-11 shrink-0"
                      >
                        {agentInviteCopied ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        <span className="sr-only" aria-live="polite">
                          {agentInviteCopied ? "Agent handoff copied" : ""}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{agentInviteTooltip}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex h-12 items-center justify-between gap-2 border-t border-studio-line px-2">
                  <div data-onboarding-target="read-edit" className="flex rounded-md border border-studio-line bg-studio-sunken p-0.5">
                    <ModeIconButton active={mode === "read"} label="Read mode" onClick={() => onModeChange("read")}>
                      <FileText className="h-3.5 w-3.5" />
                    </ModeIconButton>
                    <ModeIconButton active={mode === "edit"} label="Edit mode" onClick={() => onModeChange("edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </ModeIconButton>
                  </div>
                  <ThemeToggle className="h-11 w-11" />
                </div>
              </div>
              <SecurityStrip
                connected={connected}
                ready={ready}
                error={error}
              />
            </header>

            <main className="min-w-0 px-3 py-4 sm:px-6 lg:px-8 lg:py-7">{document}</main>
          </div>
        </div>

        {projectFilesOpen && (
          <>
            <div className="fixed inset-y-0 left-0 z-50 w-[330px] max-w-[calc(100vw-2rem)] border-r border-studio-line bg-studio-paper shadow-[24px_0_80px_rgba(0,0,0,0.45)] md:hidden">
              <ProjectFilesHeader
                roomId={roomId}
                projectName={projectName}
                onBack={onBack}
                onCopyProjectLink={copyProjectLink}
                onRenameProject={onRenameProject}
                projectLinkCopied={projectLinkCopied}
                humanInviteHasWarnings={humanInviteHasWarnings}
                humanInviteAriaLabel={humanInviteAriaLabel}
                humanInviteTooltip={humanInviteTooltip}
                onClose={() => setProjectFilesOpen(false)}
              />
              <ProjectFilesBody
                key={`mobile-project-files:${roomId}`}
                roomId={roomId}
                files={files}
                recentFiles={recentFiles}
                autoFocusSearch
                onOpenReview={() => setReviewOpen(true)}
                onFileSelect={(path) => {
                  onFileSelect(path);
                  setProjectFilesOpen(false);
                }}
                onCreateFile={(path) => {
                  onCreateFile(path);
                  setProjectFilesOpen(false);
                }}
                onDeleteFile={(path) => {
                  onDeleteFile(path);
                }}
                onImportFile={() => {
                  openImportPicker();
                  setProjectFilesOpen(false);
                }}
              />
            </div>
            <button
              type="button"
              aria-label="Close project files"
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] md:hidden"
              onClick={() => setProjectFilesOpen(false)}
            />
          </>
        )}

        {reviewOpen && (
          <>
            <button
              type="button"
              aria-label="Close review overlay"
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setReviewOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[calc(100dvh-97px)] overflow-hidden rounded-t-md border-t border-studio-line bg-rail shadow-[0_-8px_24px_rgba(0,0,0,0.20)] md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-full md:max-w-[390px] md:rounded-none md:border-l md:border-t-0 md:shadow-[-8px_0_24px_rgba(0,0,0,0.18)]">
              <div className="flex h-12 items-center justify-between border-b border-studio-line px-4">
                <div className="flex items-center gap-2">
                  <PanelRightOpen className="h-4 w-4 text-midnight-strong" />
                  <span className="text-sm font-medium text-ink">Review</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReviewOpen(false)}
                  aria-label="Close review"
                  className="h-11 w-11 md:h-9 md:w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {bench}
            </div>
          </>
        )}

        {commandOpen && (
          <ProjectCommandPalette
            files={files}
            recentFiles={recentFiles}
            selectedFilePath={selectedFilePath}
            mode={mode}
            pendingCount={pendingCount}
            requestCount={requestCount}
            conflictCount={conflictCount}
            reviewCount={reviewCount}
            selectedQuote={selectedQuote}
            humanInviteHasWarnings={humanInviteHasWarnings}
            agentInviteHasWarnings={agentInviteHasWarnings}
            onClose={() => setCommandOpen(false)}
            onFileSelect={(path) => {
              onFileSelect(path);
              setProjectFilesOpen(false);
              setCommandOpen(false);
            }}
            onCreateFile={(path) => {
              onCreateFile(path);
              setProjectFilesOpen(false);
              setCommandOpen(false);
            }}
            onImportFile={() => {
              openImportPicker();
              setCommandOpen(false);
            }}
            onModeChange={(nextMode) => {
              onModeChange(nextMode);
              setCommandOpen(false);
            }}
            onExport={() => {
              onExport();
              setCommandOpen(false);
            }}
            onCopyProjectLink={() => {
              void copyProjectLink();
              setCommandOpen(false);
            }}
            onOpenReview={() => {
              setReviewOpen(true);
              setCommandOpen(false);
            }}
            onFocusCommentComposer={() => {
              onFocusCommentComposer?.();
              setCommandOpen(false);
            }}
            onCopyAgentInvite={() => {
              void copyAgentInvite();
              setCommandOpen(false);
            }}
            onOpenProjectSetup={() => {
              openProjectSetup();
              setCommandOpen(false);
            }}
          />
        )}
        <RoomOnboardingTour
          roomId={roomId}
          replayToken={tourReplayToken}
          projectName={projectName}
          files={files}
          reviewCount={reviewCount}
          progress={onboardingProgress}
          canCopyAgentInvite={Boolean(agentInvite)}
          onFocusProjectTitle={focusProjectTitle}
          onOpenProjectFiles={() => setProjectFilesOpen(true)}
          onCopyProjectLink={() => void copyProjectLink()}
          onOpenReview={() => setReviewOpen(true)}
          onCopyAgentInvite={() => void copyAgentInvite()}
          onProgressChange={updateOnboardingProgress}
        />
      </div>
    </TooltipProvider>
  );
}

interface AgentInvite {
  alias: string;
  skillUrl: string;
  warnings?: string[];
  text: string;
}

interface HumanInvite {
  url: string;
  warnings?: string[];
  text: string;
}

interface ProjectFile {
  name: string;
  path: string;
  folder: string;
  markdown?: string;
  active?: boolean;
  status?: string;
  updatedAt?: string;
  commentCount?: number;
  requestCount?: number;
  pendingCount?: number;
  conflictCount?: number;
  activePresences?: CollaborationPresence[];
}

const ROOM_ONBOARDING_AUTO_STORAGE_KEY = "fold:onboarding:auto-opened:v1";
const ROOM_ONBOARDING_LEGACY_STORAGE_KEY = "fold:onboarding:web-room:v1";
const ROOM_ONBOARDING_PROGRESS_STORAGE_PREFIX = "fold:onboarding:room:v1:";

type OnboardingSurface = "welcome" | "checklist";
type OnboardingItemId = "project-name" | "files" | "invite" | "review" | "agent";

interface RoomOnboardingProgress {
  completedAt?: string;
  dismissedAt?: string;
  inviteCopiedAt?: string;
  agentHandoffCopiedAt?: string;
}

function RoomOnboardingTour({
  roomId,
  replayToken,
  projectName,
  files,
  reviewCount,
  progress,
  canCopyAgentInvite,
  onFocusProjectTitle,
  onOpenProjectFiles,
  onCopyProjectLink,
  onOpenReview,
  onCopyAgentInvite,
  onProgressChange,
}: {
  roomId: string;
  replayToken: number;
  projectName: string;
  files: ProjectFile[];
  reviewCount: number;
  progress: RoomOnboardingProgress;
  canCopyAgentInvite: boolean;
  onFocusProjectTitle: () => void;
  onOpenProjectFiles: () => void;
  onCopyProjectLink: () => void;
  onOpenReview: () => void;
  onCopyAgentInvite: () => void;
  onProgressChange: (patch: RoomOnboardingProgress) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [surface, setSurface] = useState<OnboardingSurface>("welcome");
  const welcomeRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const items = getOnboardingItems({
    projectName,
    files,
    reviewCount,
    progress,
    canCopyAgentInvite,
    onFocusProjectTitle,
    onOpenProjectFiles,
    onCopyProjectLink,
    onOpenReview,
    onCopyAgentInvite,
  });

  useEffect(() => {
    const previewSurface = readOnboardingPreviewSurface();
    if (previewSurface) {
      setSurface(previewSurface);
      setIsOpen(true);
      return;
    }

    if (readOnboardingAutoState().openedAt) return;
    const timer = window.setTimeout(() => {
      writeOnboardingAutoState({ version: 1, roomId, openedAt: new Date().toISOString() });
      setSurface("welcome");
      setIsOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [roomId]);

  useEffect(() => {
    if (replayToken <= 0) return;
    setSurface("checklist");
    setIsOpen(true);
  }, [replayToken]);

  useEffect(() => {
    if (!isOpen || surface !== "welcome") return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => welcomeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, surface]);

  useEffect(() => {
    if (!isOpen || surface !== "welcome") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOnboarding("skipped");
      }
      if (event.key === "Tab") {
        trapOnboardingFocus(event, welcomeRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, surface]);

  if (!isOpen) return null;

  if (surface === "welcome") {
    return (
      <RoomWelcomeOnboarding
        dialogRef={welcomeRef}
        onClose={() => closeOnboarding("skipped")}
        onStartChecklist={() => setSurface("checklist")}
        onOpenProjectFiles={onOpenProjectFiles}
      />
    );
  }

  return (
    <RoomOnboardingChecklist
      onClose={() => closeOnboarding("skipped")}
      onComplete={() => closeOnboarding("completed")}
      items={items}
    />
  );

  function closeOnboarding(status: "completed" | "skipped") {
    onProgressChange(status === "completed"
      ? { completedAt: new Date().toISOString() }
      : { dismissedAt: new Date().toISOString() });
    setIsOpen(false);
  }
}

function RoomWelcomeOnboarding({
  dialogRef,
  onClose,
  onStartChecklist,
  onOpenProjectFiles,
}: {
  dialogRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onStartChecklist: () => void;
  onOpenProjectFiles: () => void;
}) {
  return (
    <div data-onboarding-tour className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(20,24,34,0.38)] p-3 sm:items-center">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-welcome-onboarding-title"
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-md border border-studio-line bg-studio-paper text-ink shadow-[0_18px_54px_rgba(20,24,34,0.28)]"
      >
        <div className="border-b border-studio-line px-4 py-3">
          <p className="font-mono text-[11px] uppercase text-ink-subtle">Project ready</p>
          <h2 id="room-welcome-onboarding-title" className="mt-1 text-base font-semibold">Start with the room essentials</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Fold keeps the room simple: files, people, comments, and agent handoff.
          </p>
        </div>
        <div className="grid gap-0 border-b border-studio-line">
          <WelcomeOnboardingRow icon={<FileText className="h-4 w-4" />} title="Project files" body="Create or import Markdown files from the rail." />
          <WelcomeOnboardingRow icon={<UsersRound className="h-4 w-4" />} title="Private invite" body="Copy the encrypted room link for a person." />
          <WelcomeOnboardingRow icon={<Bot className="h-4 w-4" />} title="Agent handoff" body="Copy CLI instructions when an agent should join." />
        </div>
        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded px-2 text-xs font-medium text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
          >
            Not now
          </button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenProjectFiles();
                onClose();
              }}
            >
              Open files
            </Button>
            <Button type="button" onClick={onStartChecklist}>Show checklist</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RoomOnboardingChecklist({
  onClose,
  onComplete,
  items,
}: {
  onClose: () => void;
  onComplete: () => void;
  items: OnboardingChecklistItem[];
}) {
  const completedCount = items.filter((item) => item.completed).length;

  return (
    <aside
      data-onboarding-tour
      aria-label="Project setup checklist"
      className="fixed inset-x-3 bottom-3 z-[80] max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-md border border-studio-line bg-studio-paper text-ink shadow-[0_18px_54px_rgba(20,24,34,0.28)] sm:left-4 sm:right-auto sm:w-[360px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-studio-line px-3 py-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-ink-muted" />
            <h2 className="text-sm font-semibold">Project setup</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{completedCount} of {items.length} complete. A quiet guide for the first few room actions.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checklist"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-2">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 rounded px-2 py-2">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]",
                item.completed
                  ? "border-midnight-strong bg-midnight-strong text-white"
                  : "border-studio-line text-ink-subtle",
              )}
            >
              {item.completed ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{item.body}</span>
              <button
                type="button"
                onClick={item.action}
                disabled={item.disabled}
                className="mt-2 h-7 rounded border border-studio-line px-2 text-[11px] font-medium text-ink-muted transition-colors enabled:hover:bg-studio-sunken enabled:hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong disabled:cursor-default disabled:opacity-60"
              >
                {item.actionLabel}
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-studio-line px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded px-2 text-xs font-medium text-ink-subtle transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
        >
          Hide
        </button>
        <Button type="button" onClick={onComplete}>Done</Button>
      </div>
    </aside>
  );
}

interface OnboardingChecklistItem {
  id: OnboardingItemId;
  title: string;
  body: string;
  actionLabel: string;
  action: () => void;
  completed: boolean;
  disabled?: boolean;
}

function getOnboardingItems({
  projectName,
  files,
  reviewCount,
  progress,
  canCopyAgentInvite,
  onFocusProjectTitle,
  onOpenProjectFiles,
  onCopyProjectLink,
  onOpenReview,
  onCopyAgentInvite,
}: {
  projectName: string;
  files: ProjectFile[];
  reviewCount: number;
  progress: RoomOnboardingProgress;
  canCopyAgentInvite: boolean;
  onFocusProjectTitle: () => void;
  onOpenProjectFiles: () => void;
  onCopyProjectLink: () => void;
  onOpenReview: () => void;
  onCopyAgentInvite: () => void;
}): OnboardingChecklistItem[] {
  const hasNamedProject = Boolean(projectName.trim()) && projectName.trim().toLowerCase() !== "untitled project";
  const hasAddedFiles = files.length > 1;
  const hasReviewActivity = reviewCount > 0;

  return [
    {
      id: "project-name",
      title: "Name the project",
      body: "Give this room a name humans and agents can recognize.",
      actionLabel: hasNamedProject ? "Rename" : "Name project",
      action: onFocusProjectTitle,
      completed: hasNamedProject,
    },
    {
      id: "files",
      title: "Add Markdown files",
      body: "Create or import the files this project is about.",
      actionLabel: "Open files",
      action: onOpenProjectFiles,
      completed: hasAddedFiles,
    },
    {
      id: "invite",
      title: "Invite a person",
      body: "Copy a private encrypted link for a collaborator.",
      actionLabel: progress.inviteCopiedAt ? "Copy again" : "Copy invite",
      action: onCopyProjectLink,
      completed: Boolean(progress.inviteCopiedAt),
    },
    {
      id: "review",
      title: "Review changes",
      body: "Use comments and suggestions to decide what lands.",
      actionLabel: "Open review",
      action: onOpenReview,
      completed: hasReviewActivity,
    },
    {
      id: "agent",
      title: "Bring in an agent",
      body: "Copy a handoff so an agent can join with the right context.",
      actionLabel: progress.agentHandoffCopiedAt ? "Copy again" : "Copy handoff",
      action: onCopyAgentInvite,
      completed: Boolean(progress.agentHandoffCopiedAt),
      disabled: !canCopyAgentInvite,
    },
  ];
}

function WelcomeOnboardingRow({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-studio-line px-4 py-3 first:border-t-0">
      <span className="flex h-8 w-8 items-center justify-center rounded bg-studio-sunken text-ink-muted">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{body}</span>
      </span>
    </div>
  );
}

function readOnboardingPreviewSurface(): OnboardingSurface | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawSurface = params.get("onboarding") || params.get("tour");
    if (rawSurface === "welcome" || rawSurface === "sheet" || rawSurface === "1") return "welcome";
    if (rawSurface === "checklist" || rawSurface === "setup") return "checklist";
    return null;
  } catch {
    return null;
  }
}

function readOnboardingAutoState(): {
  version?: number;
  roomId?: string;
  openedAt?: string;
} {
  try {
    const stored = window.localStorage.getItem(ROOM_ONBOARDING_AUTO_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    const legacy = window.localStorage.getItem(ROOM_ONBOARDING_LEGACY_STORAGE_KEY);
    const legacyState = legacy ? JSON.parse(legacy) : null;
    if (legacyState?.completedAt || legacyState?.skippedAt) {
      return { version: 1, openedAt: legacyState.completedAt || legacyState.skippedAt };
    }
    return {};
  } catch {
    return {};
  }
}

function writeOnboardingAutoState(state: {
  version: number;
  roomId: string;
  openedAt: string;
}) {
  try {
    window.localStorage.setItem(ROOM_ONBOARDING_AUTO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Tour state is a local convenience; failing to persist should not block the room.
  }
}

function roomOnboardingProgressStorageKey(roomId: string) {
  return `${ROOM_ONBOARDING_PROGRESS_STORAGE_PREFIX}${roomId}`;
}

function readRoomOnboardingProgress(roomId: string): RoomOnboardingProgress {
  try {
    const stored = window.localStorage.getItem(roomOnboardingProgressStorageKey(roomId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function writeRoomOnboardingProgress(roomId: string, progress: RoomOnboardingProgress) {
  try {
    window.localStorage.setItem(roomOnboardingProgressStorageKey(roomId), JSON.stringify(progress));
  } catch {
    // Setup progress is a local convenience; the room itself should remain usable.
  }
}

function trapOnboardingFocus(event: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
  )).filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function ProjectFileSidebar({
  roomId,
  projectName,
  files,
  recentFiles,
  onBack,
  onCopyProjectLink,
  onRenameProject,
  projectLinkCopied = false,
  humanInviteHasWarnings = false,
  humanInviteAriaLabel,
  humanInviteTooltip,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  onImportFile,
  onOpenReview,
}: {
  roomId: string;
  projectName: string;
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  onBack: () => void;
  onCopyProjectLink: () => void;
  onRenameProject: (name: string) => void;
  projectLinkCopied?: boolean;
  humanInviteHasWarnings?: boolean;
  humanInviteAriaLabel?: string;
  humanInviteTooltip?: string;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onImportFile: () => void;
  onOpenReview: () => void;
}) {
  return (
    <aside className="hidden min-h-dvh flex-col bg-studio-paper text-ink md:flex">
      <ProjectFilesHeader
        roomId={roomId}
        projectName={projectName}
        onBack={onBack}
        onCopyProjectLink={onCopyProjectLink}
        onRenameProject={onRenameProject}
        projectLinkCopied={projectLinkCopied}
        humanInviteHasWarnings={humanInviteHasWarnings}
        humanInviteAriaLabel={humanInviteAriaLabel}
        humanInviteTooltip={humanInviteTooltip}
      />
      <ProjectFilesBody
        key={`desktop-project-files:${roomId}`}
        roomId={roomId}
        files={files}
        recentFiles={recentFiles}
        onFileSelect={onFileSelect}
        onCreateFile={onCreateFile}
        onDeleteFile={onDeleteFile}
        onImportFile={onImportFile}
        onOpenReview={onOpenReview}
      />
    </aside>
  );
}

function ProjectFilesHeader({
  roomId,
  projectName,
  onBack,
  onCopyProjectLink,
  onRenameProject,
  projectLinkCopied = false,
  humanInviteHasWarnings = false,
  humanInviteAriaLabel,
  humanInviteTooltip,
  onClose,
}: {
  roomId: string;
  projectName: string;
  onBack: () => void;
  onCopyProjectLink: () => void;
  onRenameProject: (name: string) => void;
  projectLinkCopied?: boolean;
  humanInviteHasWarnings?: boolean;
  humanInviteAriaLabel?: string;
  humanInviteTooltip?: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-studio-line px-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="h-11 w-11">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div data-onboarding-target="project-title" className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="fold-logo-mark h-5 w-5 shrink-0" />
          <ProjectTitleEditor projectName={projectName} onRenameProject={onRenameProject} />
        </div>
        <p className="truncate text-[11px] font-medium text-ink-subtle" title={roomId ? `Project id ${roomId}` : undefined}>
          Fold project · Private workspace
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyProjectLink}
            aria-label={humanInviteAriaLabel || (projectLinkCopied ? "Invite link copied" : humanInviteHasWarnings ? "Copy invite link with local network warning" : "Copy invite link")}
            data-onboarding-target="copy-invite"
            className={cn(
              "copy-project-link-button relative h-11 w-11 overflow-hidden transition-all duration-200 active:scale-[0.96]",
              projectLinkCopied &&
                "copy-project-link-button--copied scale-95 bg-midnight-soft text-midnight-strong ring-1 ring-midnight-strong/40",
            )}
          >
            <span
              key={projectLinkCopied ? "copied" : "idle"}
              className={cn(
                "relative z-10 inline-flex items-center justify-center transition-transform duration-200",
                projectLinkCopied && "copy-project-link-icon--copied",
              )}
            >
              {projectLinkCopied ? <Check className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
            </span>
            <span className="sr-only" aria-live="polite">
              {projectLinkCopied ? "Invite link copied" : ""}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{humanInviteTooltip || (projectLinkCopied ? "Copied" : humanInviteHasWarnings ? "Copy invite link, local URLs" : "Copy invite link")}</TooltipContent>
      </Tooltip>
      {onClose && (
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close project files" className="h-11 w-11">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ProjectTitleEditor({
  projectName,
  onRenameProject,
}: {
  projectName: string;
  onRenameProject: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelBlurRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraftName(projectName);
  }, [isEditing, projectName]);

  useEffect(() => {
    if (!isEditing) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isEditing]);

  const commit = () => {
    const nextName = draftName.replace(/\s+/g, " ").trim() || "Untitled project";
    setDraftName(nextName);
    setIsEditing(false);
    if (nextName !== projectName) onRenameProject(nextName);
  };

  const cancel = () => {
    cancelBlurRef.current = true;
    setDraftName(projectName);
    setIsEditing(false);
    requestAnimationFrame(() => {
      cancelBlurRef.current = false;
    });
  };

  if (isEditing) {
    return (
      <form
        className="min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onBlur={() => {
            if (!cancelBlurRef.current) commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          aria-label="Project name"
          maxLength={80}
          className="h-7 w-full min-w-0 rounded border border-midnight/35 bg-studio-sunken px-1.5 text-sm font-semibold text-ink outline-none selection:bg-midnight-soft focus:border-midnight-strong focus:ring-2 focus:ring-midnight-soft"
        />
      </form>
    );
  }

  return (
    <button
      type="button"
      data-project-title
      onClick={() => setIsEditing(true)}
      className="group/title flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-studio-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
      title={projectName}
      aria-label={`Rename project ${projectName}`}
    >
      <span className="truncate">{projectName}</span>
      <Pencil className="h-3 w-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100" aria-hidden />
    </button>
  );
}

function ProjectFilesBody({
  roomId,
  files,
  recentFiles,
  autoFocusSearch = false,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  onImportFile,
  onOpenReview,
}: {
  roomId: string;
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  autoFocusSearch?: boolean;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onImportFile: () => void;
  onOpenReview?: () => void;
}) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => defaultProjectFolderState());
  const [query, setQuery] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState("docs/untitled.md");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const [loadedFolderStateKey, setLoadedFolderStateKey] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const folderStateStorageKey = `fold:project-folders:${roomId}`;
  const activeFilePath = files.find((file) => file.active)?.path || "";
  const requestedSearchPath = normalizeSidebarCreatePath(query);
  const requestedNewFilePath = normalizeSidebarCreatePath(newFilePath);
  const fileTree = useMemo(() => buildProjectFileTree(files, normalizedQuery), [files, normalizedQuery]);
  const hasSearchResults = fileTree.files.length > 0 || fileTree.folders.some((folder) => treeHasFiles(folder));
  const hasExactSearchPath = requestedSearchPath
    ? files.some((file) => file.path.toLowerCase() === requestedSearchPath.toLowerCase())
    : false;
  const hasExactNewFilePath = requestedNewFilePath
    ? files.some((file) => file.path.toLowerCase() === requestedNewFilePath.toLowerCase())
    : false;
  const canCreateFromSearch = Boolean(normalizedQuery && requestedSearchPath && !hasExactSearchPath);
  const canCreateNewFile = Boolean(requestedNewFilePath && !hasExactNewFilePath);
  const canDeleteFiles = files.length > 1;
  const activeFiles = useMemo(
    () => files
      .filter((file) => uniquePresencesByPersona(file.activePresences || []).length > 1)
      .filter((file) => fileReviewTotal(file) === 0)
      .sort(compareProjectActivityFiles)
      .slice(0, 4),
    [files],
  );
  const reviewFiles = useMemo(
    () => files
      .filter((file) => fileReviewTotal(file) > 0)
      .sort(compareProjectReviewFiles)
      .slice(0, 4),
    [files],
  );
  const toggleFolder = (name: string) => {
    setOpenFolders((current) => ({ ...current, [name]: !(current[name] ?? true) }));
  };
  const handleFileSelect = (path: string) => {
    setQuery("");
    onFileSelect(path);
  };
  const handleCreateFile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreateNewFile) return;
    createFile(requestedNewFilePath);
  };
  const createFile = (path: string) => {
    onCreateFile(path);
    setQuery("");
    setNewFilePath("docs/untitled.md");
    setIsCreatingFile(false);
  };
  const cancelCreateFile = () => {
    setNewFilePath("docs/untitled.md");
    setIsCreatingFile(false);
  };

  useEffect(() => {
    setLoadedFolderStateKey(null);
    const defaultOpenFolders = defaultProjectFolderState();
    let stored: unknown = null;
    try {
      const raw = window.localStorage.getItem(folderStateStorageKey);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }

    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      setOpenFolders({
        ...defaultOpenFolders,
        ...Object.fromEntries(
          Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"),
        ),
      });
    } else {
      setOpenFolders(defaultOpenFolders);
    }
    setLoadedFolderStateKey(folderStateStorageKey);
  }, [folderStateStorageKey]);

  useEffect(() => {
    if (loadedFolderStateKey !== folderStateStorageKey) return;
    try {
      window.localStorage.setItem(folderStateStorageKey, JSON.stringify(openFolders));
    } catch {
      // Folder expansion is convenience state; navigation still works if storage is unavailable.
    }
  }, [folderStateStorageKey, loadedFolderStateKey, openFolders]);

  useEffect(() => {
    if (!activeFilePath) return;
    const ancestorFolders = ancestorFolderPaths(activeFilePath);
    if (ancestorFolders.length === 0) return;

    setOpenFolders((current) => {
      if (ancestorFolders.every((path) => current[path] !== false)) return current;
      const next = { ...current };
      for (const path of ancestorFolders) next[path] = true;
      return next;
    });
  }, [activeFilePath]);

  useEffect(() => {
    if (!isCreatingFile) return;
    window.requestAnimationFrame(() => createInputRef.current?.focus());
  }, [isCreatingFile]);

  useEffect(() => {
    if (!autoFocusSearch) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [autoFocusSearch]);

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="border-b border-studio-line p-3">
        <label className="flex h-11 items-center gap-2 rounded-md border border-studio-line bg-studio-sunken px-2 text-xs text-ink-subtle focus-within:border-midnight/30 focus-within:bg-porcelain md:h-8">
          <Search className="h-3.5 w-3.5" />
          <input
            ref={searchInputRef}
            aria-label="Search project files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter files"
            className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-subtle"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear file search"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-5 md:w-5"
              onClick={() => setQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {!normalizedQuery && recentFiles.length > 1 && (
          <SidebarSection title="Recent">
            {recentFiles.map((file) => (
              <SidebarFile key={`recent:${file.path}`} file={file} depth={0} showUpdatedAt onFileSelect={handleFileSelect} />
            ))}
          </SidebarSection>
        )}
        {!normalizedQuery && activeFiles.length > 0 && (
          <SidebarSection
            title="Active"
            className={cn(!normalizedQuery && recentFiles.length > 1 && "mt-4")}
          >
            {activeFiles.map((file) => (
              <SidebarFile key={`active:${file.path}`} file={file} depth={0} showUpdatedAt onFileSelect={handleFileSelect} />
            ))}
          </SidebarSection>
        )}
        {!normalizedQuery && reviewFiles.length > 0 && (
          <SidebarSection
            title="Review"
            className={cn((recentFiles.length > 1 || activeFiles.length > 0) && "mt-4")}
          >
            {reviewFiles.map((file) => (
              <SidebarFile
                key={`review:${file.path}`}
                file={file}
                depth={0}
                showUpdatedAt
                ariaLabel={reviewFileLabel(file)}
                onFileSelect={(path) => {
                  handleFileSelect(path);
                  onOpenReview?.();
                }}
              />
            ))}
          </SidebarSection>
        )}
        <SidebarSection
          title="Project"
          className={cn(!normalizedQuery && (recentFiles.length > 1 || activeFiles.length > 0 || reviewFiles.length > 0) && "mt-4")}
          action={
            <div className="flex items-center gap-1 md:gap-0.5">
              <button
                type="button"
                aria-label="Import Markdown file"
                title="Import Markdown file"
                onClick={onImportFile}
                className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Create Markdown file"
                title="Create Markdown file"
                onClick={() => setIsCreatingFile((open) => !open)}
                className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          {isCreatingFile && (
            <form
              onSubmit={handleCreateFile}
              className="mb-2 flex min-h-11 items-center gap-1 rounded-md border border-studio-line bg-studio-sunken px-1.5 py-1 md:min-h-8"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />
              <input
                ref={createInputRef}
                aria-label="New Markdown file path"
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelCreateFile();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-xs text-ink outline-none placeholder:text-ink-subtle"
                placeholder="notes.md"
              />
              {hasExactNewFilePath && (
                <span className="hidden shrink-0 text-[10px] text-ink-subtle sm:inline">Exists</span>
              )}
              <button
                type="submit"
                aria-label="Create file"
                disabled={!canCreateNewFile}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-midnight-strong transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong disabled:cursor-not-allowed disabled:text-ink-subtle disabled:opacity-50 md:h-6 md:w-6"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cancel file creation"
                onClick={cancelCreateFile}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
          {canCreateFromSearch && (
            <SidebarCreateFile
              path={requestedSearchPath}
              onCreateFile={() => createFile(requestedSearchPath)}
            />
          )}
          {fileTree.files.map((file) => (
            <SidebarFile
              key={file.path}
              file={file}
              depth={0}
              canDelete={canDeleteFiles}
              onFileSelect={handleFileSelect}
              onDeleteFile={onDeleteFile}
            />
          ))}
          {fileTree.folders.map((folder) => (
            <SidebarTreeFolder
              key={folder.path}
              folder={folder}
              depth={0}
              forceOpen={Boolean(normalizedQuery)}
              openFolders={openFolders}
              onToggle={toggleFolder}
              onFileSelect={handleFileSelect}
              onDeleteFile={onDeleteFile}
              canDeleteFiles={canDeleteFiles}
            />
          ))}
          {normalizedQuery && !hasSearchResults && !canCreateFromSearch && (
            <p className="px-2 py-3 text-xs text-ink-subtle">No files found</p>
          )}
        </SidebarSection>
      </nav>

    </div>
  );
}

function SidebarSection({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-[11px] font-medium uppercase text-ink-subtle">{title}</p>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function SidebarFolder({
  name,
  open,
  onToggle,
  commentCount = 0,
  requestCount = 0,
  pendingCount = 0,
  conflictCount = 0,
  depth = 0,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  commentCount?: number;
  requestCount?: number;
  pendingCount?: number;
  conflictCount?: number;
  depth?: number;
}) {
  const FolderIcon = open ? FolderOpen : FolderClosed;
  const indicatorLabel = reviewIndicatorLabel(commentCount, requestCount, pendingCount, conflictCount);

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={indicatorLabel ? `${name}, ${indicatorLabel}` : name}
      onClick={onToggle}
      className="mt-2 flex h-11 w-full items-center gap-1.5 rounded px-2 text-left text-xs text-ink-muted transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-7"
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
    >
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      <FolderIcon className="h-3.5 w-3.5" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <FileReviewIndicators commentCount={commentCount} requestCount={requestCount} pendingCount={pendingCount} conflictCount={conflictCount} />
    </button>
  );
}

function SidebarFile({
  file,
  onFileSelect,
  onDeleteFile,
  depth = 0,
  showUpdatedAt = false,
  ariaLabel,
  canDelete = false,
}: {
  file: ProjectFile;
  onFileSelect: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  depth?: number;
  showUpdatedAt?: boolean;
  ariaLabel?: string;
  canDelete?: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const reviewTotal = fileReviewTotal(file);
  const deleteLabel = canDelete
    ? `Delete ${file.path}`
    : "Create another file before deleting this one";

  if (confirmingDelete) {
    return (
      <div
        data-file-delete-confirm={file.path}
        style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
        className="flex min-h-11 w-full items-center gap-2 rounded-md border border-studio-line bg-studio-sunken px-2 py-1.5 text-sm md:min-h-8"
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink">Delete {file.name}?</span>
          {reviewTotal > 0 && (
            <span className="block truncate text-[10px] text-ink-subtle">Review history stays encrypted in the room.</span>
          )}
        </span>
        <button
          type="button"
          aria-label={`Confirm delete ${file.path}`}
          onClick={() => {
            setConfirmingDelete(false);
            onDeleteFile?.(file.path);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-midnight-strong hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Cancel delete ${file.path}`}
          onClick={() => setConfirmingDelete(false)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-6 md:w-6"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-onboarding-target={file.active ? "project-file-active" : undefined}
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
      className={cn(
        "group flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors md:h-8",
        file.active
          ? "bg-porcelain text-ink"
          : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onFileSelect(file.path)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong focus-visible:ring-offset-1 focus-visible:ring-offset-studio-paper"
      >
        <File className="h-3.5 w-3.5 shrink-0 text-ink-subtle group-hover:text-ink-muted" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        <FilePresenceIndicators presences={file.activePresences || []} />
        <FileReviewIndicators commentCount={file.commentCount || 0} requestCount={file.requestCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />
        {showUpdatedAt && file.updatedAt && (
          <span className="hidden shrink-0 font-mono text-[10px] text-ink-subtle group-hover:text-ink-muted lg:inline">
            {formatRelativeTime(file.updatedAt)}
          </span>
        )}
        {file.status && <span className="rounded bg-studio-sunken px-1 text-[10px] text-ink-subtle">{file.status}</span>}
      </button>
      {onDeleteFile && (
        <button
          type="button"
          aria-label={deleteLabel}
          title={deleteLabel}
          disabled={!canDelete}
          onClick={() => {
            if (!canDelete) return;
            setConfirmingDelete(true);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-ink-subtle opacity-100 transition-colors hover:bg-studio-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong disabled:cursor-not-allowed disabled:opacity-35 md:h-6 md:w-6 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
function FilePresenceIndicators({ presences }: { presences: CollaborationPresence[] }) {
  if (presences.length === 0) return null;

  const displayPresences = uniquePresencesByPersona(presences);
  const visible = displayPresences.slice(0, 2);
  const hiddenCount = Math.max(0, displayPresences.length - visible.length);
  const label = displayPresences.map(presenceLabel).join(", ");
  const activity = presenceActivityLabel(displayPresences);

  return (
    <span
      className="hidden shrink-0 items-center gap-1 sm:inline-flex"
      aria-label={`Active in file: ${label}`}
      title={label}
    >
      <span className="flex items-center" aria-hidden="true">
        {visible.map((presence, index) => (
          <PersonaAvatar
            key={presence.clientId}
            persona={presence.persona}
            compact
            className={cn("h-[18px] w-[18px] ring-1 ring-studio-paper", index > 0 && "-ml-1.5")}
          />
        ))}
        {hiddenCount > 0 && (
          <span className="-ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rail px-1 text-[9px] font-medium text-ink-subtle ring-1 ring-studio-paper">
            +{hiddenCount}
          </span>
        )}
      </span>
      {activity && (
        <span className="hidden max-w-16 truncate text-[10px] font-medium text-midnight-strong xl:inline" aria-hidden="true">
          {activity}
        </span>
      )}
    </span>
  );
}

function FileReviewIndicators({
  commentCount,
  requestCount,
  pendingCount,
  conflictCount,
}: {
  commentCount: number;
  requestCount?: number;
  pendingCount: number;
  conflictCount: number;
}) {
  const total = commentCount + (requestCount || 0) + pendingCount + conflictCount;
  if (total === 0) return null;

  const label = reviewIndicatorLabel(commentCount, requestCount || 0, pendingCount, conflictCount);
  const Icon = conflictCount > 0 ? AlertTriangle : requestCount ? Bot : MessageSquare;

  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded bg-studio-sunken px-1.5 text-[10px] font-medium text-ink-subtle group-hover:text-ink-muted"
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span>{total}</span>
    </span>
  );
}

function reviewIndicatorLabel(commentCount: number, requestCount: number, pendingCount: number, conflictCount = 0) {
  return [
    commentCount ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "",
    requestCount ? `${requestCount} agent ${requestCount === 1 ? "request" : "requests"}` : "",
    pendingCount ? `${pendingCount} pending ${pendingCount === 1 ? "suggestion" : "suggestions"}` : "",
    conflictCount ? `${conflictCount} incoming ${conflictCount === 1 ? "edit" : "edits"}` : "",
  ].filter(Boolean).join(", ");
}

function reviewFileLabel(file: ProjectFile) {
  const label = reviewIndicatorLabel(file.commentCount || 0, file.requestCount || 0, file.pendingCount || 0, file.conflictCount || 0);
  return label ? `Open review for ${file.path}, ${label}` : `Open review for ${file.path}`;
}

function SidebarCreateFile({
  path,
  onCreateFile,
}: {
  path: string;
  onCreateFile: () => void;
}) {
  const name = path.split("/").pop() || path;

  return (
    <button
      type="button"
      aria-label={`Create ${path}`}
      onClick={onCreateFile}
      className="group mb-1 flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:min-h-10"
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">Create {name}</span>
        <span className="block truncate text-[11px] text-ink-subtle group-hover:text-ink-muted">{path}</span>
      </span>
    </button>
  );
}

function SidebarTreeFolder({
  folder,
  depth,
  forceOpen,
  openFolders,
  onToggle,
  onFileSelect,
  onDeleteFile,
  canDeleteFiles,
}: {
  folder: ProjectTreeFolder;
  depth: number;
  forceOpen: boolean;
  openFolders: Record<string, boolean>;
  onToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
  onDeleteFile: (path: string) => void;
  canDeleteFiles: boolean;
}) {
  const open = Boolean(forceOpen || (openFolders[folder.path] ?? true));
  const reviewCounts = folderReviewCounts(folder);

  return (
    <div>
      <SidebarFolder
        name={folder.name}
        open={open}
        depth={depth}
        commentCount={reviewCounts.commentCount}
        requestCount={reviewCounts.requestCount}
        pendingCount={reviewCounts.pendingCount}
        conflictCount={reviewCounts.conflictCount}
        onToggle={() => onToggle(folder.path)}
      />
      {open && (
        <>
          {folder.folders.map((child) => (
            <SidebarTreeFolder
              key={child.path}
              folder={child}
              depth={depth + 1}
              forceOpen={forceOpen}
              openFolders={openFolders}
              onToggle={onToggle}
              onFileSelect={onFileSelect}
              onDeleteFile={onDeleteFile}
              canDeleteFiles={canDeleteFiles}
            />
          ))}
          {folder.files.map((file) => (
            <SidebarFile
              key={file.path}
              file={file}
              depth={depth + 1}
              canDelete={canDeleteFiles}
              onFileSelect={onFileSelect}
              onDeleteFile={onDeleteFile}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface ProjectTreeFolder {
  name: string;
  path: string;
  folders: ProjectTreeFolder[];
  files: ProjectFile[];
}

interface ProjectFileTree {
  files: ProjectFile[];
  folders: ProjectTreeFolder[];
}

function buildProjectFileTree(files: ProjectFile[], query: string): ProjectFileTree {
  const roots = new Map<string, MutableProjectTreeFolder>();
  const rootFiles: ProjectFile[] = [];
  const visibleFiles = query
    ? files.filter((file) => projectFileMatchScore(file, query) > 0)
    : files;
  const ensureFolder = (name: string, path: string, parent?: MutableProjectTreeFolder) => {
    const map = parent ? parent.folderMap : roots;
    let folder = map.get(path);
    if (!folder) {
      folder = { name, path, folderMap: new Map(), folders: [], files: [] };
      map.set(path, folder);
      if (parent) parent.folders.push(folder);
    }
    return folder;
  };

  for (const file of visibleFiles) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length <= 1) {
      rootFiles.push(file);
      continue;
    }

    const folderParts = parts.slice(0, -1);
    let parent: MutableProjectTreeFolder | undefined;
    let currentPath = "";
    for (const part of folderParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      parent = ensureFolder(part, currentPath, parent);
    }
    parent?.files.push(file);
  }

  const toPublicFolder = (folder: MutableProjectTreeFolder): ProjectTreeFolder => ({
    name: folder.name,
    path: folder.path,
    folders: folder.folders.sort(compareTreeFolders).map(toPublicFolder),
    files: folder.files.sort(compareProjectFiles),
  });

  return {
    files: rootFiles.sort(compareProjectFiles),
    folders: Array.from(roots.values()).sort(compareTreeFolders).map(toPublicFolder),
  };
}

interface MutableProjectTreeFolder extends ProjectTreeFolder {
  folderMap: Map<string, MutableProjectTreeFolder>;
  folders: MutableProjectTreeFolder[];
}

function compareTreeFolders(a: Pick<ProjectTreeFolder, "name">, b: Pick<ProjectTreeFolder, "name">) {
  const order = ["docs", "reports"];
  const ai = order.indexOf(a.name);
  const bi = order.indexOf(b.name);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  return a.name.localeCompare(b.name);
}

function compareProjectFiles(a: ProjectFile, b: ProjectFile) {
  return a.name.localeCompare(b.name);
}

function compareProjectActivityFiles(a: ProjectFile, b: ProjectFile) {
  const aPresence = uniquePresencesByPersona(a.activePresences || []).length;
  const bPresence = uniquePresencesByPersona(b.activePresences || []).length;
  if (aPresence !== bPresence) return bPresence - aPresence;
  return compareProjectFiles(a, b);
}

function compareProjectReviewFiles(a: ProjectFile, b: ProjectFile) {
  const aConflict = a.conflictCount || 0;
  const bConflict = b.conflictCount || 0;
  if (aConflict !== bConflict) return bConflict - aConflict;

  const aRequests = a.requestCount || 0;
  const bRequests = b.requestCount || 0;
  if (aRequests !== bRequests) return bRequests - aRequests;

  const aPending = a.pendingCount || 0;
  const bPending = b.pendingCount || 0;
  if (aPending !== bPending) return bPending - aPending;

  const aTotal = fileReviewTotal(a);
  const bTotal = fileReviewTotal(b);
  if (aTotal !== bTotal) return bTotal - aTotal;

  return compareProjectFiles(a, b);
}

function fileReviewTotal(file: ProjectFile) {
  return (file.commentCount || 0) + (file.requestCount || 0) + (file.pendingCount || 0) + (file.conflictCount || 0);
}

function defaultProjectFolderState(): Record<string, boolean> {
  return {
    docs: true,
    reports: true,
  };
}

function projectFileMatchScore(file: ProjectFile, query: string) {
  const name = file.name.toLowerCase();
  const path = file.path.toLowerCase();
  const compactQuery = query.replace(/[\s/_-]+/g, "");
  const compactPath = path.replace(/[\s/_-]+/g, "");
  const pathSegments = path.split("/").filter(Boolean);

  if (name === query || path === query) return 100;
  if (name.startsWith(query)) return 90;
  if (path.startsWith(query)) return 86;
  if (pathSegments.some((segment) => segment.startsWith(query))) return 78;
  if (name.includes(query) || path.includes(query)) return 64;
  if (compactQuery.length >= 2 && compactPath.includes(compactQuery)) return 56;
  if (compactQuery.length >= 3 && isSubsequence(compactQuery, compactPath)) return 42;
  return 0;
}

function treeHasFiles(folder: ProjectTreeFolder): boolean {
  return folder.files.length > 0 || folder.folders.some(treeHasFiles);
}

function ancestorFolderPaths(filePath: string) {
  const parts = filePath.split("/").filter(Boolean).slice(0, -1);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function folderReviewCounts(folder: ProjectTreeFolder) {
  return folder.folders.reduce(
    (counts, child) => {
      const childCounts = folderReviewCounts(child);
      counts.commentCount += childCounts.commentCount;
      counts.requestCount += childCounts.requestCount;
      counts.pendingCount += childCounts.pendingCount;
      counts.conflictCount += childCounts.conflictCount;
      return counts;
    },
    {
      commentCount: folder.files.reduce((count, file) => count + (file.commentCount || 0), 0),
      requestCount: folder.files.reduce((count, file) => count + (file.requestCount || 0), 0),
      pendingCount: folder.files.reduce((count, file) => count + (file.pendingCount || 0), 0),
      conflictCount: folder.files.reduce((count, file) => count + (file.conflictCount || 0), 0),
    },
  );
}

type PaletteItem = {
  id: string;
  label: string;
  detail?: string;
  group: "create" | "recent" | "files" | "matches" | "actions";
  searchText?: string;
  showByDefault?: boolean;
  icon: ReactNode;
  meta?: ReactNode;
  action: () => void;
  disabled?: boolean;
};

function ProjectCommandPalette({
  files,
  recentFiles,
  selectedFilePath,
  mode,
  pendingCount,
  requestCount,
  conflictCount,
  reviewCount,
  selectedQuote,
  humanInviteHasWarnings,
  agentInviteHasWarnings,
  onClose,
  onFileSelect,
  onCreateFile,
  onImportFile,
  onModeChange,
  onExport,
  onCopyProjectLink,
  onOpenReview,
  onFocusCommentComposer,
  onCopyAgentInvite,
  onOpenProjectSetup,
}: {
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  selectedFilePath: string;
  mode: RoomMode;
  pendingCount: number;
  requestCount: number;
  conflictCount: number;
  reviewCount: number;
  selectedQuote: string;
  humanInviteHasWarnings: boolean;
  agentInviteHasWarnings: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onImportFile: () => void;
  onModeChange: (mode: RoomMode) => void;
  onExport: () => void;
  onCopyProjectLink: () => void;
  onOpenReview: () => void;
  onFocusCommentComposer: () => void;
  onCopyAgentInvite: () => void;
  onOpenProjectSetup: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const requestedPath = normalizePaletteFilePath(query);
  const matchingFile = requestedPath ? files.some((file) => file.path.toLowerCase() === requestedPath.toLowerCase()) : false;
  const commentCount = Math.max(0, reviewCount - requestCount - pendingCount - conflictCount);
  const trimmedQuote = selectedQuote.trim();

  useEffect(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const staticItems: PaletteItem[] = [
    ...(mode === "read" ? [
      {
        id: "add-comment",
        label: trimmedQuote ? "Add comment to selection" : "Add file comment",
        detail: trimmedQuote ? truncatePaletteDetail(trimmedQuote) : selectedFilePath,
        group: "actions",
        searchText: "add file comment note annotation review",
        icon: <MessageSquarePlus className="h-4 w-4" />,
        action: onFocusCommentComposer,
      },
      {
        id: "ask-agent",
        label: trimmedQuote ? "Ask agent at selection" : "Ask agent about file",
        detail: trimmedQuote ? truncatePaletteDetail(trimmedQuote) : selectedFilePath,
        group: "actions",
        searchText: "ask agent request selection revise clarify help",
        showByDefault: Boolean(trimmedQuote),
        icon: <Bot className="h-4 w-4" />,
        action: onFocusCommentComposer,
      },
    ] satisfies PaletteItem[] : []),
    {
      id: "show-comments",
      label: "Show unresolved comments",
      detail: `${commentCount} ${commentCount === 1 ? "comment" : "comments"} in current file`,
      group: "actions",
      searchText: "show comments unresolved review notes",
      showByDefault: commentCount > 0,
      icon: <MessageSquare className="h-4 w-4" />,
      action: onOpenReview,
    },
    {
      id: "show-requests",
      label: "Show agent requests",
      detail: `${requestCount} ${requestCount === 1 ? "request" : "requests"} in current file`,
      group: "actions",
      searchText: "show agent requests ask human request review",
      showByDefault: requestCount > 0,
      icon: <Bot className="h-4 w-4" />,
      action: onOpenReview,
    },
    {
      id: "show-suggestions",
      label: "Show pending suggestions",
      detail: `${pendingCount} ${pendingCount === 1 ? "suggestion" : "suggestions"} in current file`,
      group: "actions",
      searchText: "show pending suggestions review proposals",
      showByDefault: pendingCount > 0,
      icon: <ListChecks className="h-4 w-4" />,
      action: onOpenReview,
    },
    {
      id: "import-file",
      label: "Import Markdown file",
      detail: "Add local .md to project",
      group: "actions",
      icon: <Upload className="h-4 w-4" />,
      action: onImportFile,
    },
    {
      id: "copy-link",
      label: "Copy invite link",
      detail: humanInviteHasWarnings ? "Copy link message with local URL warning" : "Copy encrypted room link message",
      group: "actions",
      searchText: "copy project link share invite human encrypted room url",
      icon: <UsersRound className="h-4 w-4" />,
      action: onCopyProjectLink,
    },
    {
      id: "connect-agent",
      label: "Copy agent handoff",
      detail: agentInviteHasWarnings ? "Includes local URL warning" : "Copy secure CLI handoff",
      group: "actions",
      icon: <Bot className="h-4 w-4" />,
      action: onCopyAgentInvite,
    },
    {
      id: "show-project-setup",
      label: "Show project setup",
      detail: "Open the first-run checklist",
      group: "actions",
      searchText: "help onboarding project setup first time checklist guide",
      icon: <PanelRightOpen className="h-4 w-4" />,
      action: onOpenProjectSetup,
    },
    {
      id: "export",
      label: "Export current file",
      detail: selectedFilePath,
      group: "actions",
      icon: <Download className="h-4 w-4" />,
      action: onExport,
    },
    {
      id: "read",
      label: "Switch to read",
      detail: mode === "read" ? "Current mode" : selectedFilePath,
      group: "actions",
      searchText: "switch read preview view mode",
      showByDefault: mode !== "read",
      icon: <FileText className="h-4 w-4" />,
      action: () => onModeChange("read"),
    },
    {
      id: "edit",
      label: "Switch to edit",
      detail: mode === "edit" ? "Current mode" : selectedFilePath,
      group: "actions",
      searchText: "switch edit write source markdown mode",
      showByDefault: mode !== "edit",
      icon: <Pencil className="h-4 w-4" />,
      action: () => onModeChange("edit"),
    },
  ];
  const fileItems: PaletteItem[] = files.map((file) => ({
    id: `file:${file.path}`,
    label: file.name,
    detail: [filePathDetail(file), file.updatedAt ? `saved ${formatRelativeTime(file.updatedAt)}` : ""].filter(Boolean).join(" · "),
    group: "files",
    searchText: file.path,
    icon: file.path === selectedFilePath ? <Check className="h-4 w-4" /> : <File className="h-4 w-4" />,
    meta: <FileReviewIndicators commentCount={file.commentCount || 0} requestCount={file.requestCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
    action: () => onFileSelect(file.path),
  }));
  const contentItems: PaletteItem[] = normalizedQuery.length >= 2
    ? files
      .filter((file) => projectFileMatchScore(file, normalizedQuery) === 0)
      .flatMap((file) => {
        const snippet = projectFileContentSnippet(file.markdown || "", normalizedQuery);
        if (!snippet) return [];
        return [{
          id: `content:${file.path}`,
          label: file.name,
          detail: [filePathDetail(file) || file.path, snippet].filter(Boolean).join(" · "),
          group: "matches" as const,
          searchText: `${file.path} ${snippet}`,
          icon: <Search className="h-4 w-4" />,
          meta: <FileReviewIndicators commentCount={file.commentCount || 0} requestCount={file.requestCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
          action: () => onFileSelect(file.path),
        }];
      })
    : [];
  const recentPaths = new Set(recentFiles.map((file) => file.path));
  const recentItems: PaletteItem[] = recentFiles.map((file) => ({
    id: `recent:${file.path}`,
    label: file.name,
    detail: [filePathDetail(file), file.updatedAt ? `saved ${formatRelativeTime(file.updatedAt)}` : ""].filter(Boolean).join(" · "),
    group: "recent",
    searchText: file.path,
    icon: file.path === selectedFilePath ? <Check className="h-4 w-4" /> : <File className="h-4 w-4" />,
    meta: <FileReviewIndicators commentCount={file.commentCount || 0} requestCount={file.requestCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
    action: () => onFileSelect(file.path),
  }));
  const remainingFileItems = fileItems.filter((item) => !recentPaths.has(item.searchText || item.label));
  const defaultStaticItems = staticItems.filter((item) => item.showByDefault !== false);
  const createItem: PaletteItem[] = requestedPath && !matchingFile
    ? [{
      id: `create:${requestedPath}`,
      label: `Create ${requestedPath.split("/").pop() || requestedPath}`,
      detail: requestedPath,
      group: "create",
      icon: <Plus className="h-4 w-4" />,
      action: () => onCreateFile(requestedPath),
    }]
    : [];
  const rankedItems = normalizedQuery
    ? [
      ...createItem,
      ...rankCommandPaletteItems([...fileItems, ...contentItems, ...staticItems], normalizedQuery),
    ]
    : [...recentItems, ...defaultStaticItems, ...remainingFileItems];
  const items = rankedItems.slice(0, 12);
  const hiddenResultCount = normalizedQuery ? Math.max(0, rankedItems.length - items.length) : 0;
  const firstEnabledIndex = getFirstEnabledIndex(items);
  const listboxId = "project-command-palette-results";
  const activeOptionId = items[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;
  const activeItem = items[activeIndex] && !items[activeIndex].disabled
    ? items[activeIndex]
    : items.find((item) => !item.disabled);

  useEffect(() => {
    setActiveIndex(firstEnabledIndex === -1 ? 0 : firstEnabledIndex);
  }, [firstEnabledIndex, query]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex < items.length && !items[activeIndex]?.disabled) return;
    setActiveIndex(firstEnabledIndex === -1 ? 0 : firstEnabledIndex);
  }, [activeIndex, firstEnabledIndex, items]);

  const runFirstItem = (event: React.FormEvent) => {
    event.preventDefault();
    activeItem?.action();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = getNextEnabledIndex(items, activeIndex, direction);
      if (nextIndex !== -1) setActiveIndex(nextIndex);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? firstEnabledIndex : getLastEnabledIndex(items);
      if (nextIndex !== -1) setActiveIndex(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      if (document.activeElement === inputRef.current) return;
      event.preventDefault();
      activeItem?.action();
      return;
    }

    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close command palette"
        tabIndex={-1}
        className="fixed inset-0 z-[60] bg-black/25"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleDialogKeyDown}
        className="fixed left-1/2 top-16 z-[70] w-[min(640px,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-md border border-studio-line bg-studio-paper shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
      >
        <form onSubmit={runFirstItem} className="border-b border-studio-line">
          <label className="flex h-12 items-center gap-2 px-3 text-ink-muted">
            <Search className="h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Search commands and files"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Open file or command"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
          </label>
        </form>
        <div id={listboxId} role="listbox" className="max-h-[420px] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-subtle">No matches</p>
          ) : (
            items.map((item, index) => {
              const showGroupLabel = !normalizedQuery && (index === 0 || items[index - 1]?.group !== item.group);
              return (
                <div key={item.id}>
                  {showGroupLabel && (
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase text-ink-subtle">
                      {paletteGroupLabel(item.group)}
                    </p>
                  )}
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    disabled={item.disabled}
                    tabIndex={-1}
                    aria-selected={index === activeIndex}
                    aria-disabled={item.disabled || undefined}
                    onClick={item.action}
                    onMouseEnter={() => {
                      if (!item.disabled) setActiveIndex(index);
                    }}
                    className={cn(
                      "flex h-11 w-full items-center gap-2.5 rounded px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-10",
                      item.disabled && "cursor-not-allowed opacity-45",
                      !item.disabled && (index === activeIndex ? "bg-midnight-soft text-ink" : "hover:bg-studio-sunken"),
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-subtle">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{item.label}</span>
                      {item.detail && (
                        <span className="block truncate text-[11px] text-ink-subtle">{item.detail}</span>
                      )}
                    </span>
                    {item.meta ? <span className="shrink-0">{item.meta}</span> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
        {hiddenResultCount > 0 && (
          <div className="border-t border-studio-line px-3 py-2 text-[11px] text-ink-subtle">
            {hiddenResultCount} more {hiddenResultCount === 1 ? "match" : "matches"}
          </div>
        )}
      </div>
    </>
  );
}

function filePathDetail(file: Pick<ProjectFile, "name" | "path">) {
  return file.path === file.name ? "" : file.path;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "now";
  if (diffMs < 60 * 60_000) return `${Math.max(1, Math.floor(diffMs / 60_000))}m`;
  if (diffMs < 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diffMs / (60 * 60_000)))}h`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function paletteGroupLabel(group: PaletteItem["group"]) {
  if (group === "create") return "Create";
  if (group === "recent") return "Recent";
  if (group === "files") return "Files";
  if (group === "matches") return "Matches";
  return "Actions";
}

function projectFileContentSnippet(markdown: string, query: string) {
  const normalized = markdown.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const index = normalized.toLowerCase().indexOf(query);
  if (index < 0) return "";

  const start = Math.max(0, index - 34);
  const end = Math.min(normalized.length, index + query.length + 58);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function FileSwitcherButton({
  selectedFile,
  detail,
  savedLabel,
  securityLabel,
  connected,
  ready,
  onOpen,
  compact = false,
  showMetadata = false,
}: {
  selectedFile: ProjectFile;
  detail: string;
  savedLabel: string;
  securityLabel: string;
  connected: boolean;
  ready: boolean;
  onOpen: () => void;
  compact?: boolean;
  showMetadata?: boolean;
}) {
  const metadata = [detail, savedLabel].filter(Boolean).join(" · ");
  const accessibleDetail = [detail ? `in ${detail}` : "", savedLabel, securityLabel].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      aria-label={accessibleDetail ? `Open quick switcher for ${selectedFile.name}, ${accessibleDetail}` : `Open quick switcher for ${selectedFile.name}`}
      title="Open quick switcher"
      onClick={onOpen}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:bg-studio-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
        compact ? "h-11 px-1" : "px-1.5 py-1",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border border-studio-line bg-studio-sunken text-ink-muted",
          compact ? "h-8 w-8" : "h-7 w-7",
        )}
      >
        <FileText className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{selectedFile.name}</span>
        {showMetadata && (
          <span aria-hidden="true" className="hidden min-w-0 items-center gap-1.5 truncate text-[11px] text-ink-subtle md:flex">
            <span className="truncate">{metadata}</span>
            <span
              title={securityLabel}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-ink-subtle",
                connected && ready && "text-ink-muted",
                (!connected || !ready) && "text-amber-500",
              )}
            >
              <LockKeyhole className="h-3 w-3" />
              E2EE
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

function ReviewStatusControl({
  commentCount,
  requestCount,
  pendingCount,
  conflictCount = 0,
  reviewLabel,
  onAddComment,
  onOpenReview,
  mobile = false,
}: {
  commentCount: number;
  requestCount: number;
  pendingCount: number;
  conflictCount?: number;
  reviewLabel: string;
  onAddComment?: () => void;
  onOpenReview: () => void;
  mobile?: boolean;
}) {
  const hasItems = commentCount + requestCount + pendingCount + conflictCount > 0;
  const commentLabel = `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`;
  const requestLabel = `${requestCount} agent ${requestCount === 1 ? "request" : "requests"}`;
  const suggestionLabel = `${pendingCount} pending ${pendingCount === 1 ? "suggestion" : "suggestions"}`;
  const conflictLabel = `${conflictCount} incoming ${conflictCount === 1 ? "edit" : "edits"}`;

  if (!hasItems) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onAddComment || onOpenReview}
            aria-label={onAddComment ? "Add file comment" : reviewLabel}
            title={onAddComment ? "Add file comment" : reviewLabel}
            data-onboarding-target="review"
            className={cn(mobile && "h-11 w-11 shrink-0")}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{onAddComment ? "Add file comment" : reviewLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      data-onboarding-target="review"
      className={cn(
        "flex items-center border border-studio-line bg-studio-sunken",
        mobile ? "h-11 shrink-0 rounded-lg p-0" : "h-9 rounded-md p-0.5",
      )}
    >
      {commentCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Open review, ${commentLabel}`}
              title={commentLabel}
              onClick={onOpenReview}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-ink-muted transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
                mobile ? "h-11 min-w-11 px-2" : "h-8 min-w-8 px-2",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{commentCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{commentLabel}</TooltipContent>
        </Tooltip>
      )}
      {requestCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Open review, ${requestLabel}`}
              title={requestLabel}
              onClick={onOpenReview}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
                mobile ? "h-11 min-w-11 px-2" : "h-8 min-w-8 px-2",
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{requestCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{requestLabel}</TooltipContent>
        </Tooltip>
      )}
      {pendingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Open review, ${suggestionLabel}`}
              title={suggestionLabel}
              onClick={onOpenReview}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
                mobile ? "h-11 min-w-11 px-2" : "h-8 min-w-8 px-2",
              )}
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>{pendingCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{suggestionLabel}</TooltipContent>
        </Tooltip>
      )}
      {conflictCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Open review, ${conflictLabel}`}
              title={conflictLabel}
              onClick={onOpenReview}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded text-xs font-medium text-midnight-strong transition-colors hover:bg-midnight-soft hover:text-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
                mobile ? "h-11 min-w-11 px-2" : "h-8 min-w-8 px-2",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{conflictCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{conflictLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function PresenceStack({
  presences,
  fallbackPersona,
}: {
  presences: CollaborationPresence[];
  fallbackPersona?: RoomPersona | null;
}) {
  const displayPresences = uniquePresencesByPersona(presences);
  const personas = displayPresences.length
    ? displayPresences.map((presence) => presence.persona)
    : fallbackPersona
      ? [fallbackPersona]
      : [];
  if (personas.length === 0) return null;

  const visible = personas.slice(0, 3);
  const hiddenCount = Math.max(0, personas.length - visible.length);
  const label = displayPresences.length
    ? displayPresences.map((presence) => `${presenceLabel(presence)} ${presence.filePath}`).join(", ")
    : personas.map((persona) => persona.name).join(", ");
  const hasLiveActivity = displayPresences.some((presence) => presence.activity && presence.activity !== "idle");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="hidden h-8 shrink-0 items-center px-0.5 md:flex"
          role="group"
          aria-label={`Active collaborators: ${label}`}
          title={label}
        >
          <div className="flex items-center">
            {visible.map((persona, index) => (
              <PersonaAvatar
                key={persona.id}
                persona={persona}
                compact
                className={cn("h-6 w-6 ring-1 ring-studio-paper/80", index > 0 && "-ml-1.5")}
              />
            ))}
            {hiddenCount > 0 && (
              <span
                className="-ml-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rail px-1 text-[10px] font-medium text-ink-subtle ring-1 ring-studio-paper/80"
                aria-hidden="true"
              >
                +{hiddenCount}
              </span>
            )}
          </div>
          {(displayPresences.some((presence) => presence.status === "editing") || hasLiveActivity) && (
            <span className={cn("ml-1.5 h-1.5 w-1.5 rounded-full", hasLiveActivity ? "bg-midnight-strong" : "bg-ink-subtle")} aria-hidden="true" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MobilePresenceHint({ presences }: { presences: CollaborationPresence[] }) {
  const displayPresences = uniquePresencesByPersona(presences);
  if (displayPresences.length <= 1) return null;

  const visible = displayPresences.slice(0, 2);
  const hiddenCount = Math.max(0, displayPresences.length - visible.length);
  const label = displayPresences.map((presence) => `${presenceLabel(presence)} ${presence.filePath}`).join(", ");
  const hasLiveActivity = displayPresences.some((presence) => presence.activity && presence.activity !== "idle");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex h-11 shrink-0 items-center px-0.5 md:hidden"
          role="group"
          aria-label={`Active collaborators: ${label}`}
          title={label}
        >
          <div className="flex items-center" aria-hidden="true">
            {visible.map((presence, index) => (
              <PersonaAvatar
                key={presence.clientId}
                persona={presence.persona}
                compact
                className={cn("h-6 w-6 ring-1 ring-studio-paper/80", index > 0 && "-ml-1.5")}
              />
            ))}
            {hiddenCount > 0 && (
              <span className="-ml-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rail px-1 text-[10px] font-medium text-ink-subtle ring-1 ring-studio-paper/80">
                +{hiddenCount}
              </span>
            )}
          </div>
          {(displayPresences.some((presence) => presence.status === "editing") || hasLiveActivity) && (
            <span className={cn("ml-1 h-1.5 w-1.5 rounded-full", hasLiveActivity ? "bg-midnight-strong" : "bg-ink-subtle")} aria-hidden="true" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function presenceLabel(presence: CollaborationPresence) {
  if (presence.activity === "typing") return `${presence.persona.name} typing`;
  if (presence.activity === "commenting") return `${presence.persona.name} commenting`;
  return `${presence.persona.name} ${presence.status}`;
}

function presenceActivityLabel(presences: CollaborationPresence[]) {
  if (presences.some((presence) => presence.activity === "commenting")) return "commenting";
  if (presences.some((presence) => presence.activity === "typing")) return "typing";
  if (presences.some((presence) => presence.status === "editing")) return "editing";
  return "";
}

function uniquePresencesByPersona(presences: CollaborationPresence[]) {
  const byPersonaId = new Map<string, CollaborationPresence>();
  for (const presence of presences) {
    const existing = byPersonaId.get(presence.persona.id);
    if (!existing || presencePriority(presence) > presencePriority(existing) || (
      presencePriority(presence) === presencePriority(existing) && presence.updatedAt > existing.updatedAt
    )) {
      byPersonaId.set(presence.persona.id, presence);
    }
  }
  return Array.from(byPersonaId.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function presencePriority(presence: CollaborationPresence) {
  if (presence.activity && presence.activity !== "idle") return 2;
  if (presence.status === "editing") return 1;
  return 0;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = window.document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    window.document.body.appendChild(input);
    input.select();
    window.document.execCommand("copy");
    window.document.body.removeChild(input);
  }
}

function normalizePaletteFilePath(value: string) {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!trimmed || (!trimmed.includes(".") && !trimmed.includes("/"))) return "";
  const collapsed = trimmed
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!collapsed) return "";
  return collapsed.toLowerCase().endsWith(".md") ? collapsed : `${collapsed}.md`;
}

function normalizeSidebarCreatePath(value: string) {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!trimmed || trimmed.length < 2) return "";
  const collapsed = trimmed
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!collapsed) return "";
  const path = collapsed.includes("/") ? collapsed : `docs/${collapsed}`;
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function truncatePaletteDetail(value: string) {
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

function ModeIconButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong md:h-9 md:w-9",
        active ? "bg-midnight-soft text-ink" : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
        active ? "bg-midnight-soft text-ink" : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
