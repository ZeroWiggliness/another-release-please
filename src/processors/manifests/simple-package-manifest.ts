/**
 * Simple package manifest processor
 * Handles basic versioning for single packages
 */

import type { Commit } from '../../types/provider.js';
import type { ManifestFile } from '../../types/manifest.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import { normalizePath } from '../../helpers/index.js';
import * as logger from '../../logger.js';

/**
 * Simple package manifest processor
 * Discovers files from commits that fall under the manifest path.
 * File operations are resolved by ManifestProcessor.generateFileOperations.
 */
export class SimplePackageManifest extends PackageManifest {
  /**
   * Process commits for this manifest
   * @returns ProcessedManifest with any explicitly configured files
   */
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);

    if (this.manifest.files && this.manifest.files.length > 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' has explicitly configured files, but they will be ignored for type '${this.manifest.type}'. Using version.txt as single canonical file.`);
    }

    const manifestBase = normalizePath(this.manifest.path);
    const versionPath = manifestBase ? `${manifestBase}/version.txt` : 'version.txt';

    const fileOperations: ManifestFile[] = [
      {
        path: versionPath,
        filetype: 'text',
        versionPatterns: ['(.*)'],
      },
    ];

    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, fileOperations, this.manifest.versionPrefix ?? '', this.manifest.identifier ?? 'prerelease', this.manifest.identifierBase);
  }

}
