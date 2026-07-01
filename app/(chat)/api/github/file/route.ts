import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const branch = searchParams.get("branch") ?? "main";

  if (!owner || !repo || !path) {
    return Response.json(
      { error: "Missing required parameters: owner, repo, and path" },
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

    // Safely encode each segment of the path, but preserve the slashes
    const cleanPath = path.replace(/^\//, "");
    const encodedPath = cleanPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(url, {
      headers,
      redirect: "follow",
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json(
          { error: "File not found. Please verify the file path." },
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

    // If the path points to a directory, GitHub returns an array of items rather than a single file object
    if (Array.isArray(data) || data.type !== "file") {
      return Response.json(
        { error: "Requested path is a directory, not a file." },
        { status: 400 }
      );
    }

    let decodedContent = "";
    if (data.encoding === "base64" && data.content) {
      // Remove all whitespaces/newlines from the base64 content string before decoding
      const cleanedBase64 = data.content.replace(/\s/g, "");
      decodedContent = Buffer.from(cleanedBase64, "base64").toString("utf-8");
    } else if (data.content) {
      decodedContent = data.content;
    }

    return Response.json(
      {
        content: decodedContent,
        size: data.size,
        sha: data.sha,
        name: data.name,
        path: data.path,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (error) {
    console.error("GitHub file fetch error:", error);
    return Response.json(
      { error: "Failed to fetch file content. Please try again." },
      { status: 500 }
    );
  }
}
