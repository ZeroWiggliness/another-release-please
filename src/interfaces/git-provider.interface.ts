/**
 * Git provider interface for abstracting different Git hosting platforms
 */

import { FileOperation } from '../processors/index.js';
import type {
  CreatePRParams,
  UpdatePRParams,
  PullRequest,
  Repository,
  CreateTagParams,
  Tag,
  CreateReleaseParams,
  Release,
  CommitFilesParams,
  Commit,
} from '../types/provider.js';

/**
 * Interface for Git hosting providers (GitLab, GitHub, etc.)
 */
export interface GitProvider {
  /** Provider name (e.g., 'gitlab', 'github') */
  readonly name: string;

  /**
   * Get repository information
   * @returns Repository details
   */
  getRepository(): Promise<Repository>;

  /**
   * Get the default branch name for the repository
   * @returns Default branch name (e.g., 'main', 'master')
   */
  getDefaultBranch(): Promise<string>;

  /**
   * Create a new pull/merge request
   * @param params - PR/MR creation parameters
   * @returns Created pull request
   */
  createPullRequest(params: CreatePRParams): Promise<PullRequest>;

  /**
   * Update an existing pull/merge request
   * @param id - PR/MR identifier
   * @param params - Update parameters
   * @returns Updated pull request
   */
  updatePullRequest(id: number, params: UpdatePRParams): Promise<PullRequest>;

  /**
   * Atomically update labels on a pull/merge request.
   * @param id PR/MR identifier
   * @param toAdd Labels to add (array of strings)
   * @param toRemove Labels to remove (array of strings)
   * @param dryRun If true, do not actually update labels
   */
  updatePullRequestLabels?(id: number | string, toAdd: string[], toRemove: string[], dryRun?: boolean): Promise<void>;

  /**
   * Get a pull/merge request by ID
   * @param id - PR/MR identifier
   * @returns Pull request or null if not found
   */
  getPullRequest(id: number): Promise<PullRequest | null>;

  /**
   * Find pull/merge requests by source and target branch, label and state.
   * @param sourceBranch - Source branch name
   * @param targetBranch - Target branch name
   * @param label - Label to filter merge requests by (e.g., 'autorelease: pending')
   * @param state - Required PR/MR state to filter by ('open' | 'closed' | 'merged')
   * @returns Array of matching pull requests (empty array if none found)
   */
  findPullRequestByBranch(sourceBranch: string, targetBranch: string, label: string, state: 'open' | 'closed' | 'merged'): Promise<PullRequest[]>;

  /**
   * Merge a pull/merge request
   * @param id - PR/MR identifier
   */
  mergePullRequest(id: number): Promise<void>;

  /**
   * Create a release
   * @param params - Release creation parameters
   * @returns Created release
   */
  createRelease(params: CreateReleaseParams): Promise<Release>;

  /**
   * Get the latest release
   * @returns Latest release or null if none exist
   */
  getLatestRelease(): Promise<Release | null>;

  /**
   * Get releases up to a maximum count
   * @param maxCount - Maximum number of releases to fetch (default: 100)
   * @returns Array of releases
   */
  getReleases(maxCount?: number): Promise<Release[]>;

  /**
   * Create Git tags
   * @param params - Array of tag creation parameters
   * @returns Array of created tags
   */
  createTags(params: CreateTagParams[]): Promise<Tag[]>;

  /**
   * Get all tags up to a maximum count
   * @param maxCount - Maximum number of tags to fetch (default: 100)
   * @returns Array of tags with their associated commit SHAs
   */
  getTags(maxCount?: number): Promise<Tag[]>;

  /**
   * Get a single tag by exact name
   * @param name - Exact tag name to look up
   * @returns Tag if found, null if not found
   */
  getTag(name: string): Promise<Tag | null>;

  /**
   * Get commits up to a maximum count
   * @param maxCount - Maximum number of commits to fetch (default: 100)
   * @param tags - Optional array of tags to map to commits. If null, no tag mapping will occur. If undefined, tags will be fetched internally.
   * @param untilSha - Optional commit SHA to fetch commits until (exclusive). Fetches from HEAD back to this SHA.
   * @param branch - Optional branch name to restrict commits to. Defaults to the repository default branch.
   * @returns Array of commits
   */
  getCommits(maxCount?: number, tags?: Tag[] | null, untilSha?: string, branch?: string): Promise<Commit[]>;

  /**
   * Commit files to a branch
   * @param params - Commit parameters
   */
  commitFiles(params: CommitFilesParams): Promise<void>;

  /**
   * Get file contents from the repository
   * @param path - File path relative to repository root
   * @param ref - Branch, tag, or commit SHA to read from
   * @returns File contents as string, or null if file doesn't exist
   */
  getFileContents(path: string, ref?: string): Promise<string | null>;

  /**
   * Create or update a release Pull/Merge Request with provided files (or paths)
   * @param title - PR title
   * @param body - PR body/description
   * @param targetBranch - Target branch for the PR
   * @param files - Array of files to include as either `{ path, content }` or string file paths
   */
  createReleasePR(
    title: string,
    body: string,
    sourceBranch: string,
    targetBranch: string,
    prDestBranch: string,
    files: Array<FileOperation>,
    tags: string[],
    nextVersion: string
  ): Promise<number>;

  /**
   * Update an existing release Pull/Merge Request
   * @param title - PR title
   * @param body - PR body/description
   * @param prId - Pull/MR identifier as string
   * @param sourceBranch - Source branch name
   * @param targetBranch - Target branch name
   * @param files - Array of files to include as either `{ path, content }` or string file paths
   */
  updateReleasePR(
    title: string,
    body: string,
    prId: string,
    sourceBranch: string,
    targetBranch: string,
    prDestBranch: string,
    files: Array<FileOperation>,
    tags: string[],
    nextVersion: string
  ): Promise<void>;

  /**
   * List all file paths in the repository for a given branch
   * @param branchName - Branch name to list files from
   * @returns Array of file paths
   */
  listAllFiles(branchName: string): Promise<string[]>;
}
