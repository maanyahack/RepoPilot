"use client";

import { useState, useCallback } from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  FileTextIcon,
  FileCodeIcon,
  ImageIcon,
  FileJsonIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubTreeNode } from "@/lib/types/github";

/** Map file extensions to specific icons for richer visual feedback. */
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
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
    case "bmp":
      return ImageIcon;
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

type RepoTreeNodeProps = {
  node: GitHubTreeNode;
  depth: number;
  onFileClick?: (node: GitHubTreeNode) => void;
  defaultOpen?: boolean;
};

export function RepoTreeNode({
  node,
  depth,
  onFileClick,
  defaultOpen = false,
}: RepoTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleFileClick = useCallback(() => {
    onFileClick?.(node);
  }, [node, onFileClick]);

  const paddingLeft = 12 + depth * 16;

  if (node.type === "directory") {
    return (
      <div>
        <button
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-1.5 py-[5px] text-left text-[13px] transition-colors",
            "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          id={`tree-dir-${node.path.replace(/\//g, "-")}`}
          onClick={toggleOpen}
          style={{ paddingLeft }}
          type="button"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          {isOpen ? (
            <FolderOpenIcon className="size-4 shrink-0 text-sky-500 dark:text-sky-400" />
          ) : (
            <FolderIcon className="size-4 shrink-0 text-sky-500 dark:text-sky-400" />
          )}
          <span className="truncate font-medium text-foreground/90">
            {node.name}
          </span>
        </button>

        {isOpen && node.children && (
          <div className="animate-in fade-in-0 slide-in-from-top-1 duration-150">
            {node.children.map((child) => (
              <RepoTreeNode
                defaultOpen={false}
                depth={depth + 1}
                key={child.path}
                node={child}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const Icon = getFileIcon(node.name);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-[5px] text-left text-[13px] transition-colors",
        "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      )}
      id={`tree-file-${node.path.replace(/\//g, "-")}`}
      onClick={handleFileClick}
      style={{ paddingLeft: paddingLeft + 18 }}
      type="button"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground/70" />
      <span className="truncate text-foreground/80">{node.name}</span>
      {node.size !== undefined && node.size > 0 && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-muted-foreground/50">
          {formatSize(node.size)}
        </span>
      )}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
