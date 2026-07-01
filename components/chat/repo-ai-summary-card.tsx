"use client";

import {
  AlertCircleIcon,
  BrainCircuitIcon,
  LoaderIcon,
  RefreshCwIcon,
  RocketIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RepoAISummary } from "@/lib/types/repository-summary";
import { cn } from "@/lib/utils";

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; summary: RepoAISummary };

function getSectionIcon(label: string) {
  switch (label) {
    case "Project Purpose":
      return TargetIcon;
    case "Tech Stack":
      return BrainCircuitIcon;
    case "Main Features":
      return SparklesIcon;
    case "How to Run":
      return RocketIcon;
    default:
      return SparklesIcon;
  }
}

export function RepoAISummaryCard({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [state, setState] = useState<SummaryState>({ status: "idle" });

  const fetchSummary = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/github/summary?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Failed to generate summary (${response.status})`
        );
      }

      const data = (await response.json()) as { summary: RepoAISummary };
      setState({ status: "success", summary: data.summary });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  }, [owner, repo]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="fade-up mx-auto w-full max-w-4xl px-2 md:px-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm transition-all duration-300",
          "border-border/50 shadow-[var(--shadow-card)]"
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="flex flex-col gap-3 p-3 md:p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <SparklesIcon className="size-3.5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              AI Summary
            </span>
          </div>

          {state.status === "idle" || state.status === "loading" ? (
            <LoadingState />
          ) : state.status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 dark:bg-destructive/10">
                <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="text-xs leading-relaxed text-destructive">
                  {state.message}
                </span>
              </div>
              <Button
                className="h-8 gap-1.5 rounded-lg text-xs"
                onClick={() => void fetchSummary()}
                size="sm"
                variant="outline"
              >
                <RefreshCwIcon className="size-3" />
                Retry Summary
              </Button>
            </div>
          ) : (
            <SummaryContent summary={state.summary} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryContent({ summary }: { summary: RepoAISummary }) {
  return (
    <div className="flex flex-col gap-4">
      <Section label="Project Purpose" content={summary.projectPurpose} />

      <Section
        chips={summary.techStack}
        content={summary.techStack.join(" • ")}
        label="Tech Stack"
      />

      <Section items={summary.mainFeatures} label="Main Features" />

      <Section
        items={summary.folderStructureOverview}
        label="Folder Structure Overview"
      />

      <Section items={summary.howToRun} label="How to Run" ordered />

      <div className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Complexity Level
        </span>
        <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
          {summary.complexityLevel}
        </span>
      </div>

      <Section items={summary.idealUseCases} label="Ideal Use Cases" />
    </div>
  );
}

function Section({
  label,
  content,
  items,
  ordered,
  chips,
}: {
  label: string;
  content?: string;
  items?: string[];
  ordered?: boolean;
  chips?: string[];
}) {
  const Icon = getSectionIcon(label);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-primary/70" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </h3>
      </div>

      {content ? (
        <p className="text-sm leading-relaxed text-foreground/90">{content}</p>
      ) : chips ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground/80"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : items ? (
        ordered ? (
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderIcon className="size-3.5 animate-spin" />
        <span>Generating an AI summary…</span>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="flex flex-col gap-2" key={`summary-skeleton-${index}`}>
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton
              className={cn(
                "h-4 rounded-lg",
                index === 0 ? "w-full" : index === 1 ? "w-4/5" : "w-11/12"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
