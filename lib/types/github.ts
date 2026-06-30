/**
 * GitHub repository metadata returned by the /api/github/repo endpoint.
 */
export interface GitHubRepoMetadata {
  name: string;
  owner: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  license: string | null;
  defaultBranch: string;
  lastUpdated: string;
  openIssues: number;
  watchers: number;
  isArchived: boolean;
  isFork: boolean;
  htmlUrl: string;
  avatarUrl: string;
}

/**
 * A single item from the GitHub Git Trees API (flat list).
 * @see https://docs.github.com/en/rest/git/trees#get-a-tree
 */
export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

/**
 * Nested tree node used by the Repository Explorer UI.
 * Built by transforming the flat GitHubTreeItem[] into a hierarchy.
 */
export interface GitHubTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  sha: string;
  size?: number;
  children?: GitHubTreeNode[];
}
