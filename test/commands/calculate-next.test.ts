jest.mock('../../src/processors/manifest-processor', () => ({
  ManifestProcessor: jest.fn().mockImplementation(() => ({
    process: jest.fn().mockResolvedValue({
      nextVersion: 'v1.2.3',
      nextManifestVersions: [],
      files: [{ path: 'version.txt', content: '1.2.3', status: 'updated' }],
    }),
  })),
}));

jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  readFileSync: jest.fn().mockReturnValue(''),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
}));

import { calculateNext } from '../../src/commands/calculate-next';
import { ManifestProcessor } from '../../src/processors/manifest-processor';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { AppConfig } from '../../src/config/config-types';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => { });
  jest.clearAllMocks();
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const provider = {
    name: 'mock',
    getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
    getTags: async () => [],
    getTag: async () => null,
    getCommits: async () => [
      { sha: 'abc', tags: [], message: '', title: 'feat: add something', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] },
    ],
    commitFiles: jest.fn().mockResolvedValue(undefined),
  } as any;

  const versioner = {
    calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.2.3' }),
    match: jest.fn().mockReturnValue(true),
  } as any;

  return {
    provider,
    versioner,
    versionPrefix: 'v',
    manifests: [],
    release: { targetBranch: 'main', prerelease: false },
    dryRun: false,
    useFileSystem: false,
    ...overrides,
  } as unknown as AppConfig;
}

describe('calculate-next', () => {
  it('commits files to the target branch by default', async () => {
    const config = makeConfig();

    const result = await calculateNext([], config);

    expect(config.provider.commitFiles).toHaveBeenCalledWith({
      branch: 'main',
      message: expect.stringContaining('v1.2.3'),
      files: expect.arrayContaining([{ path: 'version.txt', content: '1.2.3' }]),
    });
    expect(result.committed).toBe(true);
    expect(result.writtenLocal).toBeUndefined();
    expect(result.targetBranch).toBe('main');
    expect(result.nextVersion).toBe('v1.2.3');
  });

  it('writes files to the local filesystem when --write-local is passed', async () => {
    const config = makeConfig();

    const result = await calculateNext(['--write-local'], config);

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('version.txt'),
      '1.2.3',
      'utf-8',
    );
    expect(mkdirSync).toHaveBeenCalled();
    expect(config.provider.commitFiles).not.toHaveBeenCalled();
    expect(result.writtenLocal).toBe(true);
    expect(result.committed).toBeUndefined();
  });

  it('skips both commit and local write in dry-run mode', async () => {
    const config = makeConfig({ dryRun: true });

    const result = await calculateNext([], config);

    expect(config.provider.commitFiles).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.committed).toBeUndefined();
    expect(result.writtenLocal).toBeUndefined();
    expect(result.nextVersion).toBe('v1.2.3');
  });

  it('skips local write in dry-run mode even with --write-local', async () => {
    const config = makeConfig({ dryRun: true });

    const result = await calculateNext(['--write-local'], config);

    expect(writeFileSync).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.writtenLocal).toBeUndefined();
  });

  it('still commits when there are no conventional commits', async () => {
    const config = makeConfig({
      provider: {
        name: 'mock',
        getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
        getTags: async () => [],
        getTag: async () => null,
        getCommits: async () => [],
        commitFiles: jest.fn().mockResolvedValue(undefined),
      } as any,
    });

    const result = await calculateNext([], config);

    expect(result.nextVersion).toBe('v1.2.3');
    expect(result.committed).toBe(true);
    expect(config.provider.commitFiles).toHaveBeenCalled();
  });

  it('uses repo default branch when targetBranch is not set in config', async () => {
    const config = makeConfig({ release: { prerelease: false } });

    const result = await calculateNext([], config);

    expect(result.targetBranch).toBe('main');
  });

  it('constructs ManifestProcessor with skipChangelog=true', async () => {
    const config = makeConfig();

    await calculateNext([], config);

    expect(ManifestProcessor).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      true,
    );
  });

  it('returns help and empty result when --help is passed', async () => {
    const config = makeConfig();

    const result = await calculateNext(['--help'], config);

    expect(result.nextVersion).toBe('');
    expect(result.targetBranch).toBe('');
    expect(config.provider.commitFiles).not.toHaveBeenCalled();
  });

  it('includes manifestFiles in result when debug is enabled', async () => {
    const config = makeConfig({ debug: true });

    const result = await calculateNext([], config);

    expect(result.manifestFiles).toEqual([{ path: 'version.txt', content: '1.2.3', status: 'updated' }]);
  });

  it('excludes manifestFiles from result when debug is disabled', async () => {
    const config = makeConfig();

    const result = await calculateNext([], config);

    expect(result.manifestFiles).toBeUndefined();
  });
});
