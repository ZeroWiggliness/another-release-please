/**
 * Manifest processor
 * Processes commits for all manifests in the configuration
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Commit } from '../types/provider.js';
import type { FileOperation, ManifestProcessResult } from './types.js';
import type { ManifestFileType } from '../types/manifest.js';
import { ProcessedManifest } from './types.js';
import { createPackageManifest } from './package-manifest-factory.js';
import { normalizePath, isFileInManifestPath } from '../helpers/index.js';
import { AppConfig } from '../config/config-types.js';
import { HandlebarsChangelogWriter } from '../changelog/index.js';
import { minimatch } from 'minimatch';
import { parseDocument } from 'yaml';
import * as logger from '../logger.js';

/**
 * Manifest processor class
 * Coordinates processing of all manifests
 */
export class ManifestProcessor {
  private commits: Commit[];
  private config: AppConfig;
  private skipChangelog: boolean;

  constructor(commits: Commit[], config: AppConfig, skipChangelog = false) {
    this.commits = commits;
    this.config = config;
    this.skipChangelog = skipChangelog;
  }

  /**
   * Process commits for all manifests
   * @returns ManifestProcessResult containing the changelog and file operations
   */
  async process(): Promise<ManifestProcessResult> {
    // Use the nextVersion from the config or default to prefixed '0.1.0'
    const currentVersion = this.config.version ?? `${this.config.versionPrefix}0.1.0`;
    const nextMainVersion = this.config.versioner.calculateNextVersion(this.commits, currentVersion, this.config.release.prerelease || false, this.config.release.includeChores ?? false);

    const results: ManifestProcessResult = {
      nextVersion: nextMainVersion.toString(),
      nextManifestVersions: [],
      files: [],
      changelog: '',
    };

    if (!this.skipChangelog) {
      const { section, fileOperation } = await this.generateChangelog(this.commits, nextMainVersion.toString());
      results.changelog = section;
      results.files.push(fileOperation);
      logger.debug('  Generated changelog section:');
      logger.debug(section);
    }

    let repositoryFiles: string[];
    if (this.config.useFileSystem !== false) {
      repositoryFiles = this.scanLocalFiles();
    } else {
      repositoryFiles = await this.config.provider.listAllFiles(this.config.release.targetBranch!);
    }
    logger.debug(`  Found ${repositoryFiles.length} file(s) in repository`);

    // Process each manifest in the config
    for (const manifest of this.config.manifests) {
      const processor = createPackageManifest(manifest, this.config.provider);
      if (!processor) {
        logger.warn(`Unknown manifest type '${manifest.type}' for path '${manifest.path}' — skipping`);
        continue;
      }
      const processedManifest = processor.process(this.commits);
      if (this.config.updateAllVersions || this.hasCommitsForManifest(this.commits, manifest.path)) {
        const manifestNextVersion = this.config.versioner.calculateNextVersion(
          this.commits, manifest.currentVersion, this.config.release.prerelease || false, this.config.release.includeChores ?? false, processedManifest.versionPrefix ?? '', processedManifest.identifier, processedManifest.identifierBase,
        );
        results.nextManifestVersions.push(manifestNextVersion.toString());
        await this.generateFileOperations(processedManifest, repositoryFiles, manifestNextVersion.toString(), results.files);
      } else {
        results.nextManifestVersions.push(manifest.currentVersion);
      }
    }

    const configUpdate = await this.updateArpConfig(results.nextVersion, results.nextManifestVersions);
    if (configUpdate) {
      results.files.push(configUpdate);
    }

    return results;
  }

  /**
   * Generate file operations for a processed manifest.
   * Glob-matches repositoryFiles against each ManifestFile pattern, loads content,
   * applies version replacement, and pushes results into the provided files array
   * (updating an existing entry for the same path if one is already present).
   */
  async generateFileOperations(
    processedManifest: ProcessedManifest,
    repositoryFiles: string[],
    nextVersion: string,
    files: FileOperation[],
  ): Promise<void> {
    logger.info(`   Generating file operations for manifest: ${processedManifest.path || '(root)'} → ${nextVersion}`);

    for (const manifestFile of processedManifest.fileOperations) {
      const matchedFiles = repositoryFiles.filter(f => minimatch(f, manifestFile.path));
      logger.debug(`      Pattern '${manifestFile.path}' matched ${matchedFiles.length} file(s)`);

      for (const filePath of matchedFiles) {
        const content = await this.getFileContent(filePath);

        if (content === null) {
          // Note for documentation: In a typical use case, files that match glob patterns should already exist in the repository, so this block is primarily for handling explicitly configured literal paths that don't exist yet. For glob patterns, it's expected that at least one file will match and be read successfully; if not, a warning is logged and the pattern is skipped. Only when a literal path is configured and doesn't exist do we create new content based on the version.
          if (!/[*?[{]/.test(manifestFile.path)) {
            // Literal path — file doesn't exist yet; apply version to empty content
            const created = this.applyVersion(manifestFile.filetype, '', manifestFile.versionPatterns, nextVersion);
            const fileContent = created ?? nextVersion;
            const existing = files.find(f => f.path === filePath);
            if (existing) {
              existing.content = fileContent;
            } else {
              files.push({ path: filePath, content: fileContent, status: 'created' });
            }
            logger.info(`      Created '${filePath}'`);
          } else {
            logger.warn(`      Could not read '${filePath}' — skipping`);
          }
          continue;
        }

        const updated = this.applyVersion(manifestFile.filetype, content, manifestFile.versionPatterns, nextVersion);
        if (updated === null) {
          logger.warn(`      No version pattern matched in '${filePath}' — skipping`);
          continue;
        }

        const existing = files.find(f => f.path === filePath);
        if (existing) {
          existing.content = updated;
        } else {
          files.push({ path: filePath, content: updated, status: 'updated' });
        }
        logger.info(`      Updated version in '${filePath}'`);
      }
    }
  }

  private applyVersion(filetype: ManifestFileType, content: string, patterns: string[], newVersion: string): string | null {
    switch (filetype) {
      case 'yaml': return this.applyVersionYaml(content, patterns, newVersion);
      case 'json': return this.applyVersionJson(content, patterns, newVersion);
      case 'xml':
      case 'text':
      default: return this.applyVersionText(content, patterns, newVersion);
    }
  }

  /**
   * Replace capture group 1 in each regex pattern with newVersion.
   * Only replaces the first match per pattern (no `g` flag) to avoid
   * clobbering dependency version entries (e.g. in pom.xml).
   */
  private applyVersionText(content: string, patterns: string[], newVersion: string): string {
    let result = content;
    for (const pattern of patterns) {
      const re = new RegExp(pattern);
      result = result.replace(re, (match, group1) => {
        if (group1 === undefined) {
          // Pattern has no capture group — replace entire match
          return newVersion;
        }
        return match.replace(group1, newVersion);
      });
    }
    return result;
  }

  /**
   * Update YAML dot-notation key paths (e.g. 'version', 'image.tag').
   * Uses the `yaml` package to preserve comments and formatting.
   */
  private applyVersionYaml(content: string, patterns: string[], newVersion: string): string {
    const doc = parseDocument(content);
    for (const pattern of patterns) {
      const keys = pattern.split('.');
      doc.setIn(keys, newVersion);
    }
    return doc.toString();
  }

  /**
   * Update JSON dot-notation key paths (e.g. 'version', 'project.version').
   */
  private applyVersionJson(content: string, patterns: string[], newVersion: string): string {
    const obj = JSON.parse(content) as Record<string, unknown>;
    for (const pattern of patterns) {
      const keys = pattern.split('.');
      let node: Record<string, unknown> = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        const child = node[keys[i]];
        if (child == null || typeof child !== 'object') break;
        node = child as Record<string, unknown>;
      }
      node[keys[keys.length - 1]] = newVersion;
    }
    return JSON.stringify(obj, null, 2);
  }

  private hasCommitsForManifest(commits: Commit[], manifestPath: string): boolean {
    const normalizedManifestPath = normalizePath(manifestPath);
    return commits.some(commit =>
      commit.files.some(file => isFileInManifestPath(normalizePath(file), normalizedManifestPath))
    );
  }

  private scanLocalFiles(): string[] {
    const cwd = process.cwd();
    const entries = readdirSync(cwd, { recursive: true, encoding: 'utf-8' }) as string[];
    return entries
      .filter(entry => {
        try {
          return statSync(join(cwd, entry)).isFile();
        } catch {
          return false;
        }
      })
      .map(entry => entry.replace(/\\/g, '/'));
  }

  private readLocalFile(filePath: string): string | null {
    try {
      return readFileSync(join(process.cwd(), filePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private async updateArpConfig(nextVersion: string, nextManifestVersions: string[]): Promise<FileOperation | null> {
    const raw = await this.getFileContent('.arp.config.json');
    if (raw === null) {
      logger.info('  No .arp.config.json found — skipping version update.');
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Always update the top-level version
    parsed.version = nextVersion;
    if (Array.isArray(parsed.manifests) && parsed.manifests.length > 0) {
      // Multi-manifest: update each manifest's version by index
      for (let i = 0; i < parsed.manifests.length && i < nextManifestVersions.length; i++) {
        (parsed.manifests[i] as Record<string, unknown>).version = nextManifestVersions[i];
      }
    }

    return { path: '.arp.config.json', content: JSON.stringify(parsed, null, 2) + '\n', status: 'updated' };
  }

  async getFileContent(path: string): Promise<string | null> {
    if (this.config.useFileSystem !== false) {
      return this.readLocalFile(path);
    }
    try {
      return await this.config.provider.getFileContents(path, this.config.release.targetBranch!);
    } catch {
      return null;
    }
  }

  /**
   * Generate or update the CHANGELOG.md file
   * @param commits - Array of commits to include in the changelog
   * @param newVersion - The new version number for this release
   * @returns The generated changelog section and the CHANGELOG.md file operation
   */
  async generateChangelog(commits: Commit[], newVersion: string): Promise<{ section: string; fileOperation: FileOperation }> {
    const repoInfo = await this.config.provider.getRepository();
    const commitPath = this.config.provider.name === 'gitlab' ? '/-/commit' : '/commit';

    // Determine the effective issue URL template and whether it was user-supplied
    const issueUrlIsCustom = !!this.config.issueUrlTemplate;
    let issueUrlTemplate: string | undefined;
    if (issueUrlIsCustom) {
      issueUrlTemplate = this.config.issueUrlTemplate!;
    } else if (repoInfo.webUrl) {
      const issuePath = this.config.provider.name === 'gitlab' ? '/-/issues/{id}' : '/issues/{id}';
      issueUrlTemplate = `${repoInfo.webUrl}${issuePath}`;
    }

    const writer = new HandlebarsChangelogWriter();
    const section = await writer.generate(commits, newVersion, new Date(), {
      repoUrl: repoInfo.webUrl ?? undefined,
      commitPath,
      issueUrlTemplate,
      issueUrlIsCustom,
    });

    const trimmedSection = section.trimEnd();
    const existing = await this.getFileContent('CHANGELOG.md');
    const fileContent = existing ? `${trimmedSection}\n\n${existing}` : trimmedSection;

    return {
      section: trimmedSection,
      fileOperation: { path: 'CHANGELOG.md', content: fileContent, status: existing ? 'updated' : 'created' },
    };
  }
}

