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
        // is replaced directly, so the replacement is unambiguous even when nested blocks
        // contain <version> elements with identical values.
        //
        // Starting from <project>, the pattern skips over any combination of known container
        // blocks that can themselves contain <version> elements (parent, dependencies,
        // dependencyManagement, build, reporting, profiles, distributionManagement,
        // repositories, pluginRepositories, modules) and advances past all other content
        // one character at a time until it reaches the first <version> that is a direct
        // child of <project>. This covers every valid ordering of the project-level
        // <version> element relative to these blocks.
        versionPatterns: ['(<project\\b[^>]*>(?:<parent\\b[^>]*>[\\s\\S]*?</parent>|<dependencies\\b[^>]*>[\\s\\S]*?</dependencies>|<dependencyManagement\\b[^>]*>[\\s\\S]*?</dependencyManagement>|<build\\b[^>]*>[\\s\\S]*?</build>|<reporting\\b[^>]*>[\\s\\S]*?</reporting>|<profiles\\b[^>]*>[\\s\\S]*?</profiles>|<distributionManagement\\b[^>]*>[\\s\\S]*?</distributionManagement>|<repositories\\b[^>]*>[\\s\\S]*?</repositories>|<pluginRepositories\\b[^>]*>[\\s\\S]*?</pluginRepositories>|<modules\\b[^>]*>[\\s\\S]*?</modules>|(?!<version\\b)[\\s\\S])*<version>)[^<]+(</version>)'],
      },
    ];
  }
}
