/**
 * Release Command
 * Finds the last autorelease: pending merge request and creates a tag+release on the target branch head
 */

import type { AppConfig } from '../config/config-types.js';
import { buildSourceBranch } from '../helpers/index.js';
import * as logger from '../logger.js';
import type { ReleaseReturn } from './types.js';

export async function release(args: string[], config: AppConfig): Promise<ReleaseReturn> {
  const manifestVersions = config.manifests?.map(m => m.currentVersion) ?? [];

  if (args.includes('--help') || args.includes('-h')) {
    logger.info('Usage: arp release [options]');
    logger.info('');
    logger.info('Creates a release from the latest merged merge request with label `autorelease: pending`');
    logger.info('');
    logger.info('Options:');
    logger.info('  --help, -h       Show this help message');
    logger.info('  --skip-tag       Skip creating the provider tag');
    logger.info('  --skip-release   Skip creating the provider release (sets created=false)');
    logger.info('');

    return { tagName: '', created: false, manifestVersions };
  }

  logger.info('Release command');
  logger.info('');

  try {
    // enable logger debug mode if requested in config
    logger.setDebug(!!config.debug);

    if (config.dryRun) {
      logger.info('🔍 Running in dry-run mode - no changes will be made');
      logger.info('');
    }

    logger.info(`📦 Using ${config.provider.name} provider`);

    logger.info('📂 Fetching repository information...');
    const repo = await config.provider.getRepository();
    logger.info(`   Repository: ${repo.fullPath}`);
    logger.info(`   Default branch: ${repo.defaultBranch}`);

    logger.info('');
    logger.info('🔎 Looking for the most recent autorelease: pending merge request...');

    const targetBranch = config.release.targetBranch || repo.defaultBranch;
    logger.info(`   Target branch: ${targetBranch}`);

    const branchPrefix = config.release.releaseBranchPrefix || 'feature/';
    const prDestBranch = config.release.prBranch ?? targetBranch;
    const sourceBranch = buildSourceBranch(branchPrefix, targetBranch, prDestBranch);
    logger.info(`   Source branch: ${sourceBranch}`);
    const mrs = await config.provider.findPullRequestByBranch(sourceBranch, prDestBranch, 'autorelease: pending', 'merged');

    // TODO: We need to get the current version if a manifest wasnt loaded and no version available.
    if (mrs.length === 0) {
      logger.info('⚠️  No pending autorelease merge requests found. No Release created.');
      logger.info('ℹ️  Version only determined from .arp.config.json version field. If this file doesn\'t exist or isn\'t set then version is default.');
      return { tagName: '', created: false, currentVersion: config.version, manifestVersions };
    }

    if (mrs.length > 1) {
      // TODO: Maybe we should throw an error if we have 2 pending releases on the same branch?
      logger.error(`🛑  Found ${mrs.length} merged autorelease: pending merge requests — expected at most 1 on branch ${targetBranch}. Cannot determine which to release.`);
      return { tagName: '', created: false, currentVersion: config.version, manifestVersions };
    }

    const mr = mrs[0];

    if (mr.state !== 'merged') {
      logger.info(`⚠️  Found merge request #${mr.number} but it is not merged (state=${mr.state})`);
      return { tagName: '', created: false, currentVersion: config.version, manifestVersions };
    }

    logger.info(`   Found merged PR: #${mr.number} (${mr.title})`);
    logger.info(`     Source: ${mr.sourceBranch}`);
    logger.info(`     Target: ${mr.targetBranch}`);

    // Determine version from label (prefer arp: vX.Y.Z)
    const versionLabel = mr.labels.find((l: string) => config.versioner.match(l.substring('arp:'.length)));
    let version: string;

    if (versionLabel) {
      version = versionLabel.substring('arp:'.length).trim();
      logger.info(`   Version to create found on MR label: ${version}`);
    } else {
      logger.error('   No version label found on MR - take it from the header');
      throw new Error('Not implemented - version label is required on the MR for now');
    }

    const tagName = version;
    const tagMessage = `Release ${version}`;

    // Tag should be on the target branch head per requirements
    const ref = mr.targetBranch;

    // Build release description from the merged PR body
    const releasedAt = new Date().toISOString();
    const prBody = mr.body?.trim() || tagMessage;
    const releaseDescription = `## Release ${version}\n\n${prBody}\n\n---\nReleased on ${releasedAt}`;

    logger.debug(`   Release description ${releaseDescription}`);
    if (config.dryRun) {
      if (config.release.skipTag) {
        logger.info(`   Would skip creating tag ${tagName} (--skip-tag)`);
      } else {
        logger.info(`   Would create tag ${tagName} on ${ref}`);
      }
      if (config.release.skipRelease) {
        logger.info(`   Would skip creating release ${tagName} (--skip-release)`);
      } else {
        logger.info(`   Would create release ${tagName}`);
      }

      return { tagName, created: false, currentVersion: tagName, manifestVersions };
    }

    if (!config.release.skipTag) {
      logger.info(`   Creating tag ${tagName} on ${ref}...`);
      const createdTags = await config.provider.createTags([{ name: tagName, ref, message: tagMessage }]);

      if (createdTags.length === 0) {
        logger.warn('⚠️  Tag creation failed or returned no tags');
      } else {
        logger.info(`   Created tag: ${createdTags[0].name} -> ${createdTags[0].commit.substring(0, 8)}`);
      }
    } else {
      logger.info(`   Skipping tag creation (--skip-tag)`);
    }

    let created = false;
    let releaseResult: Awaited<ReturnType<typeof config.provider.createRelease>> | undefined;

    if (!config.release.skipRelease) {
      logger.info('   Creating release...');
      releaseResult = await config.provider.createRelease({ tagName, name: `Release ${version}`, description: releaseDescription, ref, prerelease: !!config.release.prerelease });
      created = releaseResult.created;

      if (created)
        logger.info('✅ Release created!');
      else
        logger.info('⚠️ Release was not created.');
      if (releaseResult.webUrl) logger.info(`   ${releaseResult.webUrl}`);
      if (releaseResult.tagName) logger.info(`   Tag: ${releaseResult.tagName}`);
      if (releaseResult.commitSha) logger.info(`   Commit: ${releaseResult.commitSha.substring(0, 8)}`);
    } else {
      logger.info(`   Skipping release creation (--skip-release)`);
    }

    // Only update MR labels if provider implements the method
    await config.provider.updatePullRequestLabels?.(mr.number, ["autorelease: released"], ["autorelease: pending"], !!config.dryRun);

    logger.debug(`Release details: ${JSON.stringify({ tagName, created, releaseUrl: releaseResult?.webUrl, release: releaseResult, currentVersion: tagName, manifestVersions }, null, 2)}`);

    return { tagName, created, releaseUrl: releaseResult?.webUrl, release: releaseResult, currentVersion: tagName, manifestVersions };
  } catch (error) {
    // Re-throw for CLI to format to JSON and exit non-zero
    throw error;
  }
}
