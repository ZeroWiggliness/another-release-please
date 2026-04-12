import type { Commit } from '../types/provider.js';

/**
 * Repository context used by changelog writers to generate links.
 */
export interface ChangelogRepoContext {
  /** Repository web URL (e.g. https://github.com/owner/repo). Used to generate commit hash links. */
  repoUrl?: string;
  /** Path prefix for commit URLs (e.g. '/commit' or '/-/commit'). */
  commitPath?: string;
  /**
   * Full URL template for issue references, with {id} placeholder.
   * e.g. 'https://jira.example.com/browse/{id}'
   */
  issueUrlTemplate?: string;
  /**
   * True when issueUrlTemplate was explicitly provided by the user (Jira, Linear, etc.).
   * False when auto-derived from the provider (GitHub/GitLab default issue URLs).
   * Controls whether the display ID is bare (PROJ-123) or prefixed (#123).
   */
  issueUrlIsCustom: boolean;
}

/**
 * Abstract base class for changelog generators.
 * Extend this class to implement a custom changelog format.
 */
export abstract class ChangelogWriter {
  /**
   * Generate a changelog section string for the given commits and version.
   *
   * @param commits - Conventional commits to include in this release section.
   * @param version - The release version string (e.g. 'v1.2.3').
   * @param date - The release date used in the footer.
   * @param context - Repository context for generating links.
   * @returns The rendered changelog section as a markdown string.
   */
  abstract generate(
    commits: Commit[],
    version: string,
    date: Date,
    context: ChangelogRepoContext,
  ): Promise<string>;
}
