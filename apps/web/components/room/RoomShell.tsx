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
  onImportFile: (file: File) => void;
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
  onImportFile,
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
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
  const commentCount = Math.max(0, reviewCount - pendingCount - conflictCount);
  const securityLabel = !connected ? "E2EE offline" : !ready ? "E2EE replaying" : "E2EE";
  const humanInviteHasWarnings = Boolean(humanInvite?.warnings?.length);
  const humanInviteAriaLabel = projectLinkCopied
    ? "Human invite copied"
    : humanInviteHasWarnings
      ? "Invite human with local network warning"
      : "Invite human";
  const humanInviteTooltip = projectLinkCopied
    ? "Copied"
    : humanInviteHasWarnings
      ? "Invite human, local URLs"
      : "Invite human";
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
    window.setTimeout(() => setProjectLinkCopied(false), 1400);
    onCopyProjectLink?.();
  };
  const copyAgentInvite = async () => {
    if (!agentInvite) return;
    await copyText(agentInvite.text);
    setAgentInviteCopied(true);
    window.setTimeout(() => setAgentInviteCopied(false), 1400);
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
            projectLinkCopied={projectLinkCopied}
            humanInviteHasWarnings={humanInviteHasWarnings}
            humanInviteAriaLabel={humanInviteAriaLabel}
            humanInviteTooltip={humanInviteTooltip}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
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
                  <div className="hidden rounded-md border border-studio-line bg-studio-sunken p-0.5 md:flex">
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
                    pendingCount={pendingCount}
                    conflictCount={conflictCount}
                    reviewLabel={reviewLabel}
                    onAddComment={onFocusCommentComposer}
                    onOpenReview={() => setReviewOpen(true)}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={copyProjectLink}
                        aria-label={humanInviteAriaLabel}
                      >
                        {projectLinkCopied ? <Check className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
                        <span className="sr-only" aria-live="polite">
                          {projectLinkCopied ? "Human invite copied" : ""}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{humanInviteTooltip}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void copyAgentInvite()}
                        aria-label={agentInviteAriaLabel}
                        disabled={!agentInvite}
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
                    pendingCount={pendingCount}
                    conflictCount={conflictCount}
                    reviewLabel={reviewLabel}
                    onAddComment={onFocusCommentComposer}
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
                  <div className="flex rounded-md border border-studio-line bg-studio-sunken p-0.5">
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
          />
        )}
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
  pendingCount?: number;
  conflictCount?: number;
  activePresences?: CollaborationPresence[];
}

function ProjectFileSidebar({
  roomId,
  projectName,
  files,
  recentFiles,
  onBack,
  onCopyProjectLink,
  projectLinkCopied = false,
  humanInviteHasWarnings = false,
  humanInviteAriaLabel,
  humanInviteTooltip,
  onFileSelect,
  onCreateFile,
  onImportFile,
  onOpenReview,
}: {
  roomId: string;
  projectName: string;
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  onBack: () => void;
  onCopyProjectLink: () => void;
  projectLinkCopied?: boolean;
  humanInviteHasWarnings?: boolean;
  humanInviteAriaLabel?: string;
  humanInviteTooltip?: string;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="fold-logo-mark h-5 w-5 shrink-0" />
          <h2 data-project-title className="truncate text-sm font-semibold" title={projectName}>{projectName}</h2>
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
            aria-label={humanInviteAriaLabel || (projectLinkCopied ? "Human invite copied" : humanInviteHasWarnings ? "Invite human with local network warning" : "Invite human")}
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
              {projectLinkCopied ? "Human invite copied" : ""}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{humanInviteTooltip || (projectLinkCopied ? "Copied" : humanInviteHasWarnings ? "Invite human, local URLs" : "Invite human")}</TooltipContent>
      </Tooltip>
      {onClose && (
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close project files" className="h-11 w-11">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ProjectFilesBody({
  roomId,
  files,
  recentFiles,
  autoFocusSearch = false,
  onFileSelect,
  onCreateFile,
  onImportFile,
  onOpenReview,
}: {
  roomId: string;
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  autoFocusSearch?: boolean;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
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
  const activeFiles = useMemo(
    () => files
      .filter((file) => uniquePresencesByPersona(file.activePresences || []).length > 1)
      .filter((file) => (file.commentCount || 0) + (file.pendingCount || 0) + (file.conflictCount || 0) === 0)
      .sort(compareProjectActivityFiles)
      .slice(0, 4),
    [files],
  );
  const reviewFiles = useMemo(
    () => files
      .filter((file) => (file.commentCount || 0) + (file.pendingCount || 0) + (file.conflictCount || 0) > 0)
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
            <SidebarFile key={file.path} file={file} depth={0} onFileSelect={handleFileSelect} />
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
  pendingCount = 0,
  conflictCount = 0,
  depth = 0,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  commentCount?: number;
  pendingCount?: number;
  conflictCount?: number;
  depth?: number;
}) {
  const FolderIcon = open ? FolderOpen : FolderClosed;
  const indicatorLabel = reviewIndicatorLabel(commentCount, pendingCount, conflictCount);

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
      <FileReviewIndicators commentCount={commentCount} pendingCount={pendingCount} conflictCount={conflictCount} />
    </button>
  );
}

function SidebarFile({
  file,
  onFileSelect,
  depth = 0,
  showUpdatedAt = false,
  ariaLabel,
}: {
  file: ProjectFile;
  onFileSelect: (path: string) => void;
  depth?: number;
  showUpdatedAt?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onFileSelect(file.path)}
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
      className={cn(
        "group flex h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors md:h-8",
        file.active
          ? "bg-porcelain text-ink"
          : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      <File className="h-3.5 w-3.5 shrink-0 text-ink-subtle group-hover:text-ink-muted" />
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      <FilePresenceIndicators presences={file.activePresences || []} />
      <FileReviewIndicators commentCount={file.commentCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />
      {showUpdatedAt && file.updatedAt && (
        <span className="hidden shrink-0 font-mono text-[10px] text-ink-subtle group-hover:text-ink-muted lg:inline">
          {formatRelativeTime(file.updatedAt)}
        </span>
      )}
      {file.status && <span className="rounded bg-studio-sunken px-1 text-[10px] text-ink-subtle">{file.status}</span>}
    </button>
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
  pendingCount,
  conflictCount,
}: {
  commentCount: number;
  pendingCount: number;
  conflictCount: number;
}) {
  const total = commentCount + pendingCount + conflictCount;
  if (total === 0) return null;

  const label = reviewIndicatorLabel(commentCount, pendingCount, conflictCount);
  const Icon = conflictCount > 0 ? AlertTriangle : MessageSquare;

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

function reviewIndicatorLabel(commentCount: number, pendingCount: number, conflictCount = 0) {
  return [
    commentCount ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "",
    pendingCount ? `${pendingCount} pending ${pendingCount === 1 ? "suggestion" : "suggestions"}` : "",
    conflictCount ? `${conflictCount} incoming ${conflictCount === 1 ? "edit" : "edits"}` : "",
  ].filter(Boolean).join(", ");
}

function reviewFileLabel(file: ProjectFile) {
  const label = reviewIndicatorLabel(file.commentCount || 0, file.pendingCount || 0, file.conflictCount || 0);
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
}: {
  folder: ProjectTreeFolder;
  depth: number;
  forceOpen: boolean;
  openFolders: Record<string, boolean>;
  onToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
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
            />
          ))}
          {folder.files.map((file) => (
            <SidebarFile key={file.path} file={file} depth={depth + 1} onFileSelect={onFileSelect} />
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

  const aPending = a.pendingCount || 0;
  const bPending = b.pendingCount || 0;
  if (aPending !== bPending) return bPending - aPending;

  const aTotal = (a.commentCount || 0) + aPending;
  const bTotal = (b.commentCount || 0) + bPending;
  if (aTotal !== bTotal) return bTotal - aTotal;

  return compareProjectFiles(a, b);
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
      counts.pendingCount += childCounts.pendingCount;
      counts.conflictCount += childCounts.conflictCount;
      return counts;
    },
    {
      commentCount: folder.files.reduce((count, file) => count + (file.commentCount || 0), 0),
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
}: {
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  selectedFilePath: string;
  mode: RoomMode;
  pendingCount: number;
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
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const requestedPath = normalizePaletteFilePath(query);
  const matchingFile = requestedPath ? files.some((file) => file.path.toLowerCase() === requestedPath.toLowerCase()) : false;
  const commentCount = Math.max(0, reviewCount - pendingCount);
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
    {
      id: "add-comment",
      label: trimmedQuote ? "Add comment to selection" : "Add file comment",
      detail: trimmedQuote ? truncatePaletteDetail(trimmedQuote) : selectedFilePath,
      group: "actions",
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
      label: "Invite human",
      detail: humanInviteHasWarnings ? "Copy join handoff with local URL warning" : "Copy browser join handoff",
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
    meta: <FileReviewIndicators commentCount={file.commentCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
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
          meta: <FileReviewIndicators commentCount={file.commentCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
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
    meta: <FileReviewIndicators commentCount={file.commentCount || 0} pendingCount={file.pendingCount || 0} conflictCount={file.conflictCount || 0} />,
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
  pendingCount,
  conflictCount = 0,
  reviewLabel,
  onAddComment,
  onOpenReview,
  mobile = false,
}: {
  commentCount: number;
  pendingCount: number;
  conflictCount?: number;
  reviewLabel: string;
  onAddComment?: () => void;
  onOpenReview: () => void;
  mobile?: boolean;
}) {
  const hasItems = commentCount + pendingCount + conflictCount > 0;
  const commentLabel = `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`;
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
