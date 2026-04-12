/**
 * Calculate Next Command
 * Calculates the next version and updates version files, then commits them
 * directly to the target branch (or writes them to the local filesystem).
 *
 * Similar to release-pr but:
 *  - Does not generate a changelog entry
 *  - Does not create/update a Pull/Merge Request
 *  - Commits version-bumped files straight to the target branch
 *  - Supports --write-local to write files to the local filesystem instead
 *  - Accepts --prerelease (global flag) to calculate a prerelease version
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppConfig } from '../config/config-types.js';
import { resolveCommitContext } from '../helpers/index.js';
import { ManifestProcessor } from '../processors/manifest-processor.js';
import * as logger from '../logger.js';
import type { CalculateNextReturn } from './types.js';

export async function calculateNext(args: string[], config: AppConfig): Promise<CalculateNextReturn> {
  const writeLocal = args.includes('--write-local');

  if (args.includes('--help') || args.includes('-h')) {
    logger.info('Usage: arp calculate-next [options]');
    logger.info('');
    logger.info('Calculates the next version and updates version files.');
    logger.info('By default, commits the changes directly to the target branch.');
    logger.info('');
    logger.info('Options:');
    logger.info('  --write-local   Write updated files to the local filesystem instead of committing');
    logger.info('  --help, -h      Show this help message');
    logger.info('');
    logger.info('Global options like --provider, --token, --target-branch, --prerelease, etc. can be used.');
    logger.info('See "arp --help" for a full list of global options.');
    logger.info('');

    return {
      nextVersion: '',
      targetBranch: '',
      dryRun: !!config.dryRun,
    };
  }

  logger.info('Calculate Next command');
  logger.info('');

  try {
    logger.setDebug(!!config.debug);

    if (config.dryRun) {
      logger.info('🔍 Running in dry-run mode - no changes will be made');
      logger.info('');
    }

    if (config.debug) {
      logger.debug('🐛 Debug mode enabled - detailed logging active');
      logger.debug('');
    }

    logger.info(`📦 Using ${config.provider.name} provider`);

    const ctx = await resolveCommitContext(config);
    const { targetBranch, conventionalCommits, nextVersion, baseVersion } = ctx;
    if (conventionalCommits.length === 0) {
      logger.info('⚠️  No conventional commits found since last release. Minor patch or prerelease will be selected.');
    }

    // Process manifests (skip changelog)
    logger.info('');
    logger.info('📦 Processing manifests...');
    const manifestProcessor = new ManifestProcessor(conventionalCommits, config, true);
    const manifestResults = await manifestProcessor.process();

    const result: CalculateNextReturn = {
      nextVersion,
      targetBranch,
      currentVersion: baseVersion,
      manifestFiles: config.debug ? manifestResults.files : undefined,
      dryRun: !!config.dryRun,
    };

    if (config.dryRun) {
      logger.info('');
      logger.info('🔍 Dry-run mode: skipping file updates');
      logger.info(`   Would update ${manifestResults.files.length} file(s) to version ${nextVersion}`);
      manifestResults.files.forEach(f => logger.debug(`   - ${f.path} (${f.status})`));
    } else if (writeLocal) {
      logger.info('');
      logger.info('💾 Writing files to local filesystem...');
      for (const file of manifestResults.files) {
        const absolutePath = join(process.cwd(), file.path);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, file.content, 'utf-8');
        logger.info(`   Written: ${file.path}`);
      }
      result.writtenLocal = true;
      logger.info(`✅ Wrote ${manifestResults.files.length} file(s) locally`);
    } else {
      logger.info('');
      logger.info(`🚀 Committing ${manifestResults.files.length} file(s) to branch '${targetBranch}'...`);
      await config.provider.commitFiles({
        branch: targetBranch,
        message: `chore: update versions to ${nextVersion}`,
        files: manifestResults.files.map(f => ({ path: f.path, content: f.content })),
      });
      result.committed = true;
      logger.info(`✅ Committed version files to '${targetBranch}'`);
    }

    return result;
  } catch (error) {
    throw error;
  }
}
