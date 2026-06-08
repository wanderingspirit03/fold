"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Command,
  Download,
  File,
  FileText,
  FolderClosed,
  FolderOpen,
  ListChecks,
  Link2,
  MessageSquare,
  MessageSquarePlus,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Upload,
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
import { PersonaChip } from "./PersonaChip";
import { SecurityStrip } from "./SecurityStrip";
import type { RoomMode } from "./types";

interface RoomShellProps {
  roomId: string;
  files: ProjectFile[];
  selectedFilePath: string;
  connected: boolean;
  ready: boolean;
  recordCount: number;
  pendingCount: number;
  reviewCount: number;
  selectedQuote?: string;
  persona?: RoomPersona | null;
  mode: RoomMode;
  error?: string | null;
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
  files,
  selectedFilePath,
  connected,
  ready,
  pendingCount,
  reviewCount,
  selectedQuote = "",
  persona,
  mode,
  error,
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
  const [recentFilePaths, setRecentFilePaths] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? files[0],
    [files, selectedFilePath],
  );
  const recentStorageKey = `fold:recent-files:${roomId}`;
  const recentFiles = useMemo(
    () => recentFilePaths
      .map((path) => files.find((file) => file.path === path))
      .filter((file): file is ProjectFile => Boolean(file))
      .slice(0, 4),
    [files, recentFilePaths],
  );

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

  const copyProjectLink = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = window.document.createElement("input");
      input.value = link;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      window.document.body.appendChild(input);
      input.select();
      window.document.execCommand("copy");
      window.document.body.removeChild(input);
    }
    onCopyProjectLink?.();
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
            files={files}
            recentFiles={recentFiles}
            onBack={onBack}
            onCopyProjectLink={copyProjectLink}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
            onImportFile={openImportPicker}
          />

          <div className="min-w-0 border-l border-studio-line bg-studio-sunken">
            <header className="sticky top-0 z-30 border-b border-studio-line bg-studio-paper/95 backdrop-blur">
              <div className="flex h-12 items-center justify-between gap-3 px-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setProjectFilesOpen(true)} aria-label="Open project files" className="md:hidden">
                    <FolderClosed className="h-4 w-4" />
                  </Button>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-studio-line bg-studio-sunken text-ink-muted">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-medium text-ink">{selectedFile.name}</h1>
                    <p className="truncate text-[11px] text-ink-subtle">{selectedFile.path}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCommandOpen(true)}
                        aria-label="Open command palette"
                      >
                        <Command className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Command palette</TooltipContent>
                  </Tooltip>
                  <ThemeToggle />
                  <div className="hidden rounded-md border border-studio-line bg-studio-sunken p-0.5 sm:flex">
                    <ModeButton active={mode === "read"} onClick={() => onModeChange("read")}>
                      <FileText className="h-3.5 w-3.5" />
                      Read
                    </ModeButton>
                    <ModeButton active={mode === "edit"} onClick={() => onModeChange("edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </ModeButton>
                  </div>
                  <div className="flex rounded-md border border-studio-line bg-studio-sunken p-0.5 sm:hidden">
                    <ModeIconButton active={mode === "read"} label="Read mode" onClick={() => onModeChange("read")}>
                      <FileText className="h-3.5 w-3.5" />
                    </ModeIconButton>
                    <ModeIconButton active={mode === "edit"} label="Edit mode" onClick={() => onModeChange("edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </ModeIconButton>
                  </div>
                  {persona && <PersonaChip persona={persona} compact className="hidden lg:inline-flex" />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setReviewOpen(true)}
                        aria-label="Open comments and suggestions"
                        className="relative"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {reviewCount > 0 && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-midnight-strong" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Comments and suggestions</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onExport} aria-label="Export Markdown">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export Markdown</TooltipContent>
                  </Tooltip>
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
                onBack={onBack}
                onCopyProjectLink={copyProjectLink}
                onClose={() => setProjectFilesOpen(false)}
              />
              <ProjectFilesBody
                files={files}
                recentFiles={recentFiles}
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
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setReviewOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-hidden rounded-t-md border-t border-studio-line bg-rail shadow-[0_-24px_80px_rgba(0,0,0,0.45)] md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-full md:max-w-[390px] md:rounded-none md:border-l md:border-t-0 md:shadow-[-24px_0_80px_rgba(0,0,0,0.45)]">
              <div className="flex h-12 items-center justify-between border-b border-studio-line px-4">
                <div className="flex items-center gap-2">
                  <PanelRightOpen className="h-4 w-4 text-midnight-strong" />
                  <span className="text-sm font-medium text-ink">Review</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)} aria-label="Close review">
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
            selectedFilePath={selectedFilePath}
            mode={mode}
            pendingCount={pendingCount}
            reviewCount={reviewCount}
            selectedQuote={selectedQuote}
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
          />
        )}
      </div>
    </TooltipProvider>
  );
}

interface ProjectFile {
  name: string;
  path: string;
  folder: string;
  active?: boolean;
  status?: string;
  commentCount?: number;
  pendingCount?: number;
}

function ProjectFileSidebar({
  roomId,
  files,
  recentFiles,
  onBack,
  onCopyProjectLink,
  onFileSelect,
  onCreateFile,
  onImportFile,
}: {
  roomId: string;
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  onBack: () => void;
  onCopyProjectLink: () => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onImportFile: () => void;
}) {
  return (
    <aside className="hidden min-h-dvh flex-col bg-studio-paper text-ink md:flex">
      <ProjectFilesHeader roomId={roomId} onBack={onBack} onCopyProjectLink={onCopyProjectLink} />
      <ProjectFilesBody
        files={files}
        recentFiles={recentFiles}
        onFileSelect={onFileSelect}
        onCreateFile={onCreateFile}
        onImportFile={onImportFile}
      />
    </aside>
  );
}

function ProjectFilesHeader({
  roomId,
  onBack,
  onCopyProjectLink,
  onClose,
}: {
  roomId: string;
  onBack: () => void;
  onCopyProjectLink: () => void;
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
          <h2 className="truncate text-sm font-semibold">Fold</h2>
        </div>
        <p className="truncate font-mono text-[11px] text-ink-subtle">{roomId?.slice(0, 18)}</p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onCopyProjectLink} aria-label="Copy project link" className="h-11 w-11">
            <Link2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy project link</TooltipContent>
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
  files,
  recentFiles,
  onFileSelect,
  onCreateFile,
  onImportFile,
}: {
  files: ProjectFile[];
  recentFiles: ProjectFile[];
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onImportFile: () => void;
}) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    docs: true,
    reports: true,
  });
  const [query, setQuery] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState("docs/untitled.md");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const requestedSearchPath = normalizeSidebarCreatePath(query);
  const fileTree = useMemo(() => buildProjectFileTree(files, normalizedQuery), [files, normalizedQuery]);
  const hasSearchResults = fileTree.files.length > 0 || fileTree.folders.some((folder) => treeHasFiles(folder));
  const hasExactSearchPath = requestedSearchPath
    ? files.some((file) => file.path.toLowerCase() === requestedSearchPath.toLowerCase())
    : false;
  const canCreateFromSearch = Boolean(normalizedQuery && requestedSearchPath && !hasExactSearchPath);
  const toggleFolder = (name: string) => {
    setOpenFolders((current) => ({ ...current, [name]: !(current[name] ?? true) }));
  };
  const handleFileSelect = (path: string) => {
    setQuery("");
    onFileSelect(path);
  };
  const handleCreateFile = (event: React.FormEvent) => {
    event.preventDefault();
    const path = newFilePath.trim();
    if (!path) return;
    createFile(path);
  };
  const createFile = (path: string) => {
    onCreateFile(path);
    setQuery("");
    setNewFilePath("docs/untitled.md");
    setIsCreatingFile(false);
  };

  useEffect(() => {
    if (!isCreatingFile) return;
    window.requestAnimationFrame(() => createInputRef.current?.focus());
  }, [isCreatingFile]);

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="border-b border-studio-line p-3">
        <label className="flex h-8 items-center gap-2 rounded-md border border-studio-line bg-studio-sunken px-2 text-xs text-ink-subtle focus-within:border-midnight/30 focus-within:bg-porcelain">
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
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
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
              <SidebarFile key={`recent:${file.path}`} file={file} depth={0} onFileSelect={handleFileSelect} />
            ))}
          </SidebarSection>
        )}
        <SidebarSection
          title="Project"
          className={cn(!normalizedQuery && recentFiles.length > 1 && "mt-4")}
          action={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Import Markdown file"
                title="Import Markdown file"
                onClick={onImportFile}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Create Markdown file"
                title="Create Markdown file"
                onClick={() => setIsCreatingFile((open) => !open)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          {isCreatingFile && (
            <form onSubmit={handleCreateFile} className="mb-2 flex items-center gap-1 rounded-md border border-studio-line bg-studio-sunken p-1">
              <input
                ref={createInputRef}
                aria-label="New Markdown file path"
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setIsCreatingFile(false);
                }}
                className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-xs text-ink outline-none placeholder:text-ink-subtle"
                placeholder="docs/new.md"
              />
              <button
                type="submit"
                aria-label="Create file"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-midnight text-white hover:bg-midnight-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
              >
                <Plus className="h-3.5 w-3.5" />
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
  depth = 0,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  depth?: number;
}) {
  const FolderIcon = open ? FolderOpen : FolderClosed;

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="mt-2 flex h-7 w-full items-center gap-1.5 rounded px-2 text-left text-xs text-ink-muted transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
    >
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      <FolderIcon className="h-3.5 w-3.5" />
      <span>{name}</span>
    </button>
  );
}

function SidebarFile({
  file,
  onFileSelect,
  depth = 0,
}: {
  file: ProjectFile;
  onFileSelect: (path: string) => void;
  depth?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onFileSelect(file.path)}
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
      className={cn(
        "group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
        file.active
          ? "bg-porcelain text-ink"
          : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      <File className="h-3.5 w-3.5 shrink-0 text-ink-subtle group-hover:text-ink-muted" />
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      <FileReviewIndicators commentCount={file.commentCount || 0} pendingCount={file.pendingCount || 0} />
      {file.status && <span className="rounded bg-studio-sunken px-1 text-[10px] text-ink-subtle">{file.status}</span>}
    </button>
  );
}

function FileReviewIndicators({
  commentCount,
  pendingCount,
}: {
  commentCount: number;
  pendingCount: number;
}) {
  const total = commentCount + pendingCount;
  if (total === 0) return null;

  const label = [
    commentCount ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : "",
    pendingCount ? `${pendingCount} pending ${pendingCount === 1 ? "suggestion" : "suggestions"}` : "",
  ].filter(Boolean).join(", ");

  return (
    <span
      aria-label={label}
      title={label}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded bg-studio-sunken px-1.5 text-[10px] font-medium text-ink-subtle group-hover:text-ink-muted"
    >
      <MessageSquare className="h-3 w-3" aria-hidden />
      <span>{total}</span>
    </span>
  );
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
      onClick={onCreateFile}
      className="mb-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-ink-muted transition-colors hover:bg-porcelain hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong"
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-midnight-strong" />
      <span className="min-w-0 flex-1 truncate">Create {name}</span>
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

  return (
    <div>
      <SidebarFolder
        name={folder.name}
        open={open}
        depth={depth}
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

  if (!query) {
    ["docs", "reports"].forEach((name) => ensureFolder(name, name));
  }

  for (const file of files) {
    if (query && !`${file.name} ${file.path}`.toLowerCase().includes(query)) continue;
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

function treeHasFiles(folder: ProjectTreeFolder): boolean {
  return folder.files.length > 0 || folder.folders.some(treeHasFiles);
}

type PaletteItem = {
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
  action: () => void;
  disabled?: boolean;
};

function ProjectCommandPalette({
  files,
  selectedFilePath,
  mode,
  pendingCount,
  reviewCount,
  selectedQuote,
  onClose,
  onFileSelect,
  onCreateFile,
  onImportFile,
  onModeChange,
  onExport,
  onCopyProjectLink,
  onOpenReview,
  onFocusCommentComposer,
}: {
  files: ProjectFile[];
  selectedFilePath: string;
  mode: RoomMode;
  pendingCount: number;
  reviewCount: number;
  selectedQuote: string;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onImportFile: () => void;
  onModeChange: (mode: RoomMode) => void;
  onExport: () => void;
  onCopyProjectLink: () => void;
  onOpenReview: () => void;
  onFocusCommentComposer: () => void;
}) {
  const [query, setQuery] = useState("");
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
      label: "Add comment to selection",
      detail: trimmedQuote ? truncatePaletteDetail(trimmedQuote) : "Select text in read mode first",
      icon: <MessageSquarePlus className="h-4 w-4" />,
      action: onFocusCommentComposer,
      disabled: !trimmedQuote,
    },
    {
      id: "show-comments",
      label: "Show comments",
      detail: `${commentCount} ${commentCount === 1 ? "comment" : "comments"} in current file`,
      icon: <MessageSquare className="h-4 w-4" />,
      action: onOpenReview,
    },
    {
      id: "show-suggestions",
      label: "Show pending suggestions",
      detail: `${pendingCount} ${pendingCount === 1 ? "suggestion" : "suggestions"} in current file`,
      icon: <ListChecks className="h-4 w-4" />,
      action: onOpenReview,
    },
    {
      id: "import-file",
      label: "Import Markdown file",
      detail: "Add local .md to project",
      icon: <Upload className="h-4 w-4" />,
      action: onImportFile,
    },
    {
      id: "copy-link",
      label: "Copy project link",
      detail: "Encrypted share link",
      icon: <Link2 className="h-4 w-4" />,
      action: onCopyProjectLink,
    },
    {
      id: "export",
      label: "Export current file",
      detail: selectedFilePath,
      icon: <Download className="h-4 w-4" />,
      action: onExport,
    },
    {
      id: "read",
      label: "Switch to read",
      detail: mode === "read" ? "Current mode" : selectedFilePath,
      icon: <FileText className="h-4 w-4" />,
      action: () => onModeChange("read"),
    },
    {
      id: "edit",
      label: "Switch to edit",
      detail: mode === "edit" ? "Current mode" : selectedFilePath,
      icon: <Pencil className="h-4 w-4" />,
      action: () => onModeChange("edit"),
    },
  ];
  const fileItems: PaletteItem[] = files.map((file) => ({
    id: `file:${file.path}`,
    label: file.name,
    detail: file.path,
    icon: <File className="h-4 w-4" />,
    action: () => onFileSelect(file.path),
  }));
  const createItem: PaletteItem[] = requestedPath && !matchingFile
    ? [{
      id: `create:${requestedPath}`,
      label: `Create ${requestedPath.split("/").pop() || requestedPath}`,
      detail: requestedPath,
      icon: <Plus className="h-4 w-4" />,
      action: () => onCreateFile(requestedPath),
    }]
    : [];
  const items = [...createItem, ...fileItems, ...staticItems]
    .filter((item) => {
      if (!normalizedQuery) return true;
      return `${item.label} ${item.detail}`.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 10);

  const runFirstItem = (event: React.FormEvent) => {
    event.preventDefault();
    items.find((item) => !item.disabled)?.action();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
        className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleDialogKeyDown}
        className="fixed left-1/2 top-16 z-[70] w-[min(640px,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-md border border-studio-line bg-studio-paper shadow-[0_28px_90px_rgba(0,0,0,0.28)]"
      >
        <form onSubmit={runFirstItem} className="border-b border-studio-line">
          <label className="flex h-12 items-center gap-2 px-3 text-ink-muted">
            <Search className="h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              aria-label="Search commands and files"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Open file or command"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
            <span className="rounded border border-studio-line px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">Esc</span>
          </label>
        </form>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-subtle">No matches</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={item.action}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
                  item.disabled && "cursor-not-allowed opacity-45",
                  !item.disabled && (index === 0 ? "bg-studio-sunken" : "hover:bg-studio-sunken"),
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-studio-line bg-studio-sunken text-ink-subtle">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{item.label}</span>
                  <span className="block truncate text-[11px] text-ink-subtle">{item.detail}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function normalizePaletteFilePath(value: string) {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!trimmed || !trimmed.includes(".")) return "";
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
        "inline-flex h-8 w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight-strong",
        active ? "bg-midnight text-white shadow-sm" : "text-ink-muted hover:bg-porcelain hover:text-ink",
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
        active ? "bg-midnight text-white shadow-sm" : "text-ink-muted hover:bg-porcelain hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
