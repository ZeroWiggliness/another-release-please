/**
 * Versioner interface for version management strategies
 */

/**
 * Version bump levels
 */
export type VersionBumpLevel = 'major' | 'minor' | 'patch' | 'prerelease';

/**
 * Interface for version management strategies
 */
export interface Versioner {
  /** The prefix used to identify version tags (e.g. "v" matches "v1.2.3") */
  readonly versionPrefix: string;

  /**
   * Check if a string matches the version format
   * @param version - Version string to validate
   * @returns True if the version matches the format
   */
  match(version: string): boolean;

  /**
   * Increment a version string
   * @param version - Current version string
   * @param level - Version bump level (major, minor, or patch)
   * @returns Incremented version string
   */
  increment(version: string, level: VersionBumpLevel): string;

  /**
   * Parse a version string into a Version instance
   * @param version - Version string to parse
   * @returns A Version instance
   */
  version(version: string): import('../versioners/version.js').Version;

  /**
   * Calculate the next version from commits and current version
   * @param commits - Array of commits (newest first)
   * @param currentVersion - Current version string
   * @param isPrerelease - Whether to produce a prerelease
   * @param includeChores - Whether chore commits trigger a patch bump
   * @param versionPrefix - Optional per-call prefix override; defaults to the versioner's own prefix
   * @returns A Version instance representing the next version
   */
  calculateNextVersion(commits: import('../types/provider.js').Commit[], currentVersion: string, isPrerelease: boolean, includeChores?: boolean, versionPrefix?: string, identifier?: string, identifierBase?: string): import('../versioners/version.js').Version;
}
