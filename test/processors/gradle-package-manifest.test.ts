import { GradlePackageManifest } from '../../src/processors/manifests/gradle-package-manifest';
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
    type: 'gradle',
    path: 'services/myapp',
    currentVersion: '1.2.3',
    ...overrides,
  };
}

describe('GradlePackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('file paths', () => {
    test('returns gradle.properties under manifest path', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      const propsFile = result.fileOperations.find(f => f.path.endsWith('gradle.properties'));
      expect(propsFile?.path).toBe('services/myapp/gradle.properties');
    });

    test('returns build.gradle glob under manifest path', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      const buildFile = result.fileOperations.find(f => f.path.endsWith('build.gradle'));
      expect(buildFile?.path).toBe('services/myapp/**/build.gradle');
    });

    test('returns build.gradle.kts glob under manifest path', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      const ktsFile = result.fileOperations.find(f => f.path.endsWith('build.gradle.kts'));
      expect(ktsFile?.path).toBe('services/myapp/**/build.gradle.kts');
    });

    test('returns root-relative paths when manifest path is empty', () => {
      const processor = new GradlePackageManifest(makeManifest({ path: '' }), fakeProvider);
      const result = processor.process([]);

      expect(result.fileOperations[0].path).toBe('gradle.properties');
      expect(result.fileOperations[1].path).toBe('**/build.gradle');
      expect(result.fileOperations[2].path).toBe('**/build.gradle.kts');
    });

    test('normalizes dot path to root-relative paths', () => {
      const processor = new GradlePackageManifest(makeManifest({ path: '.' }), fakeProvider);
      const result = processor.process([]);

      expect(result.fileOperations[0].path).toBe('gradle.properties');
    });

    test('returns exactly 3 file operations', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      expect(result.fileOperations).toHaveLength(3);
    });

    test('all file operations use text filetype', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      for (const op of result.fileOperations) {
        expect(op.filetype).toBe('text');
      }
    });
  });

  describe('defaults', () => {
    test('default identifier is SNAPSHOT', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      expect(result.identifier).toBe('SNAPSHOT');
    });

    test('default versionPrefix is empty string', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      const result = processor.process([]);

      expect(result.versionPrefix).toBe('');
    });

    test('passes through custom identifier', () => {
      const processor = new GradlePackageManifest(makeManifest({ identifier: 'RC' }), fakeProvider);
      const result = processor.process([]);

      expect(result.identifier).toBe('RC');
    });

    test('passes through custom versionPrefix', () => {
      const processor = new GradlePackageManifest(makeManifest({ versionPrefix: 'v' }), fakeProvider);
      const result = processor.process([]);

      expect(result.versionPrefix).toBe('v');
    });

    test('passes through currentVersion', () => {
      const processor = new GradlePackageManifest(makeManifest({ currentVersion: '3.0.0' }), fakeProvider);
      const result = processor.process([]);

      expect(result.currentVersion).toBe('3.0.0');
    });

    test('passes through identifierBase', () => {
      const processor = new GradlePackageManifest(makeManifest({ identifierBase: '1' }), fakeProvider);
      const result = processor.process([]);

      expect(result.identifierBase).toBe('1');
    });
  });

  describe('warnings', () => {
    test('warns when manifest.files is present', () => {
      const manifest = makeManifest({
        files: [{ path: 'gradle.properties', filetype: 'text', versionPatterns: ['version=(.+)'] }],
      });
      const processor = new GradlePackageManifest(manifest, fakeProvider);

      processor.process([]);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
    });

    test('does not warn when manifest.files is absent', () => {
      const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
      processor.process([]);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('version patterns', () => {
    /** Mimics the single-capture-group replacement used by manifest-processor */
    function applyPattern(pattern: string, content: string, newVersion: string): string {
      const re = new RegExp(pattern);
      return content.replace(re, (match, group1) => {
        if (group1 === undefined) return newVersion;
        return match.replace(group1, newVersion);
      });
    }

    describe('gradle.properties pattern', () => {
      let propsPattern: string;

      beforeEach(() => {
        const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
        const result = processor.process([]);
        propsPattern = result.fileOperations[0].versionPatterns[0];
      });

      test('matches version=1.0.0-SNAPSHOT (no spaces)', () => {
        const content = 'group=com.example\nversion=1.0.0-SNAPSHOT\nname=myapp\n';
        const updated = applyPattern(propsPattern, content, '2.0.0');
        expect(updated).toContain('version=2.0.0');
        expect(updated).not.toContain('1.0.0');
      });

      test('matches version = 1.0.0 (spaces around equals)', () => {
        const content = 'version = 1.0.0\n';
        const updated = applyPattern(propsPattern, content, '2.0.0');
        expect(updated).toContain('2.0.0');
        expect(updated).not.toContain('1.0.0');
      });

      test('does not match springVersion=1.0.0 (not at line start)', () => {
        const content = 'springVersion=1.0.0\n';
        const re = new RegExp(propsPattern);
        expect(re.test(content)).toBe(false);
      });

      test('does not match myapp.version=1.0.0 (not at line start)', () => {
        const content = 'myapp.version=1.0.0\n';
        const re = new RegExp(propsPattern);
        expect(re.test(content)).toBe(false);
      });

      test('leaves other properties untouched', () => {
        const content = 'group=com.example\nversion=1.2.3\narchivesName=myapp\n';
        const updated = applyPattern(propsPattern, content, '9.9.9');
        expect(updated).toContain('group=com.example');
        expect(updated).toContain('archivesName=myapp');
      });
    });

    describe('build.gradle pattern (Groovy DSL)', () => {
      let buildPattern: string;

      beforeEach(() => {
        const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
        const result = processor.process([]);
        buildPattern = result.fileOperations[1].versionPatterns[0];
      });

      test("matches version = '1.0.0-SNAPSHOT'", () => {
        const content = "plugins { id 'java' }\nversion = '1.0.0-SNAPSHOT'\ngroup = 'com.example'\n";
        const updated = applyPattern(buildPattern, content, '2.0.0');
        expect(updated).toContain("version = '2.0.0'");
        expect(updated).not.toContain('1.0.0');
      });

      test("does not match springVersion = '1.0.0' (word boundary)", () => {
        const content = "ext.springVersion = '1.0.0'\n";
        const re = new RegExp(buildPattern);
        expect(re.test(content)).toBe(false);
      });

      test("leaves other string properties untouched", () => {
        const content = "version = '1.2.3'\ngroup = 'com.example'\n";
        const updated = applyPattern(buildPattern, content, '9.9.9');
        expect(updated).toContain("group = 'com.example'");
      });
    });

    describe('build.gradle.kts pattern (Kotlin DSL)', () => {
      let ktsPattern: string;

      beforeEach(() => {
        const processor = new GradlePackageManifest(makeManifest(), fakeProvider);
        const result = processor.process([]);
        ktsPattern = result.fileOperations[2].versionPatterns[0];
      });

      test('matches version = "1.0.0-SNAPSHOT"', () => {
        const content = 'plugins { java }\nversion = "1.0.0-SNAPSHOT"\ngroup = "com.example"\n';
        const updated = applyPattern(ktsPattern, content, '2.0.0');
        expect(updated).toContain('version = "2.0.0"');
        expect(updated).not.toContain('1.0.0');
      });

      test('does not match springVersion = "1.0.0" (word boundary)', () => {
        const content = 'val springVersion = "1.0.0"\n';
        const re = new RegExp(ktsPattern);
        expect(re.test(content)).toBe(false);
      });

      test('leaves other string properties untouched', () => {
        const content = 'version = "1.2.3"\ngroup = "com.example"\n';
        const updated = applyPattern(ktsPattern, content, '9.9.9');
        expect(updated).toContain('group = "com.example"');
      });
    });
  });
});
