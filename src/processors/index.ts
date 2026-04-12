/**
 * Processors module exports
 */

// Export types and base classes
export type { FileOperation, FileOperationStatus, ManifestProcessResult } from './types.js';
export { PackageManifest, ProcessedManifest } from './types.js';

// Export factory
export { registerManifestType, createPackageManifest } from './package-manifest-factory.js';

// Export processor implementations
export { ManifestProcessor } from './manifest-processor.js';
export { SimplePackageManifest } from './manifests/simple-package-manifest.js';
export { JavaPackageManifest } from './manifests/java-package-manifest.js';
export { HelmPackageManifest } from './manifests/helm-package-manifest.js';
export { CustomPackageManifest } from './manifests/custom-package-manifest.js';
export { CSharpPackageManifest } from './manifests/csharp-package-manifest.js';
export { NodePackageManifest } from './manifests/node-package-manifest.js';


