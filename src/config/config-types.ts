/**
 * Configuration types for another-release-please
 */

import type { GitProvider } from '../providers/git-provider.js';
import type { Versioner } from '../interfaces/versioner.interface.js';
import type { Manifest, ManifestItemSchema } from '../types/manifest.js';

/**
 * Release configuration options
 */
export interface ReleaseConfig {
  /** Whether to create prereleases */
  prerelease: boolean;
  /** Target branch for the release PR */
  targetBranch?: string;
  /** Destination branch for the pull request (defaults to targetBranch). CLI-only option. */
  prBranch?: string;
  /** Whether to create draft PRs */
  draft?: boolean;
  /** Branch name pattern for release PRs */
  releaseBranchPrefix?: string;
  /** Maximum number of releases to fetch */
  maxReleases?: number;
  /** Maximum number of commits to fetch */
  maxCommits?: number;
  /** Include chore commits when determining release eligibility (default: false) */
  includeChores?: boolean;
  /** Skip creating the provider tag. Does not affect whether a release is created. */
  skipTag?: boolean;
  /** Skip creating the provider release. When true, `created` will be false. */
  skipRelease?: boolean;
  /** Skip creating or updating the release pull request. When true, `created` and `updated` will be false. */
  skipPrCreation?: boolean;
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  /** Initialized provider instance */
  provider: GitProvider;
  /** Versioner instance for version management */
  versioner: Versioner;
  /** Release configuration */
  release: ReleaseConfig;
  /** Currently released version */
  version?: string;
  /** Prefix used for version tags (e.g. "v" → "v1.2.3"). Defaults to "v" */
  versionPrefix: string;
  /** Template for issue/ticket reference URLs. Use {id} as the placeholder.
   * e.g. "https://jira.example.com/browse/{id}"
   * Defaults to the selected provider's issue URL pattern. */
  issueUrlTemplate?: string;
  /** Versioning strategies for packages */
  manifests: Manifest[];
  /** Dry run mode */
  dryRun: boolean;
  /** Debug mode - enables detailed logging */
  debug?: boolean;
  /** Use local filesystem to scan and read files instead of provider git APIs. Defaults to true. */
  useFileSystem?: boolean;
  /** When true, generate file operations for every manifest regardless of whether it has relevant commits. Defaults to false. */
  updateAllVersions?: boolean;
}

/**
 * Unified configuration file structure (.arp.config.json).
 * Replaces both the old .arprc.json and .arp.manifest.json files.
 */
export interface ArpConfigFile {
  /** Provider type */
  provider?: 'gitlab' | 'github';
  /** GitLab configuration */
  gitlab?: {
    token?: string;
    repository?: string;
  };
  /** GitHub configuration */
  github?: {
    token?: string;
    repository?: string;
  };
  /** Release configuration */
  release?: ReleaseConfig;
  /** Global default version applied to all manifests that omit their own version */
  version?: string;
  /** Global default manifest type applied to all manifests that omit their own type */
  type?: string;
  /** Enable dry-run mode — no changes will be made */
  dryRun?: boolean;
  /** Prefix used for version tags (e.g. "v" → "v1.2.3"). Defaults to "v" */
  versionPrefix?: string;
  /** Template for issue/ticket reference URLs. Use {id} as the placeholder.
   * e.g. "https://jira.example.com/browse/{id}" */
  issueUrlTemplate?: string;
  /** Use local filesystem for file scanning and reading. When false, uses provider APIs. */
  useFileSystem?: boolean;
  /** When true, generate file operations for every manifest regardless of whether it has relevant commits. */
  updateAllVersions?: boolean;
  /** List of package manifest entries */
  manifests?: ManifestItemSchema[];
}
