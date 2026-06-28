import { NextRequest } from "next/server";
import type { GitHubRepoMetadata } from "@/lib/types/github";

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
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoPilot",
    };

    // Use GitHub token if available for higher rate limits
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers, redirect: "follow", next: { revalidate: 300 } } // Cache for 5 minutes, follow redirects for renamed/transferred repos
    );

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json(
          { error: "Repository not found. Please check the owner and repository name." },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return Response.json(
          { error: "GitHub API rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      return Response.json(
        { error: `GitHub API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const metadata: GitHubRepoMetadata = {
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

    return Response.json(metadata, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("GitHub API fetch error:", error);
    return Response.json(
      { error: "Failed to fetch repository data. Please try again." },
      { status: 500 }
    );
  }
}
