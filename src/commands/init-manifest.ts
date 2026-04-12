/**
 * Init Manifest Command
 * Prints a valid .arp.config.json to stdout, ready to be saved to disk.
 */

import type { AppConfig, ReleaseConfig } from '../config/config-types.js';
import type { InitManifestReturn } from './types.js';
import type { ManifestItemSchema } from '../types/manifest.js';
import * as logger from '../logger.js';

export async function initManifest(args: string[], config: AppConfig): Promise<InitManifestReturn> {
  if (args.includes('--help') || args.includes('-h')) {
    logger.info('Usage: arp init-manifest [options]');
    logger.info('');
    logger.info('Prints a .arp.config.json skeleton to stdout.');
    logger.info('Pipe the output to create the file:');
    logger.info('  arp init-manifest > .arp.config.json');
    logger.info('');
    logger.info('Options:');
    logger.info('  --help, -h    Show this help message');
    logger.info('');
    logger.info('Global options like --provider, --token, --target-branch, etc. can be used.');
    logger.info('See "arp --help" for a full list of global options.');
    logger.info('');

    return buildOutput(config);
  }

  try {
    // enable logger debug mode if requested in config
    logger.setDebug(!!config.debug);

    // Only JSON should be written to stdout so the command is pipeable. Any
    // diagnostic information (debug/dry-run notes) are written to stderr.
    if (config.debug) {
      logger.debug('🐛 Debug mode enabled - detailed logging active');
    }

    if (config.dryRun) {
      logger.info('🔍 Running in dry-run mode - no changes will be made');
    }

    return buildOutput(config);
  } catch (error) {
    // Re-throw for CLI to format to JSON and exit non-zero
    throw error;
  }
}

/**
 * Build an InitManifestReturn reflecting the current AppConfig,
 * shaped like a .arp.config.json file (without sensitive token values).
 * Optional fields are omitted when they equal their default values.
 */
function buildOutput(config: AppConfig): InitManifestReturn {
  const providerName = config.provider.name as 'gitlab' | 'github';
  const r = config.release;

  // Build release config — always emitted so the skeleton is self-documenting.
  // Non-default values from config take precedence; omit only truly optional
  // fields (draft, releaseBranchPrefix when 'feature/') that add noise.
  const release: Partial<ReleaseConfig> = {
    prerelease: r.prerelease ?? false,
    targetBranch: r.targetBranch,
    releaseBranchPrefix: r.releaseBranchPrefix ?? 'feature/',
    maxReleases: r.maxReleases ?? 10,
    maxCommits: r.maxCommits ?? 100,
    includeChores: r.includeChores ?? false,
  };
  if (r.draft) release.draft = r.draft;

  // Convert hydrated Manifest[] back to ManifestItemSchema[], omitting type when it is the default
  const manifests: ManifestItemSchema[] = config.manifests.map(m => {
    const item: ManifestItemSchema = { path: m.path, version: m.currentVersion, type: m.type };
    if (m.versionPrefix !== undefined) item.versionPrefix = m.versionPrefix;
    if (m.files) item.files = m.files;
    return item;
  });

  return {
    provider: providerName,
    release: release as ReleaseConfig,
    version: config.manifests[0]?.currentVersion,
    ...(config.dryRun ? { dryRun: true } : {}),
    manifests,
  };
}
