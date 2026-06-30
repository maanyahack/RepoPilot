import { NextRequest } from "next/server";
import type { GitHubTreeItem } from "@/lib/types/github";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch") ?? "main";

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

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, redirect: "follow", next: { revalidate: 300 } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json(
          { error: "Repository tree not found. The branch may not exist." },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return Response.json(
          { error: "GitHub API rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      if (response.status === 409) {
        return Response.json(
          { error: "Repository is empty or has no commits." },
          { status: 409 }
        );
      }
      return Response.json(
        { error: `GitHub API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const tree: GitHubTreeItem[] = (data.tree ?? []).map(
      (item: Record<string, unknown>) => ({
        path: item.path as string,
        mode: item.mode as string,
        type: item.type as "blob" | "tree",
        sha: item.sha as string,
        size: item.size as number | undefined,
        url: item.url as string,
      })
    );

    return Response.json(
      { tree, truncated: data.truncated ?? false },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (error) {
    console.error("GitHub tree fetch error:", error);
    return Response.json(
      { error: "Failed to fetch repository tree. Please try again." },
      { status: 500 }
    );
  }
}
