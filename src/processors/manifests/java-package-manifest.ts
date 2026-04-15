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
        // Two capture groups: group1 is the prefix up to and including the opening <version> tag,
        // group2 is the closing </version> tag. The version value sits between the two groups and
        // is replaced directly, so the replacement is unambiguous even when the parent block
        // contains a <version> element with an identical value.
        //
        // The alternation handles both valid orderings of the project-level <version> element:
        //   Branch 1: <version> appears before <parent> (or there is no <parent> block).
        //             Stops advancing as soon as <parent is encountered, so only the
        //             project-level version — not the parent version — is matched.
        //   Branch 2: <version> appears after <parent>.
        //             Skips over the entire <parent>…</parent> block, then matches the
        //             first <version> element that follows.
        versionPatterns: ['(<project\\b[^>]*>(?:(?!<parent\\b)[\\s\\S])*?<version>|<project\\b[^>]*>(?:[\\s\\S]*?<parent\\b[^>]*>[\\s\\S]*?</parent>)[\\s\\S]*?<version>)[^<]+(</version>)'],
      },
    ];
  }
}
