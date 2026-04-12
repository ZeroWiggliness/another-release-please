import { NodePackageManifest } from '../../src/processors/manifests/node-package-manifest';
import type { Manifest } from '../../src/types/manifest';
import * as logger from '../../src/logger';

jest.mock('../../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fakeProvider = {} as any;

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    type: 'node',
    path: 'packages/my-pkg',
    currentVersion: '1.2.3',
    ...overrides,
  };
}

describe('NodePackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('process returns package.json under manifest path', () => {
    const manifest = makeManifest();
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toHaveLength(1);
    expect(result.fileOperations[0].path).toBe('packages/my-pkg/package.json');
    expect(result.fileOperations[0].filetype).toBe('text');
  });

  test('process returns root package.json when path is empty', () => {
    const manifest = makeManifest({ path: '' });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations[0].path).toBe('package.json');
  });

  test('process uses version key pattern', () => {
    const manifest = makeManifest();
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations[0].versionPatterns).toEqual(['"version":\\s*"([^"]+)"']);
  });

  test('process passes through currentVersion', () => {
    const manifest = makeManifest({ currentVersion: '2.0.0' });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.currentVersion).toBe('2.0.0');
  });

  test('process forwards explicit versionPrefix to ProcessedManifest', () => {
    const manifest = makeManifest({ versionPrefix: 'v' });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.versionPrefix).toBe('v');
  });

  test('process defaults versionPrefix to empty string when not set', () => {
    const manifest = makeManifest({ versionPrefix: undefined });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.versionPrefix).toBe('');
  });

  test('warns if manifest.files is present', () => {
    const manifest = makeManifest({ files: [{ path: 'package.json', filetype: 'json', versionPatterns: ['version'] }] });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
  });

  test('version pattern matches and replaces version in package.json', () => {
    const manifest = makeManifest();
    const processor = new NodePackageManifest(manifest, fakeProvider);
    const result = processor.process([]);

    const pattern = result.fileOperations[0].versionPatterns[0];
    const content = `{\n  "name": "my-pkg",\n  "version": "1.2.3",\n  "description": "test"\n}`;

    // Simulate how applyVersionText works
    const re = new RegExp(pattern);
    const updated = content.replace(re, (match, group1) => match.replace(group1, '2.0.0'));

    expect(updated).toContain('"version": "2.0.0"');
    expect(updated).toContain('"name": "my-pkg"');
  });

  test('process defaults identifier to prerelease when not set', () => {
    const manifest = makeManifest({ identifier: undefined });
    const processor = new NodePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.identifier).toBe('prerelease');
  });
});
