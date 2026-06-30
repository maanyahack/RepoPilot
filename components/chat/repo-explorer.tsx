"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderTreeIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  LoaderIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RepoTreeNode } from "./repo-tree-node";
import type {
  GitHubTreeItem,
  GitHubTreeNode,
} from "@/lib/types/github";

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

export function RepoExplorer({
  owner,
  repo,
  defaultBranch,
  onFileClick,
}: RepoExplorerProps) {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  const fetchTree = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(defaultBranch)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Failed to fetch tree (${res.status})`
        );
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

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className="fade-up mx-auto w-full max-w-4xl px-2 md:px-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-300",
          "border-border/50 shadow-[var(--shadow-card)]"
        )}
      >
        {/* Top gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="flex flex-col gap-2 p-3 md:p-4">
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

              <div className="max-h-[400px] overflow-y-auto rounded-md">
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
                        onFileClick={onFileClick}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
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
