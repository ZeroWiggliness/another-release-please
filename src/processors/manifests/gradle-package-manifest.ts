/**
 * Gradle package manifest processor
 * Handles versioning for Gradle projects (Groovy and Kotlin DSL)
 */

import type { Commit } from '../../types/provider.js';
import type { ManifestFile } from '../../types/manifest.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import { normalizePath } from '../../helpers/index.js';
import * as logger from '../../logger.js';

/**
 * Gradle package manifest processor.
 * Default target files:
 *   - gradle.properties        — `version=1.0.0`
 *   - ** /build.gradle          — `version = '1.0.0'`  (Groovy DSL)
 *   - ** /build.gradle.kts      — `version = "1.0.0"`  (Kotlin DSL)
 *
 * Gradle follows the Maven SNAPSHOT convention: pre-release builds append
 * `-SNAPSHOT` to the version string (e.g. `1.2.3-SNAPSHOT`). There is no
 * conventional version prefix such as "v".
 */
export class GradlePackageManifest extends PackageManifest {
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);
    if (this.manifest.files && this.manifest.files.length > 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' has explicitly configured files, but they will be ignored for type '${this.manifest.type}'. Default file patterns are used instead.`);
    }
    return new ProcessedManifest(
      this.manifest.path,
      this.manifest.currentVersion,
      this.defaultFiles(),
      this.manifest.versionPrefix ?? '',
      this.manifest.identifier ?? 'SNAPSHOT',
      this.manifest.identifierBase,
    );
  }

  private defaultFiles(): ManifestFile[] {
    const dir = normalizePath(this.manifest.path);

    // gradle.properties lives at the root of the project (not recursively nested)
    const propsPath = dir ? `${dir}/gradle.properties` : 'gradle.properties';
    // build.gradle and build.gradle.kts may appear in subprojects of a multi-project build
    const buildGradlePath = dir ? `${dir}/**/build.gradle` : '**/build.gradle';
    const buildGradleKtsPath = dir ? `${dir}/**/build.gradle.kts` : '**/build.gradle.kts';

    return [
      {
        path: propsPath,
        filetype: 'text',
        // Matches `version = 1.0.0` or `version=1.0.0` in a .properties file.
        // The negative lookbehind (?<![\w.]) ensures only a key whose name is
        // exactly `version` is matched: it prevents matching `springVersion=...`
        // (preceded by a word character) and dot-namespaced keys such as
        // `myapp.version=...` (preceded by a dot).
        // Capture group 1 is the version value.
        versionPatterns: ['(?<![\\w.])version\\s*=\\s*([^\\s\\n\\r]+)'],
      },
      {
        path: buildGradlePath,
        filetype: 'text',
        // Matches `version = '1.0.0'` in Groovy DSL (single-quoted string).
        // The word boundary prevents matching `springVersion = '...'`.
        // Capture group 1 is the version value.
        versionPatterns: ["\\bversion\\s*=\\s*'([^']+)'"],
      },
      {
        path: buildGradleKtsPath,
        filetype: 'text',
        // Matches `version = "1.0.0"` in Kotlin DSL (double-quoted string).
        // The word boundary prevents matching `springVersion = "..."`.
        // Capture group 1 is the version value.
        versionPatterns: ['\\bversion\\s*=\\s*"([^"]+)"'],
      },
    ];
  }
}
