"use client";

import {
  GitBranchIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  LoaderIcon,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RepoSummaryCard } from "./repo-summary-card";
import type { GitHubRepoMetadata } from "@/lib/types/github";


function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\/+$/, "");
  const match = trimmed.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export type RepoInfo = {
  url: string;
  owner: string;
  repo: string;
};

async function fetchRepoMetadata(
  owner: string,
  repo: string
): Promise<GitHubRepoMetadata> {
  const res = await fetch(
    `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error ?? `Failed to fetch repository (${res.status})`
    );
  }
  return res.json();
}

export function RepoInput({
  onRepoLoaded,
}: {
  onRepoLoaded?: (repo: RepoInfo) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedRepo, setLoadedRepo] = useState<RepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<GitHubRepoMetadata | null>(null);

  const handleAnalyze = useCallback(async () => {
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    const parsed = parseGitHubUrl(trimmed);
    if (!parsed) {
      setError(
        "Invalid URL. Please use the format: https://github.com/{owner}/{repo}"
      );
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchRepoMetadata(parsed.owner, parsed.repo);
      const repo: RepoInfo = {
        url: trimmed.replace(/\/+$/, ""),
        owner: parsed.owner,
        repo: parsed.repo,
      };
      setMetadata(data);
      setLoadedRepo(repo);
      onRepoLoaded?.(repo);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [url, onRepoLoaded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAnalyze();
      }
    },
    [handleAnalyze]
  );

  const handleClear = useCallback(() => {
    setLoadedRepo(null);
    setMetadata(null);
    setUrl("");
    setError(null);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="fade-up mx-auto w-full max-w-4xl px-2 pt-3 md:px-4 md:pt-4">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-300",
            error
              ? "border-destructive/40 shadow-[0_0_0_1px_var(--destructive)/10]"
              : loadedRepo
                ? "border-emerald-500/30 shadow-[0_0_12px_-4px_oklch(0.7_0.15_155/0.15)]"
                : "border-border/50 shadow-[var(--shadow-card)]"
          )}
        >
          {/* Subtle top gradient accent */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-px transition-colors duration-300",
              loadedRepo
                ? "bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
                : "bg-gradient-to-r from-transparent via-border to-transparent"
            )}
          />

          <div className="flex flex-col gap-2.5 p-3 md:p-4">
            {/* Label row */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-md transition-colors duration-300",
                  loadedRepo
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <GitBranchIcon className="size-3.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                GitHub Repository
              </span>
            </div>

            {/* Input row */}
            {!loadedRepo ? (
              <div className="flex gap-2">
                <Input
                  aria-invalid={!!error}
                  className="h-10 flex-1 rounded-lg border-border/60 bg-background/60 font-mono text-[13px] placeholder:font-sans placeholder:text-muted-foreground/50"
                  disabled={isLoading}
                  id="repo-url-input"
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="https://github.com/owner/repo"
                  type="url"
                  value={url}
                />
                <Button
                  className={cn(
                    "h-10 gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-all",
                    isLoading && "pointer-events-none"
                  )}
                  disabled={isLoading || !url.trim()}
                  id="analyze-repo-button"
                  onClick={handleAnalyze}
                  size="default"
                  variant="default"
                >
                  {isLoading ? (
                    <>
                      <LoaderIcon className="size-3.5 animate-spin" />
                      <span className="hidden sm:inline">Fetching…</span>
                    </>
                  ) : (
                    <span>Analyze Repository</span>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Repository Loaded ✅
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {loadedRepo.owner}/{loadedRepo.repo}
                    </span>
                  </div>
                </div>
                <Button
                  className="h-8 rounded-lg text-xs"
                  id="change-repo-button"
                  onClick={handleClear}
                  size="sm"
                  variant="outline"
                >
                  Change
                </Button>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="fade-up flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 dark:bg-destructive/10">
                <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="text-xs leading-relaxed text-destructive">
                  {error}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Repository Summary Card */}
      {metadata && <RepoSummaryCard data={metadata} />}
    </div>
  );
}
