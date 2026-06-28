"use client";

import {
  StarIcon,
  GitForkIcon,
  TagIcon,
  ScaleIcon,
  GitBranchIcon,
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  CircleDotIcon,
  ArchiveIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubRepoMetadata } from "@/lib/types/github";

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/** Maps common languages to tailwind-ish colors */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-sky-500",
  Rust: "bg-orange-600",
  Go: "bg-cyan-500",
  Java: "bg-red-500",
  "C++": "bg-pink-600",
  C: "bg-gray-500",
  Ruby: "bg-red-600",
  Swift: "bg-orange-500",
  Kotlin: "bg-purple-500",
  Dart: "bg-teal-500",
  PHP: "bg-indigo-400",
  Shell: "bg-green-500",
  Lua: "bg-indigo-600",
  "C#": "bg-violet-600",
  HTML: "bg-orange-500",
  CSS: "bg-purple-400",
  Vue: "bg-emerald-500",
  Scala: "bg-red-400",
  Elixir: "bg-purple-600",
  Haskell: "bg-slate-500",
  Zig: "bg-amber-500",
};

export function RepoSummaryCard({ data }: { data: GitHubRepoMetadata }) {
  const langColor = data.language
    ? LANGUAGE_COLORS[data.language] ?? "bg-muted-foreground"
    : null;

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

        <div className="flex flex-col gap-3 p-3 md:p-4">
          {/* Header row: Avatar + Name + Link */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {data.avatarUrl && (
                <img
                  alt={`${data.owner}'s avatar`}
                  className="size-10 rounded-lg border border-border/40 shadow-sm"
                  src={data.avatarUrl}
                />
              )}
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-sm font-semibold text-foreground">
                    {data.owner}
                    <span className="text-muted-foreground">/</span>
                    {data.name}
                  </span>
                  {data.isArchived && (
                    <span className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      <ArchiveIcon className="size-2.5" />
                      Archived
                    </span>
                  )}
                  {data.isFork && (
                    <span className="flex items-center gap-1 rounded-md border border-muted-foreground/20 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <GitForkIcon className="size-2.5" />
                      Fork
                    </span>
                  )}
                </div>
                {data.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {data.description}
                  </p>
                )}
              </div>
            </div>

            <a
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              href={data.htmlUrl}
              id="view-on-github-link"
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-3" />
              <span className="hidden sm:inline">View on GitHub</span>
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/30 pt-2.5">
            <StatPill icon={StarIcon} label="Stars" value={formatNumber(data.stars)} />
            <StatPill icon={GitForkIcon} label="Forks" value={formatNumber(data.forks)} />
            <StatPill icon={EyeIcon} label="Watchers" value={formatNumber(data.watchers)} />
            <StatPill
              icon={CircleDotIcon}
              label="Issues"
              value={formatNumber(data.openIssues)}
            />

            {data.language && (
              <div className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", langColor)} />
                <span className="text-xs text-muted-foreground">{data.language}</span>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/80">
            {data.license && data.license !== "NOASSERTION" && (
              <MetaItem icon={ScaleIcon} text={data.license} />
            )}
            <MetaItem icon={GitBranchIcon} text={data.defaultBranch} />
            <MetaItem icon={ClockIcon} text={`Updated ${formatDate(data.lastUpdated)}`} />
          </div>

          {/* Topics */}
          {data.topics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/30 pt-2.5">
              <TagIcon className="size-3 text-muted-foreground/60" />
              {data.topics.slice(0, 8).map((topic) => (
                <span
                  className="rounded-md border border-primary/10 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary/70 transition-colors hover:bg-primary/10"
                  key={topic}
                >
                  {topic}
                </span>
              ))}
              {data.topics.length > 8 && (
                <span className="text-[10px] text-muted-foreground/50">
                  +{data.topics.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon className="size-3.5 text-muted-foreground/60" />
      <span className="text-xs font-medium tabular-nums text-foreground/80">{value}</span>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="size-3 text-muted-foreground/50" />
      <span>{text}</span>
    </div>
  );
}
