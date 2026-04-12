/**
 * Processor types and interfaces
 */

import type { Commit } from '../types/provider.js';
import type { Manifest, ManifestFile } from '../types/manifest.js';
import type { GitProvider } from '../providers/git-provider.js';

/**
 * Status of a file operation
 */
export type FileOperationStatus = 'created' | 'updated';

/**
 * Represents a file operation (creation or update)
 */
export interface FileOperation {
  /** File path relative to repository root */
  path: string;
  /** Whether the file was created or updated */
  status: FileOperationStatus;
  /** File content */
  content: string;
}

/**
 * Result of processing a manifest
 */
export interface ManifestProcessResult {
  /** The global next version computed from all commits */
  nextVersion: string;
  /** Per-manifest resolved versions (including prefix), in config order */
  nextManifestVersions: string[];
  /** List of file operations for this manifest */
  files: FileOperation[];
  /** The newly generated changelog section (for use as PR body) */
  changelog: string;
}

/**
 * The result of processing a single manifest.
 * Carries the manifest identity fields (minus type) and the resulting file operations.
 */
export class ProcessedManifest {
  constructor(
    public readonly path: string,
    public readonly currentVersion: string,
    public readonly fileOperations: ManifestFile[],
    public readonly versionPrefix?: string,
    public readonly identifier?: string,
    public readonly identifierBase?: string,
  ) { }
}

/**
 * Abstract base class for package manifest processors
 */
export abstract class PackageManifest {
  /**
   * Create a new package manifest processor
   * @param manifest - The manifest configuration
   * @param provider - Git provider instance available to processors
   */
  constructor(
    protected readonly manifest: Manifest,
    protected readonly provider: GitProvider
  ) { }

  /**
   * Process commits and return a ProcessedManifest
   * @param commits - List of commits to process
   * @returns ProcessedManifest containing path, currentVersion and file operations
   */
  abstract process(commits: Commit[]): ProcessedManifest;
}
