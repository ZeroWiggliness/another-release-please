import { CustomPackageManifest } from '../../src/processors/manifests/custom-package-manifest';
import type { Manifest, ManifestFile } from '../../src/types/manifest';
import * as logger from '../../src/logger';

jest.mock('../../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fakeProvider = {} as any;

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return { type: 'custom', path: 'packages/my-pkg', currentVersion: '1.2.3', versionPrefix: 'v', ...overrides };
}

describe('CustomPackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns configured files when files are present', () => {
    const files: ManifestFile[] = [
      { path: 'packages/my-pkg/package.json', filetype: 'json', versionPatterns: ['"version":\\s*"(.+)"'] },
    ];
    const manifest = makeManifest({ files });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toEqual(files);
  });

  test('returns empty fileOperations when no files configured', () => {
    const manifest = makeManifest({ files: undefined });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toEqual([]);
  });

  test('warns when no files configured', () => {
    const manifest = makeManifest({ files: undefined });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('has no files configured'));
  });

  test('does not warn when files are configured', () => {
    const files: ManifestFile[] = [
      { path: 'packages/my-pkg/package.json', filetype: 'json', versionPatterns: ['"version":\\s*"(.+)"'] },
    ];
    const manifest = makeManifest({ files });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('logs info with manifest path, type and version', () => {
    const manifest = makeManifest({ files: [] });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('packages/my-pkg'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('custom'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1.2.3'));
  });

  test('logs (root) when manifest path is empty', () => {
    const manifest = makeManifest({ path: '' });
    const processor = new CustomPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('(root)'));
  });
});
