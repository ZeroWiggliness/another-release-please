import { registerManifestType, createPackageManifest } from '../../src/processors/package-manifest-factory';
import { PackageManifest, ProcessedManifest } from '../../src/processors/types';
import type { Manifest } from '../../src/types/manifest';

// Minimal fake provider for testing - cast to any to avoid implementing full interface
const fakeProvider = { name: 'fake-provider' } as unknown as any;

class TestManifest extends PackageManifest {
  public getProviderName(): string {
    return this.provider.name;
  }

  process(): ProcessedManifest {
    return new ProcessedManifest(this.manifest.path, this.manifest.currentVersion, [], this.manifest.versionPrefix);
  }
}

describe('package manifest factory', () => {
  afterEach(() => {
    // Clean up any registrations by re-registering a no-op for 'test' type
    registerManifestType('test', TestManifest as any);
  });

  test('passes provider to manifest constructors', () => {
    const manifest: Manifest = { type: 'test', path: '.', currentVersion: '1.0.0', versionPrefix: 'v' };

    // Register test manifest type
    registerManifestType('test', TestManifest as any);

    const instance = createPackageManifest(manifest, fakeProvider) as TestManifest;

    expect(instance.getProviderName()).toBe('fake-provider');
  });

  test('returns null for unregistered manifest type', () => {
    const manifest: Manifest = { type: 'unregistered-type', path: '.', currentVersion: '1.0.0', versionPrefix: 'v' };

    const result = createPackageManifest(manifest, fakeProvider);

    expect(result).toBeNull();
  });
});
