import { generateText } from "ai";
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { titleModel } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { getRedisClient } from "@/lib/redis";
import type { GitHubRepoMetadata, GitHubTreeItem } from "@/lib/types/github";
import {
  repoAISummarySchema,
  type RepoAISummary,
} from "@/lib/types/repository-summary";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

export const maxDuration = 60;

function getGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "RepoPilot",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchRepoMetadata(
  owner: string,
  repo: string
): Promise<GitHubRepoMetadata> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: getGitHubHeaders(),
      redirect: "follow",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    name: data.name,
    owner: data.owner?.login ?? owner,
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    language: data.language ?? null,
    topics: data.topics ?? [],
    license: data.license?.spdx_id ?? data.license?.name ?? null,
    defaultBranch: data.default_branch ?? "main",
    lastUpdated: data.updated_at ?? new Date().toISOString(),
    openIssues: data.open_issues_count ?? 0,
    watchers: data.subscribers_count ?? data.watchers_count ?? 0,
    isArchived: data.archived ?? false,
    isFork: data.fork ?? false,
    htmlUrl: data.html_url ?? `https://github.com/${owner}/${repo}`,
    avatarUrl: data.owner?.avatar_url ?? "",
  };
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeItem[]> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      headers: getGitHubHeaders(),
      redirect: "follow",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();

  return (data.tree ?? []).map((item: Record<string, unknown>) => ({
    path: item.path as string,
    mode: item.mode as string,
    type: item.type as "blob" | "tree",
    sha: item.sha as string,
    size: item.size as number | undefined,
    url: item.url as string,
  }));
}

async function fetchRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  const cleanPath = path.replace(/^\//, "");
  const encodedPath = cleanPath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: getGitHubHeaders(),
      redirect: "follow",
      cache: "no-store",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data) || data.type !== "file") {
    return null;
  }

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content.replace(/\s/g, ""), "base64").toString(
      "utf-8"
    );
  }

  return typeof data.content === "string" ? data.content : null;
}

function selectFilePath(tree: GitHubTreeItem[], fileNames: string[]) {
  const normalizedNames = new Set(fileNames.map((name) => name.toLowerCase()));

  return (
    tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter((path) =>
        normalizedNames.has((path.split("/").pop() ?? "").toLowerCase())
      )
      .sort((left, right) => left.length - right.length || left.localeCompare(right))[0] ??
    null
  );
}

function buildTreeSnapshot(tree: GitHubTreeItem[]) {
  const topLevelDirectories = new Set<string>();
  const topLevelFiles = new Set<string>();
  const representativePaths: string[] = [];

  for (const item of tree) {
    const parts = item.path.split("/");
    if (parts.length === 1) {
      topLevelFiles.add(parts[0]);
    } else {
      topLevelDirectories.add(parts[0]);
    }

    if (representativePaths.length < 60 && (parts.length <= 2 || item.type === "tree")) {
      representativePaths.push(item.path);
    }
  }

  return [
    `Top-level directories: ${[...topLevelDirectories].sort().join(", ") || "none found"}`,
    `Top-level files: ${[...topLevelFiles].sort().join(", ") || "none found"}`,
    representativePaths.length > 0
      ? `Representative paths: ${representativePaths.slice(0, 40).join(", ")}`
      : "Representative paths: none found",
  ].join("\n");
}

function summarizePackageJson(content: string | null) {
  if (!content) {
    return "package.json: unavailable";
  }

  try {
    const parsed = JSON.parse(content) as {
      name?: string;
      description?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      packageManager?: string;
    };

    const scripts = Object.entries(parsed.scripts ?? {})
      .slice(0, 10)
      .map(([name, command]) => `${name}: ${command}`)
      .join("\n");

    const deps = Object.keys(parsed.dependencies ?? {})
      .slice(0, 12)
      .join(", ");
    const devDeps = Object.keys(parsed.devDependencies ?? {})
      .slice(0, 12)
      .join(", ");

    return [
      `name: ${parsed.name ?? "unknown"}`,
      parsed.description ? `description: ${parsed.description}` : null,
      parsed.packageManager ? `packageManager: ${parsed.packageManager}` : null,
      scripts ? `scripts:\n${scripts}` : null,
      deps ? `dependencies: ${deps}` : null,
      devDeps ? `devDependencies: ${devDeps}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return content.slice(0, 6000);
  }
}

function buildSummarySignature(inputs: {
  metadata: GitHubRepoMetadata;
  readme: string | null;
  packageJson: string | null;
  tree: GitHubTreeItem[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        metadata: {
          description: inputs.metadata.description,
          defaultBranch: inputs.metadata.defaultBranch,
          lastUpdated: inputs.metadata.lastUpdated,
          topics: inputs.metadata.topics,
        },
        readme: inputs.readme,
        packageJson: inputs.packageJson,
        tree: inputs.tree.map((item) => ({ path: item.path, sha: item.sha })),
      })
    )
    .digest("hex");
}

function buildSummaryPrompt(inputs: {
  metadata: GitHubRepoMetadata;
  readme: string | null;
  packageJson: string | null;
  tree: GitHubTreeItem[];
}) {
  const readmeExcerpt = inputs.readme
    ? inputs.readme.slice(0, 12000)
    : "README: unavailable";
  const packageJsonSummary = summarizePackageJson(inputs.packageJson);
  const treeSnapshot = buildTreeSnapshot(inputs.tree);

  return [
    "You are generating a concise repository summary for RepoPilot.",
    "Use only the supplied repository metadata and file excerpts.",
    "Return practical, user-facing language. Do not mention internal implementation details.",
    "Return ONLY valid JSON with these exact keys: projectPurpose, techStack, mainFeatures, folderStructureOverview, howToRun, complexityLevel, idealUseCases.",
    "All array values must be arrays of strings. complexityLevel must be exactly one of Beginner, Intermediate, or Advanced.",
    "",
    `Repository metadata:\n${JSON.stringify(inputs.metadata, null, 2)}`,
    "",
    `README excerpt:\n${readmeExcerpt}`,
    "",
    `package.json summary:\n${packageJsonSummary}`,
    "",
    `Repository tree snapshot:\n${treeSnapshot}`,
    "",
    "Required output:",
    "- projectPurpose: 2-4 sentences about what the project does.",
    "- techStack: 3-8 concise technology names.",
    "- mainFeatures: 3-8 short feature statements.",
    "- folderStructureOverview: 3-7 short bullets about the most important folders/files.",
    "- howToRun: 3-7 practical setup/run steps. Prefer commands from package.json when available.",
    "- complexityLevel: exactly one of Beginner, Intermediate, or Advanced.",
    "- idealUseCases: 2-5 short use cases.",
  ].join("\n");
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? [item] : []))
      .join(" ")
      .trim();
  }

  if (value && typeof value === "object" && "text" in value) {
    return asString((value as { text?: unknown }).text);
  }

  return String(value ?? "").trim();
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") {
          return [item.trim()];
        }

        if (item && typeof item === "object") {
          const record = item as {
            text?: unknown;
            content?: unknown;
            value?: unknown;
          };
          return [asString(record.text ?? record.content ?? record.value)];
        }

        return [asString(item)];
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|\u2022|-\s+/)
      .map((item) => item.replace(/^[-*\s]+/, "").trim())
      .filter(Boolean);
  }

  return [asString(value)].filter(Boolean);
}

function parseSummaryText(content: string) {
  const trimmed = content.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  const jsonText = match?.[0] ?? trimmed;
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  const normalized = {
    projectPurpose: asString(parsed.projectPurpose),
    techStack: asStringArray(parsed.techStack),
    mainFeatures: asStringArray(parsed.mainFeatures),
    folderStructureOverview: asStringArray(parsed.folderStructureOverview),
    howToRun: asStringArray(parsed.howToRun),
    complexityLevel: asString(parsed.complexityLevel) as
      | "Beginner"
      | "Intermediate"
      | "Advanced",
    idealUseCases: asStringArray(parsed.idealUseCases),
  };

  return repoAISummarySchema.parse(normalized);
}

async function getCachedSummary(cacheKey: string) {
  const redis = getRedisClient();
  if (!redis?.isReady) {
    return null;
  }

  const cached = await redis.get(cacheKey);
  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as RepoAISummary;
  } catch {
    return null;
  }
}

async function setCachedSummary(cacheKey: string, summary: RepoAISummary) {
  const redis = getRedisClient();
  if (!redis?.isReady) {
    return;
  }

  await redis.set(cacheKey, JSON.stringify(summary), {
    EX: CACHE_TTL_SECONDS,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return Response.json(
      { error: "Missing required parameters: owner and repo" },
      { status: 400 }
    );
  }

  try {
    const metadata = await fetchRepoMetadata(owner, repo);
    const tree = await fetchRepoTree(owner, repo, metadata.defaultBranch);
    const readmePath = selectFilePath(tree, [
      "README.md",
      "README.mdx",
      "README",
      "README.txt",
    ]);
    const packageJsonPath = selectFilePath(tree, ["package.json"]);

    const [readme, packageJson] = await Promise.all([
      readmePath
        ? fetchRepoFileContent(owner, repo, readmePath, metadata.defaultBranch)
        : Promise.resolve(null),
      packageJsonPath
        ? fetchRepoFileContent(
            owner,
            repo,
            packageJsonPath,
            metadata.defaultBranch
          )
        : Promise.resolve(null),
    ]);

    const signature = buildSummarySignature({
      metadata,
      readme,
      packageJson,
      tree,
    });
    const cacheKey = `repo-summary:v1:${owner}/${repo}:${signature}`;
    const cachedSummary = await getCachedSummary(cacheKey);

    if (cachedSummary) {
      return Response.json(
        { summary: cachedSummary, cached: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const prompt = buildSummaryPrompt({ metadata, readme, packageJson, tree });
    const { text } = await generateText({
      model: getLanguageModel(titleModel.id),
      prompt,
      temperature: 0.2,
    });

    const summary = parseSummaryText(text);

    await setCachedSummary(cacheKey, summary);

    return Response.json(
      { summary, cached: false },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("GitHub repository summary error:", error);

    return Response.json(
      {
        error: "Failed to generate repository summary. Please try again.",
      },
      { status: 500 }
    );
  }
}
