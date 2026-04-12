/**
 * Release PR Command
 * Creates or updates a release pull request
 */

import type { AppConfig } from '../config/config-types.js';
import { resolveCommitContext, buildSourceBranch } from '../helpers/index.js';
import { ManifestProcessor } from '../processors/manifest-processor.js';
import * as logger from '../logger.js';
import type { ReleasePrReturn } from './types.js';

export async function releasePr(args: string[], config: AppConfig): Promise<ReleasePrReturn> {
  if (args.includes('--help') || args.includes('-h')) {
    logger.info('Usage: arp release-pr [options]');
    logger.info('');
    logger.info('Creates or updates a release pull request');
    logger.info('');
    logger.info('Options:');
    logger.info('  --help, -h    Show this help message');
    logger.info('');
    logger.info('Global options like --provider, --token, --target-branch, etc. can be used.');
    logger.info('See "arp --help" for a full list of global options.');
    logger.info('');

    // Return a minimal structured help result so CLI always emits JSON
    return {
      nextVersion: '',
      sourceBranch: '',
      targetBranch: '',
      created: false,
      updated: false,
      dryRun: !!config.dryRun,
    };
  }

  logger.info('Release PR command');
  logger.info('');

  try {
    // enable logger debug mode if requested in config
    logger.setDebug(!!config.debug);

    // Configuration is already loaded and validated at entry point

    if (config.dryRun) {
      logger.info('🔍 Running in dry-run mode - no changes will be made');
      logger.info('');
    }

    if (config.debug) {
      logger.debug('🐛 Debug mode enabled - detailed logging active');
      logger.debug('');
    }

    const currentManifestVersions = config.manifests?.map(m => m.currentVersion) ?? []

    logger.info(`📦 Using ${config.provider.name} provider`);

    const ctx = await resolveCommitContext(config);
    const { targetBranch, conventionalCommits: conventionalCommitsSinceLastRelease, nextVersion, baseVersion } = ctx;
    // prBranch is the destination branch for the PR; defaults to targetBranch
    const prDestBranch = config.release.prBranch ?? targetBranch;

    // Build source branch and tags
    const branchPrefix = config.release.releaseBranchPrefix || 'feature/';
    const sourceBranch = buildSourceBranch(branchPrefix, targetBranch, prDestBranch);
    const prTagsToCreate = [`arp: ${nextVersion}`, `autorelease: pending`, config.release.prerelease ? `arp: prerelease` : 'arp: release'];

    // Process manifests
    logger.info('');
    logger.info('📦 Processing manifests...');
    const manifestProcessor = new ManifestProcessor(conventionalCommitsSinceLastRelease, config);
    const manifestResults = await manifestProcessor.process();

    if (conventionalCommitsSinceLastRelease.length === 0) {
      logger.info('⚠️  No conventional commits found since last release. No Release PR created.');
      return { currentVersion: baseVersion, nextVersion: nextVersion, sourceBranch: '', targetBranch, created: false, updated: false, prTags: [], manifestFiles: [], manifestCurrentVersions: currentManifestVersions, manifestNextVersions: manifestResults.nextManifestVersions, dryRun: !!config.dryRun };
    }

    const title = `chore(${targetBranch}): Release ${nextVersion}`;
    const body = manifestResults.changelog || `Release ${nextVersion}`;

    const getMergePrs = await config.provider.findPullRequestByBranch(sourceBranch, prDestBranch, 'autorelease: pending', 'open');
    if (getMergePrs.length > 1) {
      logger.error(`🛑  Found ${getMergePrs.length} open autorelease: pending merge requests — expected at most 1. Cannot determine which to update.`);
      return { currentVersion: baseVersion, nextVersion: nextVersion, sourceBranch, targetBranch, created: false, updated: false, prTags: [], manifestFiles: [], manifestCurrentVersions: currentManifestVersions, manifestNextVersions: manifestResults.nextManifestVersions, dryRun: !!config.dryRun };
    }
    const getMergePr = getMergePrs.length > 0 ? getMergePrs[0] : null;
    let result: ReleasePrReturn = {
      currentVersion: baseVersion,
      nextVersion,
      sourceBranch,
      targetBranch,
      created: false,
      updated: false,
      prTags: prTagsToCreate,
      manifestFiles: config.debug ? manifestResults.files : undefined,
      manifestCurrentVersions: currentManifestVersions,
      manifestNextVersions: manifestResults.nextManifestVersions,
      dryRun: !!config.dryRun,
    };

    logger.debug(`Release PR details: ${JSON.stringify(result, null, 2)}`);

    if (config.dryRun) {
      logger.info('');
      logger.info('🔍 Dry-run mode: skipping PR creation/update');
      result.created = false;
    } else if (config.release.skipPrCreation) {
      logger.info('');
      logger.info('⏭️  skip-pr-creation: skipping PR creation/update');
    } else if (getMergePr === null) {
      const newPrId = await config.provider.createReleasePR(title, body, sourceBranch, targetBranch, prDestBranch, manifestResults.files, prTagsToCreate, nextVersion);
      result.created = true;
      result.prNumber = newPrId;
    } else {
      await config.provider.updateReleasePR(title, body, getMergePr.number.toString(), sourceBranch, targetBranch, prDestBranch, manifestResults.files, prTagsToCreate, nextVersion);
      result.updated = true;
      result.prNumber = getMergePr.number;
    }

    return result;
  } catch (error) {
    // Re-throw the error so CLI can format and output as JSON error and set non-zero exit
    throw error;
  }
}
