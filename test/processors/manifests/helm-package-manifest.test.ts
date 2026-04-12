import { HelmPackageManifest } from '../../../src/processors/manifests/helm-package-manifest';
import type { Manifest } from '../../../src/types/manifest';
import * as logger from '../../../src/logger';

jest.mock('../../../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fakeProvider = {} as any;

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    type: 'helm',
    path: 'charts/my-chart',
    currentVersion: '1.0.0',
    versionPrefix: 'v',
    ...overrides,
  };
}

describe('HelmPackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('process()', () => {
    test('returns Chart.yaml file under manifest path', () => {
      const manifest = makeManifest();
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.fileOperations).toEqual([
        { path: 'charts/my-chart/**/Chart.yaml', filetype: 'yaml', versionPatterns: ['version'] },
      ]);
    });

    test('returns root Chart.yaml when path is empty', () => {
      const manifest = makeManifest({ path: '' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.fileOperations).toEqual([
        { path: '**/Chart.yaml', filetype: 'yaml', versionPatterns: ['version'] },
      ]);
    });

    test('returns root Chart.yaml when path is dot', () => {
      const manifest = makeManifest({ path: '.' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.fileOperations).toEqual([
        { path: '**/Chart.yaml', filetype: 'yaml', versionPatterns: ['version'] },
      ]);
    });

    test('forwards currentVersion to ProcessedManifest', () => {
      const manifest = makeManifest({ currentVersion: '3.2.1' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.currentVersion).toBe('3.2.1');
    });

    test('forwards manifest path to ProcessedManifest', () => {
      const manifest = makeManifest({ path: 'infra/charts' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.path).toBe('infra/charts');
    });

    test('warns if manifest.files is present and ignores them', () => {
      const manifest = makeManifest({
        files: [{ path: 'custom.yaml', filetype: 'yaml', versionPatterns: ['version'] }],
      });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
      // Still uses the default Chart.yaml path, not the custom file
      expect(result.fileOperations[0].path).toContain('Chart.yaml');
    });

    test('logs info with manifest path on process', () => {
      const manifest = makeManifest({ path: 'helm/app' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      processor.process([]);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('helm/app'));
    });

    test('uses manifest versionPrefix in ProcessedManifest', () => {
      const manifest = makeManifest({ versionPrefix: '' });
      const processor = new HelmPackageManifest(manifest, fakeProvider);

      const result = processor.process([]);

      expect(result.versionPrefix).toBe('');
    });
  });
});
