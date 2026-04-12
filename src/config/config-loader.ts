/**
 * Configuration loader for another-release-please
 */

import type { AppConfig, ArpConfigFile, ReleaseConfig } from './config-types.js';
import type { GitProvider } from '../providers/git-provider.js';
import type { Versioner } from '../interfaces/versioner.interface.js';
import type { Manifest } from '../types/manifest.js';
import { SemverVersioner } from '../versioners/semver-versioner.js';

/**
 * CLI arguments passed to commands
 */
export interface CliArgs {
  provider?: string;
  token?: string;
  repository?: string;
  targetBranch?: string;
  /** Destination branch for the pull request (defaults to targetBranch). */
  prBranch?: string;
  prerelease: boolean;
  dryRun: boolean;
  debug?: boolean;
  versioner?: string;
  /** Prefix used for version tags (e.g. "v" → "v1.2.3"). Defaults to "v" */
  versionPrefix?: string;
  /** Template for issue/ticket reference URLs. Use {id} as the placeholder.
   * e.g. "https://jira.example.com/browse/{id}" */
  issueUrlTemplate?: string;
  /** Override the manifest type for every package (highest priority) */
  type?: string;
  /** Use local filesystem instead of provider APIs for file access. */
  useFileSystem?: boolean;
  /** When true, generate file operations for every manifest regardless of whether it has relevant commits. */
  updateAllVersions?: boolean;
  /** Skip creating the provider tag. */
  skipTag?: boolean;
  /** Skip creating the provider release. */
  skipRelease?: boolean;
  /** Skip creating or updating the release pull request. */
  skipPrCreation?: boolean;
  [key: string]: any;
}

/**
 * Load configuration from multiple sources with priority:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Config file (.arp.config.json)
 * 4. Defaults (lowest priority)
 */
export async function loadConfig(cliArgs: CliArgs = { prerelease: false, dryRun: false }, provider: GitProvider): Promise<AppConfig> {
  // Get default branch for reading config files
  const defaultBranch = await provider.getDefaultBranch();

  // Resolve target branch early so we can try it first when loading the config file.
  // Priority: CLI arg > config file (not yet loaded, so CLI only at this point)
  const targetBranch = cliArgs.targetBranch || defaultBranch;

  // Load unified config file — try target branch first, fall back to default branch
  const fileConfig = await loadConfigFile(provider, targetBranch, defaultBranch);

  // Create versioner instance
  const versionerType = cliArgs.versioner || 'semver';
  const versionPrefix = cliArgs.versionPrefix ?? fileConfig.versionPrefix ?? 'v';
  const versioner = await createVersioner(versionerType, versionPrefix);

  // Load release config
  const releaseConfig = loadReleaseConfig(cliArgs, fileConfig);

  // If no targetBranch was provided via CLI or config file, default to the repository's default branch
  if (!releaseConfig.targetBranch) {
    releaseConfig.targetBranch = defaultBranch;
  }

  // Resolve prBranch strategy value or default to targetBranch
  releaseConfig.prBranch = resolvePrBranch(releaseConfig.prBranch, releaseConfig.targetBranch!);

  // Hydrate manifests from the unified config — pass CLI type override so it takes highest priority
  const manifests = hydrateManifests(fileConfig, cliArgs.type);

  // Resolve and validate the global version from the config file
  let version: string | undefined;
  if (fileConfig.version) {
    if (!versioner.match(fileConfig.version)) {
      throw new Error(`Invalid version in config: "${fileConfig.version}" is not a valid version string.`);
    }
    version = fileConfig.version;
  }

  return {
    provider,
    versioner,
    release: releaseConfig,
    version,
    versionPrefix,
    issueUrlTemplate: cliArgs.issueUrlTemplate ?? fileConfig.issueUrlTemplate,
    manifests,
    dryRun: cliArgs.dryRun || fileConfig.dryRun || process.env.ARP_DRY_RUN === 'true' || false,
    debug: cliArgs.debug || process.env.ARP_DEBUG === 'true' || false,
    useFileSystem: cliArgs.useFileSystem
      ?? (process.env.ARP_USE_FILE_SYSTEM !== undefined ? process.env.ARP_USE_FILE_SYSTEM === 'true' : undefined)
      ?? fileConfig.useFileSystem
      ?? true,
    updateAllVersions: cliArgs.updateAllVersions === true || fileConfig.updateAllVersions === true,
  };
}

/**
 * Resolve a prBranch value, expanding any known strategy keywords.
 * - undefined/empty       → targetBranch
 * - any other string      → returned as-is
 */
function resolvePrBranch(prBranch: string | undefined, targetBranch: string): string {
  if (!prBranch) return targetBranch;
  return prBranch;
}

/**
 * Create versioner instance based on type
 */
async function createVersioner(versionerType: string, versionPrefix = 'v'): Promise<Versioner> {
  if (versionerType === 'semver') {
    return new SemverVersioner(versionPrefix);
  } else {
    throw new Error(`Unsupported versioner: ${versionerType}. Currently only 'semver' is supported.`);
  }
}

/**
 * Load configuration from .arp.config.json.
 * Tries targetBranch first; falls back to defaultBranch if not found there.
 */
async function loadConfigFile(provider: GitProvider, targetBranch: string, defaultBranch: string): Promise<ArpConfigFile> {
  const refs = targetBranch !== defaultBranch
    ? [targetBranch, defaultBranch]
    : [defaultBranch];

  for (const ref of refs) {
    try {
      const content = await provider.getFileContents('.arp.config.json', ref);
      if (content) {
        return JSON.parse(content) as ArpConfigFile;
      }
    } catch {
      // File doesn't exist on this ref — try next
    }
  }

  return {};
}

/**
 * Load release configuration
 */
function loadReleaseConfig(cliArgs: CliArgs, fileConfig: ArpConfigFile): ReleaseConfig {
  return {
    prerelease: cliArgs.prerelease ?? fileConfig.release?.prerelease ?? false,
    targetBranch: cliArgs.targetBranch || fileConfig.release?.targetBranch,
    prBranch: cliArgs.prBranch || fileConfig.release?.prBranch,
    draft: cliArgs.draft ?? fileConfig.release?.draft ?? false,
    releaseBranchPrefix: fileConfig.release?.releaseBranchPrefix || 'feature/',
    maxReleases: cliArgs.maxReleases ?? fileConfig.release?.maxReleases ?? 10,
    maxCommits: cliArgs.maxCommits ?? fileConfig.release?.maxCommits ?? 100,
    includeChores: cliArgs.includeChores ?? fileConfig.release?.includeChores ?? false,
    skipTag: cliArgs.skipTag ?? fileConfig.release?.skipTag ?? false,
    skipRelease: cliArgs.skipRelease ?? fileConfig.release?.skipRelease ?? false,
    skipPrCreation: cliArgs.skipPrCreation ?? fileConfig.release?.skipPrCreation ?? false,
  };
}

const DEFAULT_VERSION = '0.1.0';
const DEFAULT_TYPE = 'simple';
const DEFAULT_PATH = '.';

/**
 * Hydrate manifests from the unified .arp.config.json.
 *
 * Type resolution priority per manifest item:
 *   1. cliType  (CLI --type flag — overrides everything)
 *   2. item.type
 *   3. globalType (file-level "type" field)
 *   4. 'simple'  (hard default)
 *
 * versionPrefix resolution per manifest item:
 *   - item.versionPrefix from the config file is stored as-is (string).
 *   - Items without an explicit versionPrefix are left undefined (fall back to global at runtime).
 */
function hydrateManifests(fileConfig: ArpConfigFile, cliType?: string): Manifest[] {
  if (!fileConfig.manifests || fileConfig.manifests.length === 0) {
    return [{
      path: DEFAULT_PATH,
      currentVersion: fileConfig.version ?? DEFAULT_VERSION,
      type: cliType ?? fileConfig.type ?? DEFAULT_TYPE,
    }];
  }

  const globalVersion = fileConfig.version ?? DEFAULT_VERSION;
  const globalType = fileConfig.type ?? DEFAULT_TYPE;

  return fileConfig.manifests.map((item, index) => {
    const resolvedType = cliType ?? item.type ?? globalType;
    const resolvedVersion = item.version ?? globalVersion;
    const resolvedPath = item.path ?? DEFAULT_PATH;
    const resolvedVersionPrefix = item.versionPrefix;
    const resolvedIdentifier = item.identifier;
    const resolvedIdentifierBase = item.identifierBase;

    if (resolvedType === 'custom') {
      if (!item.files || item.files.length === 0) {
        throw new Error(
          `Manifest at index ${index} has type 'custom' but no 'files' defined. ` +
          `Custom manifests must include an explicit list of files.`
        );
      }
      return {
        path: resolvedPath,
        currentVersion: resolvedVersion,
        type: resolvedType,
        versionPrefix: resolvedVersionPrefix,
        identifier: resolvedIdentifier,
        identifierBase: resolvedIdentifierBase,
        files: item.files,
      } satisfies Manifest;
    }

    // Non-custom types: the processor discovers files itself — strip any files field
    return {
      path: resolvedPath,
      currentVersion: resolvedVersion,
      type: resolvedType,
      versionPrefix: resolvedVersionPrefix,
      identifier: resolvedIdentifier,
      identifierBase: resolvedIdentifierBase,
    } satisfies Manifest;
  });
}

/**
 * Validate that required configuration is present
 * Note: Most validation is done during loadConfig, but this can be used for additional checks
 */
export function validateConfig(config: AppConfig): void {

  config = config;
  // Additional validation can be added here if needed
}

