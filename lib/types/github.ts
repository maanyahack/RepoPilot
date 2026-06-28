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
