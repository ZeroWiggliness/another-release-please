/**
 * Custom package manifest processor
 * Uses explicitly configured files from the manifest definition
 */

import type { Commit } from '../../types/provider.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import * as logger from '../../logger.js';

/**
 * Custom package manifest processor
 * Requires files to be explicitly configured in the manifest.
 * Warns if no files are configured.
 */
export class CustomPackageManifest extends PackageManifest {
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);

    if (!this.manifest.files || this.manifest.files.length === 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' of type '${this.manifest.type}' has no files configured. No file operations will be generated.`);
      return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, [], this.manifest.versionPrefix, this.manifest.identifier ?? 'prerelease', this.manifest.identifierBase);
    }

    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, this.manifest.files, this.manifest.versionPrefix, this.manifest.identifier ?? 'prerelease', this.manifest.identifierBase);
  }
}
