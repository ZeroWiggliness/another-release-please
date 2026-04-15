import { ManifestProcessor } from '../../src/processors/manifest-processor';
import type { AppConfig } from '../../src/config/config-types';
import type { Commit } from '../../src/types/provider';
import type { FileOperation } from '../../src/processors/types.js';

/** Build a minimal Commit object for testing */
function makeCommit(title: string, message?: string): Commit {
  return {
    sha: 'abc1234567890',
    tags: [],
    title,
    message: message ?? title,
    author: { name: 'Test', email: 'test@test.com' },
    date: new Date('2024-01-01T00:00:00Z'),
    files: [],
  };
}

/** Build a minimal AppConfig for testing with a mock provider */
function makeConfig(overrides: {
  providerName?: string;
  webUrl?: string;
  issueUrlTemplate?: string;
} = {}): AppConfig {
  const { providerName = 'gitlab', webUrl = 'https://gitlab.example.com/owner/repo', issueUrlTemplate } = overrides;

  const provider = {
    name: providerName,
    getRepository: jest.fn().mockResolvedValue({ fullPath: 'owner/repo', webUrl, defaultBranch: 'main' }),
    getFileContents: jest.fn().mockResolvedValue(null),
  } as any;

  const versioner = {
    calculateNextVersion: jest.fn().mockReturnValue({ toString: () => '1.0.0' }),
  } as any;

  return {
    provider,
    versioner,
    release: { prerelease: false },
    versionPrefix: 'v',
    manifests: [],
    dryRun: false,
    issueUrlTemplate,
    useFileSystem: false,
  } as any;
}

// ---------------------------------------------------------------------------
// ManifestProcessor.generateChangelog — integration tests
// ---------------------------------------------------------------------------

describe('ManifestProcessor.generateChangelog', () => {
  it('returns a section string containing the version heading', async () => {
    const commit = makeCommit('feat: add search');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.2.3');

    expect(section).toMatch(/^## v1\.2\.3/);
  });

  it('returns a fileOperation with path CHANGELOG.md and status "created" when no existing file', async () => {
    const commit = makeCommit('feat: add search');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { fileOperation } = await processor.generateChangelog([commit], 'v1.2.3');

    expect(fileOperation.path).toBe('CHANGELOG.md');
    expect(fileOperation.status).toBe('created');
  });

  it('prepends to existing CHANGELOG.md content and sets status "updated"', async () => {
    const commit = makeCommit('feat: new feature');
    const config = makeConfig();
    (config.provider.getFileContents as jest.Mock).mockResolvedValue('## v1.0.0\n\n* old entry');
    const processor = new ManifestProcessor([commit], config);
    const { fileOperation } = await processor.generateChangelog([commit], 'v1.1.0');

    expect(fileOperation.status).toBe('updated');
    expect(fileOperation.content).toMatch(/## v1\.1\.0/);
    expect(fileOperation.content).toContain('## v1.0.0');
    const v110Index = fileOperation.content.indexOf('## v1.1.0');
    const v100Index = fileOperation.content.indexOf('## v1.0.0');
    expect(v110Index).toBeLessThan(v100Index);
  });

  it('renders footer refs as markdown links (GitLab default)', async () => {
    const commit = makeCommit(
      'feat: add new search endpoint',
      'feat: add new search endpoint\n\nRefs: #42',
    );
    const config = makeConfig({ providerName: 'gitlab', webUrl: 'https://gitlab.example.com/owner/repo' });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[#42](https://gitlab.example.com/owner/repo/-/issues/42)');
  });

  it('renders footer refs as markdown links (GitHub default)', async () => {
    const commit = makeCommit(
      'fix: handle edge case',
      'fix: handle edge case\n\nFixes: #10',
    );
    const config = makeConfig({ providerName: 'github', webUrl: 'https://github.com/owner/repo' });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[#10](https://github.com/owner/repo/issues/10)');
  });

  it('renders a Jira custom template ref with bare ticket ID', async () => {
    const commit = makeCommit(
      'feat: add export functionality',
      'feat: add export functionality\n\nRefs: PROJ-123',
    );
    const config = makeConfig({
      providerName: 'gitlab',
      webUrl: 'https://gitlab.example.com/owner/repo',
      issueUrlTemplate: 'https://jira.example.com/browse/{id}',
    });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[PROJ-123](https://jira.example.com/browse/PROJ-123)');
    expect(section).not.toContain('[#PROJ-123]');
  });

  it('renders a Linear custom template ref with bare ticket ID', async () => {
    const commit = makeCommit(
      'feat: improve dashboard',
      'feat: improve dashboard\n\nCloses: ENG-456',
    );
    const config = makeConfig({ issueUrlTemplate: 'https://linear.app/team/issue/{id}' });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[ENG-456](https://linear.app/team/issue/ENG-456)');
  });

  it('produces no markdown link for commits with no refs and no inline issue refs', async () => {
    const commit = makeCommit('feat: simple feature with no refs');
    const config = makeConfig({ webUrl: '' });
    // No webUrl means no issueUrlTemplate is derived, so no links
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).not.toContain('](');
  });

  it('links inline #123 in commit subject when issueUrlTemplate is set', async () => {
    const commit = makeCommit('feat: fix #42 typo');
    const config = makeConfig({ providerName: 'gitlab', webUrl: 'https://gitlab.example.com/owner/repo' });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[#42](https://gitlab.example.com/owner/repo/-/issues/42)');
  });

  it('renders multiple refs from a single commit', async () => {
    const commit = makeCommit(
      'feat: improve performance',
      'feat: improve performance\n\nRefs: #7\nCloses: #8',
    );
    const config = makeConfig({ providerName: 'gitlab', webUrl: 'https://gitlab.example.com/owner/repo' });
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('[#7](https://gitlab.example.com/owner/repo/-/issues/7)');
    expect(section).toContain('[#8](https://gitlab.example.com/owner/repo/-/issues/8)');
  });

  it('feat commits appear under ### Features', async () => {
    const commit = makeCommit('feat: visible feature');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('### Features');
    expect(section).toContain('visible feature');
  });

  it('fix commits appear under ### Bug Fixes', async () => {
    const commit = makeCommit('fix: important fix');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('### Bug Fixes');
    expect(section).toContain('important fix');
  });

  it('breaking changes appear in a dedicated section before all others', async () => {
    const commit = makeCommit('feat!: remove legacy API');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v2.0.0');

    expect(section).toContain('⚠ BREAKING CHANGES');
    expect(section).toContain('remove legacy API');
    const breakingIndex = section.indexOf('⚠ BREAKING CHANGES');
    const featuresIndex = section.indexOf('### Features');
    expect(breakingIndex).toBeLessThan(featuresIndex);
  });

  it('scoped commits appear before unscoped commits within a section', async () => {
    const commits = [
      makeCommit('feat: unscoped feature'),
      makeCommit('feat(auth): scoped feature'),
    ];
    const config = makeConfig();
    const processor = new ManifestProcessor(commits, config);
    const { section } = await processor.generateChangelog(commits, 'v1.0.0');

    const scopedIndex = section.indexOf('scoped feature');
    const unscopedIndex = section.indexOf('unscoped feature');
    expect(scopedIndex).toBeLessThan(unscopedIndex);
  });

  it('scoped commits have a *(scope)* inline marker', async () => {
    const commit = makeCommit('feat(auth): login support');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('*(auth)*');
  });

  it('includes a date footer at the end', async () => {
    const commit = makeCommit('feat: something');
    const config = makeConfig();
    const processor = new ManifestProcessor([commit], config);
    const { section } = await processor.generateChangelog([commit], 'v1.0.0');

    expect(section).toContain('---');
    expect(section).toMatch(/_Generated on \d{4}-\d{2}-\d{2}_/);
  });
});

// ---------------------------------------------------------------------------
// ManifestProcessor.generateFileOperations
// ---------------------------------------------------------------------------

describe('ManifestProcessor.generateFileOperations', () => {
  /** Build a minimal AppConfig with a mock provider that returns given file contents */
  function makeConfigWithFiles(fileMap: Record<string, string>, useFileSystem = false): AppConfig {
    const provider = {
      name: 'gitlab',
      getRepository: jest.fn().mockResolvedValue({ fullPath: 'owner/repo', webUrl: 'https://gitlab.example.com/owner/repo', defaultBranch: 'main' }),
      getFileContents: jest.fn().mockImplementation(async (path: string) => fileMap[path] ?? null),
    } as any;

    const versioner = {
      calculateNextVersion: jest.fn().mockReturnValue({ toString: () => '1.0.0' }),
    } as any;

    return {
      provider,
      versioner,
      release: { prerelease: false },
      versionPrefix: 'v',
      manifests: [],
      dryRun: false,
      useFileSystem,
    } as any;
  }

  describe('text filetype', () => {
    it('replaces the captured group with the new version', async () => {
      const config = makeConfigWithFiles({ 'version.txt': '0.1.0\n' });
      const processor = new ManifestProcessor([], config);
      const processedManifest = new (await import('../../src/processors/types')).ProcessedManifest(
        '.',
        '0.1.0',
        [{ path: 'version.txt', filetype: 'text', versionPatterns: ['(.+)'] }],
        'v',
      );

      const files: FileOperation[] = [{ path: 'version.txt', content: '0.1.0\n', status: 'updated' }];
      await processor.generateFileOperations(processedManifest, ['version.txt'], '2.0.0', files);

      expect(files.find(f => f.path === 'version.txt')?.content).toBe('2.0.0\n');
    });

    it('strips versionPrefix from nextVersion before applying to file content', async () => {
      const content = '<a href="https://github.com/owner/repo/releases"><img src="https://img.shields.io/badge/version-0.1.0-blue"></a>\n';
      const config = makeConfigWithFiles({ 'README.md': content });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '0.1.0', [
        { path: 'README.md', filetype: 'text', versionPatterns: ['(https://img\\.shields\\.io/badge/version-)[^-]+(-blue)'] },
      ], 'v');

      const files: FileOperation[] = [{ path: 'README.md', content, status: 'updated' }];
      // nextVersion includes the "v" prefix — it must be stripped before inserting into the badge URL
      await processor.generateFileOperations(processedManifest, ['README.md'], 'v0.1.1', files);

      const updated = files.find(f => f.path === 'README.md')?.content ?? '';
      expect(updated).toContain('https://img.shields.io/badge/version-0.1.1-blue');
      expect(updated).not.toContain('version-v0.1.1-blue');
    });

    it('only replaces the first match per pattern (no global replacement)', async () => {
      const content = '<version>1.0.0</version>\n<dependency><version>1.0.0</version></dependency>\n';
      const config = makeConfigWithFiles({ 'pom.xml': content });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: 'pom.xml', filetype: 'xml', versionPatterns: ['<version>(.+)</version>'] },
      ], 'v');

      const files: FileOperation[] = [{ path: 'pom.xml', content, status: 'updated' }];
      await processor.generateFileOperations(processedManifest, ['pom.xml'], '2.0.0', files);

      const updated = files.find(f => f.path === 'pom.xml')?.content ?? '';
      // First occurrence is updated
      expect(updated).toContain('<version>2.0.0</version>');
      // Second (dependency) occurrence is NOT updated
      const firstPos = updated.indexOf('<version>2.0.0</version>');
      const secondPos = updated.indexOf('<version>2.0.0</version>', firstPos + 1);
      expect(secondPos).toBe(-1);
    });
  });

  describe('yaml filetype', () => {
    it('updates a top-level key using dot-notation', async () => {
      const content = 'name: my-chart\nversion: 0.1.0\nappVersion: 1.0.0\n';
      const config = makeConfigWithFiles({ 'Chart.yaml': content });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '0.1.0', [
        { path: 'Chart.yaml', filetype: 'yaml', versionPatterns: ['version'] },
      ], 'v');

      const files: FileOperation[] = [{ path: 'Chart.yaml', content, status: 'updated' }];
      await processor.generateFileOperations(processedManifest, ['Chart.yaml'], '1.2.3', files);

      const updated = files.find(f => f.path === 'Chart.yaml')?.content ?? '';
      expect(updated).toContain('version: 1.2.3');
      // Other fields preserved
      expect(updated).toContain('name: my-chart');
      expect(updated).toContain('appVersion: 1.0.0');
    });

    it('updates a nested key using dot-notation', async () => {
      const content = 'image:\n  tag: 0.1.0\n';
      const config = makeConfigWithFiles({ 'values.yaml': content });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '0.1.0', [
        { path: 'values.yaml', filetype: 'yaml', versionPatterns: ['image.tag'] },
      ], 'v');

      const files: FileOperation[] = [{ path: 'values.yaml', content, status: 'updated' }];
      await processor.generateFileOperations(processedManifest, ['values.yaml'], '1.2.3', files);

      expect(files.find(f => f.path === 'values.yaml')?.content).toContain('tag: 1.2.3');
    });
  });

  describe('glob pattern matching', () => {
    it('matches files using ** glob', async () => {
      const fileMap: Record<string, string> = {
        'services/api/pom.xml': '<version>1.0.0</version>\n',
        'services/web/pom.xml': '<version>1.0.0</version>\n',
        'README.md': 'readme',
      };
      const config = makeConfigWithFiles(fileMap);
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: '**/pom.xml', filetype: 'xml', versionPatterns: ['<version>(.+)</version>'] },
      ], 'v');

      const files: FileOperation[] = [
        { path: 'services/api/pom.xml', content: '<version>1.0.0</version>\n', status: 'updated' },
        { path: 'services/web/pom.xml', content: '<version>1.0.0</version>\n', status: 'updated' },
      ];
      await processor.generateFileOperations(
        processedManifest,
        Object.keys(fileMap),
        '2.0.0',
        files,
      );

      expect(files.some(f => f.path === 'services/api/pom.xml')).toBe(true);
      expect(files.some(f => f.path === 'services/web/pom.xml')).toBe(true);
      expect(files.some(f => f.path === 'README.md')).toBe(false);
      expect(files.find(f => f.path === 'services/api/pom.xml')?.content).toContain('<version>2.0.0</version>');
    });
  });

  describe('in-place update', () => {
    it('updates an existing entry when the same file is processed again', async () => {
      const original = '0.9.0\n';
      const config = makeConfigWithFiles({ 'version.txt': original });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');

      const files: FileOperation[] = [{ path: 'version.txt', content: original, status: 'updated' }];

      const first = new PM('.', '0.9.0', [
        { path: 'version.txt', filetype: 'text', versionPatterns: ['(.+)'] },
      ], 'v');
      await processor.generateFileOperations(first, ['version.txt'], '2.0.0', files);
      expect(files.find(f => f.path === 'version.txt')?.content).toBe('2.0.0\n');
      expect(files.length).toBe(1);

      const second = new PM('.', '0.9.0', [
        { path: 'version.txt', filetype: 'text', versionPatterns: ['(.+)'] },
      ], 'v');
      await processor.generateFileOperations(second, ['version.txt'], '3.0.0', files);
      expect(files.find(f => f.path === 'version.txt')?.content).toBe('3.0.0\n');
      expect(files.find(f => f.path === 'version.txt')?.status).toBe('updated');
      expect(files.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('skips glob-pattern files that cannot be loaded', async () => {
      const config = makeConfigWithFiles({}); // empty — all files return null
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: '**/missing.txt', filetype: 'text', versionPatterns: ['(.+)'] },
      ], 'v');

      const files: FileOperation[] = [];
      await processor.generateFileOperations(processedManifest, ['missing.txt'], '2.0.0', files);

      expect(files.length).toBe(0);
    });

    it('creates literal-path files that do not exist yet', async () => {
      const config = makeConfigWithFiles({}); // empty — all files return null
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: 'Chart.yaml', filetype: 'yaml', versionPatterns: ['version'] },
      ], 'v');

      const files: FileOperation[] = [];
      await processor.generateFileOperations(processedManifest, ['Chart.yaml'], '2.0.0', files);

      expect(files.length).toBe(1);
      expect(files.find(f => f.path === 'Chart.yaml')?.status).toBe('created');
      expect(files.find(f => f.path === 'Chart.yaml')?.content).toContain('2.0.0');
    });

    it('includes the file operation in the result with status "updated"', async () => {
      const config = makeConfigWithFiles({ 'version.txt': '1.0.0' });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: 'version.txt', filetype: 'text', versionPatterns: ['(.+)'] },
      ], 'v');

      const files: FileOperation[] = [{ path: 'version.txt', content: '1.0.0', status: 'updated' }];
      await processor.generateFileOperations(processedManifest, ['version.txt'], '2.0.0', files);

      expect(files.find(f => f.path === 'version.txt')?.status).toBe('updated');
    });

    it('pushes a new entry when the file is not already in the files array', async () => {
      const config = makeConfigWithFiles({ 'version.txt': '1.0.0' });
      const processor = new ManifestProcessor([], config);
      const { ProcessedManifest: PM } = await import('../../src/processors/types');
      const processedManifest = new PM('.', '1.0.0', [
        { path: 'version.txt', filetype: 'text', versionPatterns: ['(.+)'] },
      ], 'v');

      const files: FileOperation[] = [];
      await processor.generateFileOperations(processedManifest, ['version.txt'], '2.0.0', files);

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({ path: 'version.txt', content: '2.0.0', status: 'updated' });
    });
  });
});

// ---------------------------------------------------------------------------
// ManifestProcessor.process — per-manifest versionPrefix
// ---------------------------------------------------------------------------

describe('ManifestProcessor.process — per-manifest versionPrefix', () => {
  beforeAll(async () => {
    const { registerManifestType } = await import('../../src/processors/package-manifest-factory');
    const { SimplePackageManifest } = await import('../../src/processors/manifests/simple-package-manifest');
    registerManifestType('simple', SimplePackageManifest as any);
  });
  function makeProcessConfig(manifests: AppConfig['manifests']): AppConfig {
    const versioner: any = {
      calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v2.0.0' }),
    };

    const provider = {
      name: 'gitlab',
      getRepository: jest.fn().mockResolvedValue({ fullPath: 'owner/repo', webUrl: 'https://gitlab.example.com/owner/repo', defaultBranch: 'main' }),
      listAllFiles: jest.fn().mockResolvedValue([]),
      getFileContents: jest.fn().mockResolvedValue(null),
    } as any;

    return {
      provider,
      versioner,
      release: { prerelease: false, includeChores: false, targetBranch: 'main' },
      versionPrefix: 'v',
      manifests,
      dryRun: false,
      useFileSystem: false,
    } as any;
  }

  it('passes per-manifest versionPrefix to calculateNextVersion', async () => {
    const config = makeProcessConfig([
      { type: 'simple', path: '.', currentVersion: 'app-1.0.0', versionPrefix: 'app-' },
    ]);

    const commit = {
      sha: 'abc123',
      tags: [],
      title: 'feat: something',
      message: 'feat: something',
      author: { name: 'Test', email: 'test@test.com' },
      date: new Date(),
      files: ['.'],
    };

    const processor = new ManifestProcessor([commit], config);
    await processor.process();

    expect(config.versioner.calculateNextVersion).toHaveBeenCalledWith(
      expect.any(Array), 'app-1.0.0', false, false, 'app-', 'prerelease', undefined,
    );
    expect(config.provider.listAllFiles).toHaveBeenCalledWith('main');
  });

  it('defaults to empty string versionPrefix when manifest does not specify one', async () => {
    const config = makeProcessConfig([
      { type: 'simple', path: '.', currentVersion: 'v1.0.0' },
    ]);

    const commit = {
      sha: 'abc123',
      tags: [],
      title: 'feat: something',
      message: 'feat: something',
      author: { name: 'Test', email: 'test@test.com' },
      date: new Date(),
      files: ['.'],
    };

    const processor = new ManifestProcessor([commit], config);
    await processor.process();

    expect(config.versioner.calculateNextVersion).toHaveBeenCalledWith(
      expect.any(Array), 'v1.0.0', false, false, '', 'prerelease', undefined,
    );
  });

  it('bumps all manifests when updateAllVersions is true even with no matching commit files', async () => {
    const config = makeProcessConfig([
      { type: 'simple', path: 'services/api', currentVersion: 'v1.0.0' },
    ]);
    (config as any).updateAllVersions = true;

    const commit = {
      sha: 'abc123',
      tags: [],
      title: 'feat: something',
      message: 'feat: something',
      author: { name: 'Test', email: 'test@test.com' },
      date: new Date(),
      files: ['services/other/README.md'], // no file under services/api
    };

    const processor = new ManifestProcessor([commit], config);
    await processor.process();

    expect(config.versioner.calculateNextVersion).toHaveBeenCalledWith(
      expect.any(Array), 'v1.0.0', false, false, '', 'prerelease', undefined,
    );
  });

  it('skips manifest when updateAllVersions is false and no matching commit files', async () => {
    const config = makeProcessConfig([
      { type: 'simple', path: 'services/api', currentVersion: 'v1.0.0' },
    ]);

    const commit = {
      sha: 'abc123',
      tags: [],
      title: 'feat: something',
      message: 'feat: something',
      author: { name: 'Test', email: 'test@test.com' },
      date: new Date(),
      files: ['services/other/README.md'], // no file under services/api
    };

    const processor = new ManifestProcessor([commit], config);
    const result = await processor.process();

    // calculateNextVersion should only have been called for the global changelog version, not for the manifest
    expect(config.versioner.calculateNextVersion).toHaveBeenCalledTimes(1);
    expect(result.nextManifestVersions).toEqual(['v1.0.0']);
  });
});

// ---------------------------------------------------------------------------
// ManifestProcessor.updateArpConfig (via process())
// ---------------------------------------------------------------------------

describe('ManifestProcessor — updateArpConfig', () => {
  function makeArpConfig(overrides: Partial<AppConfig> = {}, getFileContentsImpl?: jest.Mock): AppConfig {
    const versioner: any = {
      calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v2.0.0' }),
    };
    const provider = {
      name: 'gitlab',
      getRepository: jest.fn().mockResolvedValue({ fullPath: 'owner/repo', webUrl: 'https://gitlab.example.com/owner/repo', defaultBranch: 'main' }),
      listAllFiles: jest.fn().mockResolvedValue([]),
      getFileContents: getFileContentsImpl ?? jest.fn().mockResolvedValue(null),
    } as any;
    return {
      provider,
      versioner,
      release: { prerelease: false, includeChores: false, targetBranch: 'main' },
      versionPrefix: 'v',
      manifests: [],
      dryRun: false,
      useFileSystem: false,
      ...overrides,
    } as any;
  }

  const commit = {
    sha: 'abc123', tags: [], title: 'feat: something', message: 'feat: something',
    author: { name: 'Test', email: 'test@test.com' }, date: new Date(), files: [],
  };

  it('returns null and skips when .arp.config.json is not found', async () => {
    const config = makeArpConfig();
    const processor = new ManifestProcessor([commit], config);
    const result = await processor.process();
    const configOp = result.files.find(f => f.path === '.arp.config.json');
    expect(configOp).toBeUndefined();
  });

  it('sets top-level version to nextVersion (no manifests array)', async () => {
    const raw = JSON.stringify({ version: 'v1.0.0' });
    const config = makeArpConfig({}, jest.fn().mockResolvedValue(raw));
    const processor = new ManifestProcessor([commit], config);
    const result = await processor.process();
    const configOp = result.files.find(f => f.path === '.arp.config.json');
    expect(configOp).toBeDefined();
    expect(JSON.parse(configOp!.content).version).toBe('v2.0.0');
    expect(configOp!.status).toBe('updated');
  });

  it('sets top-level version even when it did not previously exist', async () => {
    const raw = JSON.stringify({ someOtherField: true });
    const config = makeArpConfig({}, jest.fn().mockResolvedValue(raw));
    const processor = new ManifestProcessor([commit], config);
    const result = await processor.process();
    const configOp = result.files.find(f => f.path === '.arp.config.json');
    expect(JSON.parse(configOp!.content).version).toBe('v2.0.0');
  });

  it('updates manifest versions by index and sets root version when manifests array is present', async () => {
    const raw = JSON.stringify({
      version: 'v1.0.0',
      manifests: [
        { type: 'simple', path: 'svc/a', currentVersion: 'v1.0.0' },
        { type: 'simple', path: 'svc/b', currentVersion: 'v1.0.0' },
      ],
    });
    const getFileContents = jest.fn().mockResolvedValue(raw);
    const { registerManifestType } = await import('../../src/processors/package-manifest-factory');
    const { SimplePackageManifest } = await import('../../src/processors/manifests/simple-package-manifest');
    registerManifestType('simple', SimplePackageManifest as any);

    const config = makeArpConfig({
      manifests: [
        { type: 'simple', path: 'svc/a', currentVersion: 'v1.0.0' } as any,
        { type: 'simple', path: 'svc/b', currentVersion: 'v1.1.0' } as any,
      ],
      updateAllVersions: true,
    } as any, getFileContents);

    const processor = new ManifestProcessor([commit], config);
    const result = await processor.process();
    const configOp = result.files.find(f => f.path === '.arp.config.json');
    expect(configOp).toBeDefined();
    const parsed = JSON.parse(configOp!.content);
    expect(parsed.version).toBe('v2.0.0');
    expect(parsed.manifests[0].version).toBe('v2.0.0');
    expect(parsed.manifests[1].version).toBe('v2.0.0');
  });
});

// ---------------------------------------------------------------------------
// ManifestProcessor.getFileContent
// ---------------------------------------------------------------------------

describe('ManifestProcessor.getFileContent', () => {
  it('reads from the local filesystem when useFileSystem is not false', async () => {
    const config = makeConfig();
    (config as any).useFileSystem = true;
    const processor = new ManifestProcessor([], config);
    // readLocalFile returns null when the file doesn't exist on disk
    const result = await processor.getFileContent('non-existent-file.txt');
    expect(result).toBeNull();
    expect(config.provider.getFileContents).not.toHaveBeenCalled();
  });

  it('calls provider.getFileContents when useFileSystem is false', async () => {
    const config = makeConfig();
    (config.release as any).targetBranch = 'main';
    (config.provider.getFileContents as jest.Mock).mockResolvedValue('file content');
    const processor = new ManifestProcessor([], config);
    const result = await processor.getFileContent('some/file.txt');
    expect(result).toBe('file content');
    expect(config.provider.getFileContents).toHaveBeenCalledWith('some/file.txt', 'main');
  });

  it('returns null when provider.getFileContents rejects', async () => {
    const config = makeConfig();
    (config.provider.getFileContents as jest.Mock).mockRejectedValue(new Error('404 Not Found'));
    const processor = new ManifestProcessor([], config);
    const result = await processor.getFileContent('missing/file.txt');
    expect(result).toBeNull();
  });

  it('returns null when provider.getFileContents throws synchronously', async () => {
    const config = makeConfig();
    (config.provider.getFileContents as jest.Mock).mockImplementation(() => { throw new Error('unexpected'); });
    const processor = new ManifestProcessor([], config);
    const result = await processor.getFileContent('bad/file.txt');
    expect(result).toBeNull();
  });
});
