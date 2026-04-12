/**
 * Shared types for Git providers
 */

/**
 * Represents a repository file with its path and content
 */
export interface RepositoryFile {
  /** File path relative to repository root */
  path: string;
  /** File content as string */
  content: string;
}

/**
 * Parameters for creating a pull/merge request
 */
export interface CreatePRParams {
  /** Source branch name */
  sourceBranch: string;
  /** Target branch name */
  targetBranch: string;
  /** PR/MR title */
  title: string;
  /** PR/MR description/body */
  body: string;
  /** Whether this is a draft PR/MR */
  draft?: boolean;
  /** Labels to add to the PR/MR */
  labels?: string[];
}

/**
 * Parameters for updating a pull/merge request
 */
export interface UpdatePRParams {
  /** Updated title */
  title?: string;
  /** Updated description/body */
  body?: string;
  /** Whether this is a draft PR/MR */
  draft?: boolean;
  /** Labels to add to the PR/MR */
  labels?: string[];
  /** Target branch to update to */
  targetBranch?: string;
}

/**
 * Represents a pull/merge request
 */
export interface PullRequest {
  /** Unique identifier (number or IID) */
  id: number;
  /** PR/MR number (for display) */
  number: number;
  /** Title */
  title: string;
  /** Description/body */
  body: string;
  /** Source branch */
  sourceBranch: string;
  /** Target branch */
  targetBranch: string;
  /** Current state (open, closed, merged) */
  state: 'open' | 'closed' | 'merged';
  /** Whether this is a draft */
  draft: boolean;
  /** Web URL to view the PR/MR */
  webUrl: string;
  /** Labels */
  labels: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Merge sha */
  mergeSha: string;
}

/**
 * Represents a Git repository
 */
export interface Repository {
  /** Repository ID */
  id: string | number;
  /** Repository name */
  name: string;
  /** Full repository path (e.g., 'owner/repo') */
  fullPath: string;
  /** Default branch name */
  defaultBranch: string;
  /** Web URL to view the repository */
  webUrl: string;
}

/**
 * Parameters for creating a Git tag
 */
export interface CreateTagParams {
  /** Tag name (e.g., 'v1.0.0') */
  name: string;
  /** Commit SHA or branch name to tag */
  ref: string;
  /** Tag message */
  message?: string;
}

/**
 * Represents a Git tag
 */
export interface Tag {
  /** Tag name */
  name: string;
  /** Commit SHA */
  commit: string;
  /** Tag message */
  message?: string;
  /** Creation timestamp */
  createdAt?: Date;
}

/**
 * Parameters for creating a release
 */
export interface CreateReleaseParams {
  /** Tag name for the release */
  tagName: string;
  /** Release name/title */
  name: string;
  /** Release description/body */
  description: string;
  /** Commit SHA or branch name to release from */
  ref?: string;
  /** Whether this is a prerelease */
  prerelease?: boolean;
}

/**
 * Represents a release
 */
export interface Release {
  /** Release name */
  name: string;
  /** Tag name */
  tagName: string;
  /** Description */
  description: string;
  /** Whether this is a prerelease */
  prerelease: boolean;
  /** Web URL to view the release */
  webUrl?: string;
  /** Was it created */
  created: boolean;
  /** Commit SHA that the release points to */
  commitSha?: string;
}

/**
 * File to commit
 */
export interface FileCommit {
  /** File path relative to repository root */
  path: string;
  /** File content */
  content: string;
}

/**
 * Parameters for committing files
 */
export interface CommitFilesParams {
  /** Branch to commit to */
  branch: string;
  /** Commit message */
  message: string;
  /** Files to commit */
  files: FileCommit[];
  /** Start branch (for creating new branches) */
  startBranch?: string;
  /** Force update the branch ref (allows fast-forwarding) */
  force?: boolean;
}

/**
 * Commit author information
 */
export interface CommitAuthor {
  /** Author name */
  name: string;
  /** Author email */
  email: string;
}

/**
 * Represents a Git commit
 */
export interface Commit {
  /** Commit SHA */
  sha: string;
  /** Tags associated with this commit */
  tags: Tag[];
  /** Full commit message */
  message: string;
  /** Commit title (first line of message) */
  title: string;
  /** Commit author */
  author: CommitAuthor;
  /** Commit date */
  date: Date;
  /** List of files changed in this commit */
  files: string[];
  /** Branch this commit was fetched from */
  branch?: string;
}
