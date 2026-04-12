import { SimplePackageManifest } from '../../src/processors/manifests/simple-package-manifest';
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
    type: 'simple',
    path: 'packages/my-pkg',
    currentVersion: '1.2.3',
    versionPrefix: 'v',
    ...overrides,
  };
}

describe('SimplePackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('process returns version.txt in manifest path', () => {
    const manifest = makeManifest({ files: undefined });
    const processor = new SimplePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toEqual([
      { path: 'packages/my-pkg/version.txt', filetype: 'text', versionPatterns: ['(.*)'] },
    ]);
  });

  test('process returns root version.txt when path is empty', () => {
    const manifest = makeManifest({ path: '' });
    const processor = new SimplePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toEqual([
      { path: 'version.txt', filetype: 'text', versionPatterns: ['(.*)'] },
    ]);
  });

  test('warns if manifest.files is present', () => {
    const manifest = makeManifest({ files: [{ path: 'foo.txt', filetype: 'text', versionPatterns: ['(.+)'] }] });
    const processor = new SimplePackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
  });

  test('forwards manifest versionPrefix to ProcessedManifest', () => {
    const manifest = makeManifest({ versionPrefix: 'app-' });
    const processor = new SimplePackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.versionPrefix).toBe('app-');
  });
});
