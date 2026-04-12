/**
 * Java package manifest processor
 * Handles versioning for Java/Maven projects
 */

import type { Commit } from '../../types/provider.js';
import type { ManifestFile } from '../../types/manifest.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import { normalizePath } from '../../helpers/index.js';
import * as logger from '../../logger.js';

/**
 * Java package manifest processor
 * Default target file: pom.xml under the manifest path
 */
export class JavaPackageManifest extends PackageManifest {
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);
    if (this.manifest.files && this.manifest.files.length > 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' has explicitly configured files, but they will be ignored for type '${this.manifest.type}'. Default file patterns are used instead.`);
    }
    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, this.defaultFiles(), this.manifest.versionPrefix ?? "", this.manifest.identifier ?? 'SNAPSHOT', this.manifest.identifierBase);
  }

  private defaultFiles(): ManifestFile[] {
    const dir = normalizePath(this.manifest.path);
    const pomPath = dir ? `${dir}/**/pom.xml` : '**/pom.xml';
    return [
      {
        path: pomPath,
        filetype: 'xml',
        versionPatterns: ['<project\\b[^>]*>(?:[\\s\\S]*?<parent\\b[^>]*>[\\s\\S]*?</parent>)?[\\s\\S]*?<version>([^<]+)</version>'],
      },
    ];
  }
}
