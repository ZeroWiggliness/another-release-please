/**
 * C# package manifest processor
 * Handles versioning for .NET/C# projects
 */

import type { Commit } from '../../types/provider.js';
import type { ManifestFile } from '../../types/manifest.js';
import { PackageManifest, ProcessedManifest } from '../types.js';
import { normalizePath } from '../../helpers/index.js';
import * as logger from '../../logger.js';

/**
 * C# package manifest processor
 * Default target files: all *.csproj files under the manifest path.
 *
 * Matches the <Version> or <VersionPrefix> element inside a <PropertyGroup>,
 * which avoids touching version strings on <PackageReference> items.
 */
export class CSharpPackageManifest extends PackageManifest {
  process(_commits: Commit[]): ProcessedManifest {
    logger.info(`   Processing manifest: ${this.manifest.path || '(root)'} [${this.manifest.type}] ${this.manifest.currentVersion}`);
    if (this.manifest.files && this.manifest.files.length > 0) {
      logger.warn(`   Manifest '${this.manifest.path || '(root)'}' has explicitly configured files, but they will be ignored for type '${this.manifest.type}'. Default file patterns are used instead.`);
    }
    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, this.defaultFiles(), this.manifest.versionPrefix, this.manifest.identifier ?? 'alpha', this.manifest.identifierBase);
  }

  private defaultFiles(): ManifestFile[] {
    const dir = normalizePath(this.manifest.path);
    const csprojPath = dir ? `${dir}/**/*.csproj` : '**/*.csproj';
    return [
      {
        path: csprojPath,
        filetype: 'xml',
        // Match <Version> or <VersionPrefix> only when it appears inside a <PropertyGroup> block.
        // The negative lookahead (?!</PropertyGroup>) prevents the match from crossing the
        // closing tag, which would otherwise pick up <Version> elements on <PackageReference> items.
        versionPatterns: [
          // NOTE: Fullversion labels are passed around so VersionPrefix and VersionSuffix cannot be used.'
          '<PropertyGroup\\b[^>]*>(?:(?!<\\/PropertyGroup>)[\\s\\S])*?<Version>([^<]+)<\\/Version>'
        ],
      },
    ];
  }
}
