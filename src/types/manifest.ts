/**
 * Manifest Types
 * Defines how packages are versioned and which files are updated
 */

// ---------------------------------------------------------------------------
// ManifestFile — only present on manifests whose resolved type is 'custom'
// ---------------------------------------------------------------------------

/** File format used when locating and replacing the version string */
export type ManifestFileType = 'xml' | 'json' | 'text' | 'yaml';

/**
 * Describes a single file (or glob of files) whose version should be updated.
 * Only used when the manifest type is 'custom'.
 */
export interface ManifestFile {
  /** Glob pattern relative to the repository root, e.g. pom.xml, **\/pom.xml, **\/*.csproj */
  path: string;
  /** Format of the file — used to select the right version-replacement strategy */
  filetype: ManifestFileType;
  /** Regex patterns used to find and replace the version string inside the matched file */
  versionPatterns: string[];
}

// ---------------------------------------------------------------------------
// Manifest — the hydrated runtime representation
// ---------------------------------------------------------------------------

/**
 * Hydrated manifest entry as used throughout the application.
 * Created by the config loader from the raw .arp.manifest.json file.
 */
export interface Manifest {
  /** Path to the package relative to the repository root (default: ".") */
  path: string;
  /** Current version of the package */
  currentVersion: string;
  /**
   * The type of package manifest processor to use.
   * Built-in types (e.g. 'simple') auto-discover files.
   * Use 'custom' to provide an explicit list of files via the `files` field.
   */
  type: string;
  /** Prefix used for version tags for this manifest (e.g. "v" → "v1.2.3"). Omitted means fall back to the global versionPrefix. */
  versionPrefix?: string;
  /** Prerelease identifier label for this manifest (e.g. "alpha", "SNAPSHOT"). Defaults to the language-specific default. */
  identifier?: string;
  /** Initial number for the prerelease counter (e.g. "0" or "1"). Defaults to the language-specific default. */
  identifierBase?: string;
  /**
   * Explicit file list — only present when type is 'custom'.
   * Processors for other types discover files on their own.
   */
  files?: ManifestFile[];
}

// ---------------------------------------------------------------------------
// ManifestItemSchema — the shape of a single entry in .arp.config.json
// ---------------------------------------------------------------------------

/** A single manifest item as written in .arp.config.json */
export interface ManifestItemSchema {
  /** Path to the package relative to the repository root (default: ".") */
  path: string;
  /** Version of the package */
  version: string;
  /** Manifest processor type (default: 'simple') */
  type: string;
  /** Prefix used for version tags for this manifest (e.g. "v" → "v1.2.3"). Defaults to the global versionPrefix. */
  versionPrefix?: string;
  /** Prerelease identifier label for this manifest (e.g. "alpha", "SNAPSHOT"). Defaults to the language-specific default. */
  identifier?: string;
  /** Initial number for the prerelease counter (e.g. "0" or "1"). Defaults to the language-specific default. */
  identifierBase?: string;
  /** Explicit file list — only valid when type is 'custom' */
  files?: ManifestFile[];
}
