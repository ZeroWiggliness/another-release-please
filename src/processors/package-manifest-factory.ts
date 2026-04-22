/**
 * Package manifest factory with registry pattern
 */

import type { Manifest } from '../types/manifest.js';
import type { GitProvider } from '../providers/git-provider.js';
import { PackageManifest } from './types.js';
import { SimplePackageManifest } from './manifests/simple-package-manifest.js';
import { NodePackageManifest } from './manifests/node-package-manifest.js';
import { JavaPackageManifest } from './manifests/java-package-manifest.js';
import { CSharpPackageManifest } from './manifests/csharp-package-manifest.js';
import { HelmPackageManifest } from './manifests/helm-package-manifest.js';
import { CustomPackageManifest } from './manifests/custom-package-manifest.js';
import { GradlePackageManifest } from './manifests/gradle-package-manifest.js';

/**
 * Type for package manifest constructor
 */
type PackageManifestConstructor = new (...args: any[]) => PackageManifest;

/**
 * Registry of package manifest types
 */
const manifestRegistry = new Map<string, PackageManifestConstructor>();

/**
 * Register a package manifest type
 * @param type - The manifest type (e.g., 'simple')
 * @param constructor - The constructor for the manifest processor
 */
export function registerManifestType(
  type: string,
  constructor: PackageManifestConstructor
): void {
  manifestRegistry.set(type, constructor);
}

/**
 * Create a package manifest processor based on type
 * @param manifest - The versioning strategy configuration
 * @returns Instance of the appropriate package manifest processor, or null if the type is not registered
 */
export function createPackageManifest(manifest: Manifest, provider: GitProvider): PackageManifest | null {
  const Constructor = manifestRegistry.get(manifest.type);

  if (!Constructor) {
    return null;
  }

  return new Constructor(manifest, provider);
}

// Register all built-in manifest types
registerManifestType('simple', SimplePackageManifest);
registerManifestType('node', NodePackageManifest);
registerManifestType('java', JavaPackageManifest);
registerManifestType('csharp', CSharpPackageManifest);
registerManifestType('helm', HelmPackageManifest);
registerManifestType('custom', CustomPackageManifest);
registerManifestType('gradle', GradlePackageManifest);
