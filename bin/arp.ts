#!/usr/bin/env node

/**
 * ARP - Another Release Please CLI
 * Main entry point for the CLI application
 */

import { pathToFileURL } from 'url';
import { releasePr } from '../src/commands/release-pr.js';
import { release } from '../src/commands/release.js';
import { initManifest } from '../src/commands/init-manifest.js';
import { calculateNext } from '../src/commands/calculate-next.js';
import { loadConfig, validateConfig, type CliArgs } from '../src/config/index.js';
import { createProvider } from '../src/providers/git-provider.js';
import type { AppConfig } from '../src/config/config-types.js';
import { registerManifestType } from '../src/processors/package-manifest-factory.js';
import { SimplePackageManifest } from '../src/processors/manifests/simple-package-manifest.js';
import { JavaPackageManifest } from '../src/processors/manifests/java-package-manifest.js';
import { HelmPackageManifest } from '../src/processors/manifests/helm-package-manifest.js';
import { CustomPackageManifest } from '../src/processors/manifests/custom-package-manifest.js';
import { CSharpPackageManifest } from '../src/processors/manifests/csharp-package-manifest.js';
import { NodePackageManifest } from '../src/processors/manifests/node-package-manifest.js';
import * as logger from '../src/logger.js';

type CommandFunction = (args: string[], config: AppConfig) => Promise<unknown>;

const COMMANDS: Record<string, CommandFunction> = {
  'release': release,
  'release-pr': releasePr,
  'init-manifest': initManifest,
  'calculate-next': calculateNext,
};

function showHelp(): void {
  logger.info('ARP - Another Release Please');
  logger.info('');
  logger.info('Usage:');
  logger.info('  arp <command> [options]');
  logger.info('');
  logger.info('Available commands:');
  logger.info('  release          Create a release from the latest merged autorelease MR');
  logger.info('  release-pr       Create or update a release pull request');
  logger.info('  calculate-next   Calculate next version and update version files on the target branch');
  logger.info('                   Use --write-local to write files to the local filesystem instead of committing');
  logger.info('  init-manifest    Print initial manifest JSON to stdout');
  logger.info('');
  logger.info('Global options:');
  logger.info('  --provider <type>         Git provider (gitlab or github) [required]');
  logger.info('  --token <token>           Authentication token for the provider [required]');
  logger.info('  --repository <url>        Full repository URL (e.g., https://gitlab.com/owner/repo) [required]');
  logger.info('  --target-branch <branch>  Target branch for the release PR');
  logger.info('  --pr-branch <branch>      Destination branch for the pull request (defaults to --target-branch)');
  logger.info('  --prerelease              Mark the release as a prerelease');
  logger.info('  --type <type>             Override the manifest type for all packages (e.g. simple, maven, custom)');
  logger.info('  --versioner <type>        Version management strategy (default: semver)');
  logger.info('  --dry-run                 Run without making actual changes');
  logger.info('  --debug                   Enable detailed debug logging');
  logger.info('  --include-chores          Include chore commits when determining release eligibility');
  logger.info('  --version-prefix <prefix>         Prefix for version tags (default: "v", e.g. "v" matches "v1.2.3")');
  logger.info('  --issue-url-template <template>   URL template for issue refs (e.g. "https://jira.example.com/browse/{id}")');
  logger.info('  --use-file-system                 Scan and read files from local filesystem instead of provider APIs (default: true)');
  logger.info('  --no-use-file-system              Use provider APIs instead of local filesystem');
  logger.info('  --update-all-versions             Update every manifest regardless of which paths changed');
  logger.info('  --skip-pr-creation                Skip creating or updating the release pull request');
  logger.info('  --help, -h                Show this help message');
  logger.info('  --version, -v             Show version information');
  logger.info('');
  logger.info('Environment variables:');
  logger.info('  GITLAB_TOKEN              GitLab authentication token');
  logger.info('  GITHUB_TOKEN              GitHub authentication token');
  logger.info('  ARP_DRY_RUN               Enable dry-run mode');
  logger.info('  ARP_DEBUG                 Enable debug mode');
}

/**
 * Parse global options from command line arguments
 */
function parseGlobalOptions(args: string[]): { options: CliArgs; remainingArgs: string[] } {
  const options: CliArgs = {
    prerelease: false, // Always default to false
    dryRun: false, // Always default to false
  };
  const remainingArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--provider' && i + 1 < args.length) {
      options.provider = args[++i];
    } else if (arg === '--token' && i + 1 < args.length) {
      options.token = args[++i];
    } else if (arg === '--repository' && i + 1 < args.length) {
      options.repository = args[++i];
    } else if (arg === '--target-branch' && i + 1 < args.length) {
      options.targetBranch = args[++i];
    } else if (arg === '--prerelease') {
      options.prerelease = true;
    } else if (arg === '--type' && i + 1 < args.length) {
      options.type = args[++i];
    } else if (arg === '--versioner' && i + 1 < args.length) {
      options.versioner = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--include-chores') {
      options.includeChores = true;
    } else if (arg === '--version-prefix' && i + 1 < args.length) {
      options.versionPrefix = args[++i];
    } else if (arg === '--issue-url-template' && i + 1 < args.length) {
      options.issueUrlTemplate = args[++i];
    } else if (arg === '--use-file-system') {
      options.useFileSystem = true;
    } else if (arg === '--no-use-file-system') {
      options.useFileSystem = false;
    } else if (arg === '--update-all-versions') {
      options.updateAllVersions = true;
    } else if (arg === '--skip-tag') {
      options.skipTag = true;
    } else if (arg === '--skip-release') {
      options.skipRelease = true;
    } else if (arg === '--skip-pr-creation') {
      options.skipPrCreation = true;
    } else if (arg === '--pr-branch' && i + 1 < args.length) {
      options.prBranch = args[++i];
    } else {
      remainingArgs.push(arg);
    }
  }

  return { options, remainingArgs };
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      showHelp();
      return;
    }

    if (args[0] === '--help' || args[0] === '-h') {
      showHelp();
      return;
    }

    // Parse global options
    const { options: globalOptions, remainingArgs } = parseGlobalOptions(args);

    if (remainingArgs.length === 0) {
      showHelp();
      return;
    }

    const command = remainingArgs[0];
    const commandArgs = remainingArgs.slice(1);

    if (COMMANDS[command]) {
      // Determine provider type
      const providerType = globalOptions.provider?.toLowerCase() as 'gitlab' | 'github' | undefined;

      if (!providerType) {
        throw new Error(
          'Provider type is required. Set it via:\n' +
          '  - CLI: --provider <gitlab|github>'
        );
      }

      if (providerType !== 'gitlab' && providerType !== 'github') {
        throw new Error(`Unsupported provider: ${providerType}. Must be 'gitlab' or 'github'.`);
      }

      // Get token (optional, will fall back to environment variable in provider)
      const token = globalOptions.token;

      // Get repository URL
      const repositoryUrl = globalOptions.repository;

      if (!repositoryUrl) {
        throw new Error(
          'Repository URL is required. Set it via:\n' +
          '  - CLI: --repository <url>\n' +
          `  Example: https://${providerType}.com/owner/repo`
        );
      }

      // Create provider instance first (provider will read token from environment if not provided)
      const provider = createProvider(providerType, repositoryUrl, token);

      // Load configuration with provider
      const config = await loadConfig(globalOptions, provider);
      validateConfig(config);

      // Register types
      registerManifestType('simple', SimplePackageManifest);
      registerManifestType('java', JavaPackageManifest);
      registerManifestType('helm', HelmPackageManifest);
      registerManifestType('custom', CustomPackageManifest);
      registerManifestType('csharp', CSharpPackageManifest);
      registerManifestType('node', NodePackageManifest);

      const result = await COMMANDS[command](commandArgs, config);

      if (typeof result !== 'undefined') {
        // Print the single JSON result to stdout for piping
        // Use helper to avoid pulling in heavy modules during tests
        const { outputSuccess } = await import('../src/cli/output.js');
        outputSuccess(result);
      }
    } else {
      const cmdErr = { error: true, message: `Unknown command: ${command}`, code: 1 } as const;
      const { outputError } = await import('../src/cli/output.js');
      outputError(cmdErr);
    }
  } catch (error) {
    const err = error as any;
    const cmdErr = {
      error: true,
      message: err?.message || String(err),
      code: err?.code || 1,
      details: err?.details,
    };

    // Write structured JSON error to stderr
    console.error(JSON.stringify(cmdErr));

    // Optionally write stack to stderr when in debug mode
    if (process.env.DEBUG && err?.stack) {
      console.error(err.stack);
    }

    process.exit(cmdErr.code);
  }
}

// Only execute main when run directly from the CLI.
// Tests import this module and will call `main()` directly as needed.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

// Exporting for testing and programmatic use
export { main, COMMANDS };
