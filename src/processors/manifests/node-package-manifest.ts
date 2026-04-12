/**
 * Node package manifest processor
 * Handles versioning for Node.js projects by updating package.json
 */

import type { Commit } from '../../types/provider.js';
import type { ManifestFile } from '../../types/manifest.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import { normalizePath } from '../../helpers/index.js';
import * as logger from '../../logger.js';

/**
 * Node package manifest processor
 * Default target file: package.json under the manifest path
 */
export class NodePackageManifest extends PackageManifest {
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);
    if (this.manifest.files && this.manifest.files.length > 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' has explicitly configured files, but they will be ignored for type '${this.manifest.type}'. Default file patterns are used instead.`);
    }
    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, this.defaultFiles(), this.manifest.versionPrefix ?? '', this.manifest.identifier ?? 'prerelease', this.manifest.identifierBase);
  }

  private defaultFiles(): ManifestFile[] {
    const dir = normalizePath(this.manifest.path);
    const packageJsonPath = dir ? `${dir}/package.json` : 'package.json';
    return [
      {
        path: packageJsonPath,
        filetype: 'text',
        versionPatterns: ['"version":\\s*"([^"]+)"'],
      },
    ];
  }
}
