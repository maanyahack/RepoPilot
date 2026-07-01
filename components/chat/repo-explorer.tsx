"use client";

import {
  AlertCircleIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderTreeIcon,
  LoaderIcon,
  RefreshCwIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitHubTreeItem, GitHubTreeNode } from "@/lib/types/github";
import { cn } from "@/lib/utils";
import { RepoTreeNode } from "./repo-tree-node";

/**
 * Transform the flat GitHub tree array into a nested GitHubTreeNode hierarchy.
 * Folders are sorted before files at every level; names are sorted alphabetically.
 */
function buildNestedTree(items: GitHubTreeItem[]): GitHubTreeNode[] {
  const root: GitHubTreeNode[] = [];
  const directoryMap = new Map<string, GitHubTreeNode>();

  // First pass: create all directory nodes
  for (const item of items) {
    if (item.type === "tree") {
      const name = item.path.split("/").pop() ?? item.path;
      const node: GitHubTreeNode = {
        name,
        path: item.path,
        type: "directory",
        sha: item.sha,
        children: [],
      };
      directoryMap.set(item.path, node);
    }
  }

  // Second pass: create file nodes and attach everything to parents
  for (const item of items) {
    const name = item.path.split("/").pop() ?? item.path;
    const parentPath = item.path.includes("/")
      ? item.path.substring(0, item.path.lastIndexOf("/"))
      : null;

    if (item.type === "tree") {
      const node = directoryMap.get(item.path)!;
      if (parentPath && directoryMap.has(parentPath)) {
        directoryMap.get(parentPath)!.children!.push(node);
      } else {
        root.push(node);
      }
    } else {
      const fileNode: GitHubTreeNode = {
        name,
        path: item.path,
        type: "file",
        sha: item.sha,
        size: item.size,
      };
      if (parentPath && directoryMap.has(parentPath)) {
        directoryMap.get(parentPath)!.children!.push(fileNode);
      } else {
        root.push(fileNode);
      }
    }
  }

  // Sort recursively: directories first, then alphabetical
  function sortNodes(nodes: GitHubTreeNode[]): GitHubTreeNode[] {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
    return nodes;
  }

  return sortNodes(root);
}

type RepoExplorerProps = {
  owner: string;
  repo: string;
  defaultBranch: string;
  onFileClick?: (node: GitHubTreeNode) => void;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; tree: GitHubTreeNode[]; truncated: boolean };

type FileContentState =
  | { status: "idle"; content: "" }
  | { status: "loading"; content: "" }
  | { status: "error"; content: ""; error: string }
  | { status: "success"; content: string };

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "cs":
    case "swift":
    case "kt":
    case "dart":
    case "lua":
    case "sh":
    case "bash":
    case "zsh":
    case "php":
    case "vue":
    case "svelte":
      return FileCodeIcon;
    case "json":
    case "jsonc":
      return FileJsonIcon;
    case "md":
    case "mdx":
    case "txt":
    case "rst":
    case "csv":
      return FileTextIcon;
    case "yml":
    case "yaml":
    case "toml":
    case "ini":
    case "cfg":
    case "env":
      return SettingsIcon;
    default:
      return FileIcon;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormattedContent(name: string, content: string): string {
  const ext = name.split(".").pop()?.toLowerCase();

  if (ext === "md" || ext === "mdx") {
    return content;
  }

  if (ext === "json" || name === "package.json") {
    try {
      const parsed = JSON.parse(content);
      const pretty = JSON.stringify(parsed, null, 2);
      return `\`\`\`json\n${pretty}\n\`\`\``;
    } catch {
      return `\`\`\`json\n${content}\n\`\`\``;
    }
  }

  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "c",
    h: "cpp",
    hpp: "cpp",
    cs: "csharp",
    swift: "swift",
    kt: "kotlin",
    dart: "dart",
    lua: "lua",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    php: "php",
    vue: "vue",
    svelte: "svelte",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    html: "html",
    css: "css",
    sql: "sql",
  };

  const lang = (ext && langMap[ext]) || ext || "text";
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

function isBinaryContent(content: string): boolean {
  // Check the first 8000 characters for null bytes or a high proportion of control characters
  const checkLimit = Math.min(content.length, 8000);
  let controlChars = 0;
  for (let i = 0; i < checkLimit; i++) {
    const code = content.charCodeAt(i);
    // Null byte or control characters (excluding tab, LF, CR)
    if (
      code === 0 ||
      (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
      code === 127
    ) {
      controlChars++;
      if (controlChars > 10) {
        return true;
      }
    }
  }
  return false;
}

export function RepoExplorer({
  owner,
  repo,
  defaultBranch,
  onFileClick,
}: RepoExplorerProps) {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [selectedFile, setSelectedFile] = useState<GitHubTreeNode | null>(null);
  const [fileContentState, setFileContentState] = useState<FileContentState>({
    status: "idle",
    content: "",
  });

  const fetchTree = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(defaultBranch)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch tree (${res.status})`);
      }
      const data = await res.json();
      const nested = buildNestedTree(data.tree ?? []);
      setState({
        status: "success",
        tree: nested,
        truncated: data.truncated ?? false,
      });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  }, [owner, repo, defaultBranch]);

  const fetchFileContent = useCallback(
    async (file: GitHubTreeNode) => {
      setFileContentState({ status: "loading", content: "" });
      try {
        const res = await fetch(
          `/api/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(file.path)}&branch=${encodeURIComponent(defaultBranch)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error ?? `Failed to fetch file content (${res.status})`
          );
        }
        const data = await res.json();
        setFileContentState({ status: "success", content: data.content });
      } catch (err) {
        setFileContentState({
          status: "error",
          content: "",
          error:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        });
      }
    },
    [owner, repo, defaultBranch]
  );

  useEffect(() => {
    fetchTree();
    setSelectedFile(null);
  }, [fetchTree]);

  useEffect(() => {
    if (!selectedFile) {
      setFileContentState({ status: "idle", content: "" });
      return;
    }
    fetchFileContent(selectedFile);
  }, [selectedFile, fetchFileContent]);

  const handleFileClick = useCallback(
    (node: GitHubTreeNode) => {
      setSelectedFile(node);
      onFileClick?.(node);
    },
    [onFileClick]
  );

  const handleCloseFileViewer = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const ViewerIcon = selectedFile ? getFileIcon(selectedFile.name) : FileIcon;

  return (
    <div className="fade-up mx-auto w-full max-w-4xl px-2 md:px-4">
      <div
        className={cn(
          "flex w-full gap-4",
          selectedFile ? "flex-col md:flex-row items-stretch" : "flex-col"
        )}
      >
        {/* Repository Tree Explorer Card */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-300",
            "border-border/50 shadow-[var(--shadow-card)] flex flex-col justify-between",
            selectedFile ? "w-full md:w-[40%] md:min-w-[300px]" : "w-full"
          )}
        >
          {/* Top gradient accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <div className="flex flex-col gap-2 p-3 md:p-4 flex-1">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FolderTreeIcon className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Repository Files
                </span>
              </div>

              {state.status === "success" && (
                <Button
                  className="h-7 gap-1 rounded-lg px-2 text-[11px]"
                  id="refresh-tree-button"
                  onClick={fetchTree}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCwIcon className="size-3" />
                  Refresh
                </Button>
              )}
            </div>

            {/* Loading state */}
            {(state.status === "idle" || state.status === "loading") && (
              <div className="flex flex-col gap-1.5 py-1">
                <TreeSkeleton />
              </div>
            )}

            {/* Error state */}
            {state.status === "error" && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 dark:bg-destructive/10">
                  <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span className="text-xs leading-relaxed text-destructive">
                    {state.message}
                  </span>
                </div>
                <Button
                  className="h-8 gap-1.5 text-xs"
                  id="retry-tree-button"
                  onClick={fetchTree}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCwIcon className="size-3" />
                  Retry
                </Button>
              </div>
            )}

            {/* Success state */}
            {state.status === "success" && (
              <>
                {state.truncated && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertCircleIcon className="size-3 shrink-0" />
                    <span>
                      This repository is large. Some files may not be shown.
                    </span>
                  </div>
                )}

                <div className="max-h-[400px] overflow-y-auto rounded-md scrollbar-gutter-stable">
                  <div className="flex flex-col py-0.5">
                    {state.tree.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        This repository appears to be empty.
                      </p>
                    ) : (
                      state.tree.map((node) => (
                        <RepoTreeNode
                          depth={0}
                          key={node.path}
                          node={node}
                          onFileClick={handleFileClick}
                          selectedPath={selectedFile?.path}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* File Viewer Card */}
        {selectedFile && (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-300",
              "border-border/50 shadow-[var(--shadow-card)] flex flex-col w-full md:w-[60%] h-[450px] md:h-auto"
            )}
          >
            {/* Top gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 p-3 md:px-4 md:py-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                  <ViewerIcon className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-xs font-semibold text-foreground truncate"
                    title={selectedFile.path}
                  >
                    {selectedFile.name}
                  </span>
                  <span
                    className="text-[10px] text-muted-foreground truncate"
                    title={selectedFile.path}
                  >
                    {selectedFile.path}
                  </span>
                </div>
                {selectedFile.size !== undefined && selectedFile.size > 0 && (
                  <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground shrink-0">
                    {formatSize(selectedFile.size)}
                  </span>
                )}
              </div>
              <Button
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                id="close-file-viewer-button"
                onClick={handleCloseFileViewer}
                size="icon"
                variant="ghost"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close File Viewer</span>
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              {fileContentState.status === "loading" && (
                <div className="flex size-full flex-col items-center justify-center gap-2 py-12">
                  <LoaderIcon className="size-5 animate-spin text-muted-foreground/60" />
                  <span className="text-xs text-muted-foreground/80">
                    Fetching file contents…
                  </span>
                </div>
              )}

              {fileContentState.status === "error" && (
                <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2.5 dark:bg-destructive/10 max-w-sm">
                    <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <span className="text-xs leading-relaxed text-destructive font-medium">
                      {fileContentState.error}
                    </span>
                  </div>
                  <Button
                    className="h-8 gap-1.5 text-xs rounded-lg"
                    onClick={() => fetchFileContent(selectedFile)}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCwIcon className="size-3" />
                    Retry
                  </Button>
                </div>
              )}

              {fileContentState.status === "success" && (
                <div className="p-4 overflow-x-auto select-text scrollbar-gutter-stable">
                  {fileContentState.content.trim() === "" ? (
                    <div className="flex py-12 flex-col items-center justify-center text-center text-muted-foreground">
                      <span className="text-xs italic">
                        This file is empty.
                      </span>
                    </div>
                  ) : isBinaryContent(fileContentState.content) ? (
                    <div className="flex py-12 flex-col items-center justify-center text-center text-muted-foreground gap-1.5">
                      <AlertCircleIcon className="size-5 text-muted-foreground/50" />
                      <span className="text-xs font-semibold text-foreground">
                        Binary File
                      </span>
                      <span className="text-[11px] text-muted-foreground max-w-xs">
                        This file cannot be displayed because it is binary or
                        has unsupported character encoding.
                      </span>
                    </div>
                  ) : (
                    <div className="prose dark:prose-invert max-w-none text-foreground text-[13px] leading-relaxed">
                      <MessageResponse className="[&_pre]:my-0 [&_pre]:rounded-lg">
                        {getFormattedContent(
                          selectedFile.name,
                          fileContentState.content
                        )}
                      </MessageResponse>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Skeleton loader that mimics the tree shape */
function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-2">
        <LoaderIcon className="size-3.5 animate-spin text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/60">
          Loading repository files…
        </span>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          className="flex items-center gap-2 px-2"
          key={`skel-${
            // biome-ignore lint: index-based key is fine for static skeleton
            i
          }`}
          style={{ paddingLeft: 12 + (i % 3) * 16 }}
        >
          <Skeleton
            className={cn(
              "h-4 rounded",
              i % 4 === 0 ? "w-24" : i % 3 === 0 ? "w-32" : "w-20"
            )}
          />
        </div>
      ))}
    </div>
  );
}
