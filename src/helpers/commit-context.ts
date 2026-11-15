/**
 * Shared commit context resolution for release commands.
 * Handles repository info fetch, tag/commit fetch with debug logging,
 * version-tag anchor resolution, conventional commit filtering, and
 * next-version calculation — logic shared by release-pr and calculate-next.
 */

import type { AppConfig } from '../config/config-types.js';
import type { Commit, Tag } from '../types/provider.js';
import { reduceTagsOnBranchToLatest, reduceCommitsToConventionalSinceLastRelease } from './index.js';
import * as logger from '../logger.js';
import { parseCommitMessage } from './commit-parser.js';

/**
 * Expand conventional messages while retaining each entry's body and footers.
 * Tags stay on the first entry; all entries retain the original commit identity.
 */
export async function expandCommits(commits: Commit[]): Promise<Commit[]> {
  const result: Commit[] = [];

  for (const commit of commits) {
    const entries = parseCommitMessage(commit.message);
    if (entries.length === 0) {
      result.push(commit);
      continue;
    }

    for (let i = 0; i < entries.length; i++) {
      result.push({
        ...commit,
        tags: i === 0 ? commit.tags : [],
        title: entries[i].title,
        message: entries[i].message,
      });
    }
  }

  return result;
}

export interface CommitContext {
  targetBranch: string;
  tags: Tag[];
  commits: Commit[];
  lastVersionTag: Tag | null | undefined;
  conventionalCommits: Commit[];
  nextVersion: string;
  baseVersion: string;
}

/**
 * Resolves all context needed to perform a version-related release command:
 * fetches repo info, tags, commits, determines the version tag anchor, filters
 * conventional commits since the last release, and calculates the next version.
 *
 * Always returns a CommitContext with resolved versions. includeAllCommits retains
 * all commits since the release anchor for forced release PRs.
 */
export async function resolveCommitContext(config: AppConfig, includeAllCommits = false): Promise<CommitContext> {
  logger.info('📂 Fetching repository information...');
  const repo = await config.provider.getRepository();
  logger.info(`   Repository: ${repo.fullPath}`);
  logger.info(`   Default branch: ${repo.defaultBranch}`);

  const targetBranch = config.release.targetBranch || repo.defaultBranch;
  logger.info(`   Target branch: ${targetBranch}`);
  logger.info(`   PR Target branch: ${config.release.prBranch}`);

  if (config.release.prerelease) {
    logger.info('   Release type: Prerelease');
  }

  logger.info('');
  logger.info('📋 Analyzing commit history...');

  // Fetch tags
  let tags: Tag[];
  let foundCommit: string | undefined;
  if (config.version) {
    // Look up only the exact tag for the configured version (try bare version first, then prefixed)
    const tagByName = await config.provider.getTag(config.version);
    const foundTag = tagByName ?? await config.provider.getTag(`${config.versionPrefix}${config.version}`);
    tags = foundTag ? [foundTag] : [];
    if (foundTag) {
      logger.info(`   🏷️  Found tag for configured version: ${foundTag.name} (${foundTag.commit.substring(0, 8)})`);
      foundCommit = foundTag.commit;
    } else {
      logger.info(`   🏷️  No tag found for configured version: ${config.version} — will search for previous tag`);
      logger.info(`   🏷️  Fetching tags (max ${config.release.maxCommits})...`);
      tags = await config.provider.getTags(config.release.maxCommits);
      logger.info(`   Found ${tags.length} tag(s)`);
    }
  } else {
    logger.info(`   🏷️  Fetching tags (max ${config.release.maxCommits})...`);
    tags = await config.provider.getTags(config.release.maxCommits);
    logger.info(`   Found ${tags.length} tag(s)`);
  }

  if (config.debug && tags.length > 0) {
    logger.debug('');
    logger.debug('   🏷️  Tag Details:');
    tags.slice(0, 10).forEach((tag, idx) => {
      logger.debug(`      ${idx + 1}. ${tag.name} -> ${tag.commit.substring(0, 8)}`);
      if (tag.message) logger.debug(`         Message: ${tag.message}`);
      if (tag.createdAt) logger.debug(`         Created: ${tag.createdAt.toISOString()}`);
    });
    if (tags.length > 10) {
      logger.debug(`      ... and ${tags.length - 10} more`);
    }
    logger.debug('');
  }

  // Fetch commits
  logger.info(`   📝 Fetching commits (max ${config.release.maxCommits})...`);
  const commitsCompressed = await config.provider.getCommits(config.release.maxCommits, tags, foundCommit, targetBranch);
  const commits = await expandCommits(commitsCompressed);
  logger.info(`   Found ${commits.length} commit(s)`);

  const taggedCommits = commits.filter(c => c.tags && c.tags.length > 0).length;
  logger.info(`   Found ${taggedCommits} tagged commit(s)`);

  if (config.debug && commits.length > 0) {
    logger.debug('');
    logger.debug('   📝 Commit Details:');
    commits.slice(0, 10).forEach((commit, idx) => {
      logger.debug(`      ${idx + 1}. ${commit.sha.substring(0, 8)} - ${commit.title}`);
      logger.debug(`         Author: ${commit.author.name} <${commit.author.email}>`);
      logger.debug(`         Date: ${commit.date.toISOString()}`);
      if (commit.tags.length > 0) logger.debug(`         Tags: ${commit.tags.map((t: Tag) => t.name).join(', ')}`);
      if (commit.files.length > 0) logger.debug(`         Files changed: ${commit.files.length}`);
    });
    if (commits.length > 10) {
      logger.debug(`      ... and ${commits.length - 10} more`);
    }
    logger.debug('');
  }

  // Find the version tag anchor
  let lastVersionTag: Tag | null | undefined;
  if (config.version) {
    // tags contains at most one item — the exact tag for the configured version
    lastVersionTag = tags.length > 0 ? tags[0] : undefined;
    if (lastVersionTag) {
      logger.info(`   📌 Tag anchor: ${lastVersionTag.name} (${lastVersionTag.commit.substring(0, 8)})`);
    } else {
      logger.info(`   📌 No tag found for ${config.version} — treating as base version`);
    }
  } else {
    lastVersionTag = reduceTagsOnBranchToLatest(commits, config.versioner);
    if (lastVersionTag) {
      logger.info(`   📌 Latest version tag: ${lastVersionTag.name} (${lastVersionTag.commit.substring(0, 8)})`);
    } else {
      logger.info(`   📌 No version tags found`);
    }
  }

  const conventionalCommits = reduceCommitsToConventionalSinceLastRelease(commits, lastVersionTag?.commit, config.release.includeChores ?? false, targetBranch, includeAllCommits);
  logger.info(`   Found ${conventionalCommits.length} conventional commit(s) since last release`);

  const baseVersion = config.version ?? (lastVersionTag ? lastVersionTag.name : `${config.versionPrefix}0.1.0`);
  const nextVersion = config.versioner.calculateNextVersion(
    conventionalCommits, baseVersion, !!config.release.prerelease, config.release.includeChores ?? false,
  ).toString();
  logger.info(`   Next version: ${nextVersion}`);

  // Mutate config.version so downstream processors (ManifestProcessor) use the resolved base
  config.version = baseVersion;

  return { targetBranch, tags, commits, lastVersionTag, conventionalCommits, nextVersion, baseVersion };
}
