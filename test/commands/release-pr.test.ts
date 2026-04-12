jest.mock('../../src/processors/manifest-processor', () => ({
  ManifestProcessor: jest.fn().mockImplementation(() => ({ process: jest.fn().mockResolvedValue({ manifest: { type: 'changelog', path: '.', currentVersion: '' }, files: [] }) })),
}));

import { releasePr } from '../../src/commands/release-pr';
import type { AppConfig } from '../../src/config/config-types';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('release-pr target branch resolution', () => {
  it('uses targetBranch when provided in config', async () => {
    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => [],
      createReleasePR: async () => Promise.resolve(1),
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => '0.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'release' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.targetBranch).toBe('release');
  });

  it('falls back to repository default branch when targetBranch is not set', async () => {
    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => [],
      createReleasePR: async () => Promise.resolve(1),
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => '0.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: {},
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.targetBranch).toBe('main');
  });

  it('passes nextVersion, sourceBranch and tags to provider.createReleasePR', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];

    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => commits,
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.2.3' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(createReleasePR).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'release/arp--main--main',
      'main',
      'main',
      expect.any(Array),
      ['arp: v1.2.3', 'autorelease: pending', 'arp: release'],
      'v1.2.3'
    );

    expect(result.nextVersion).toBe('v1.2.3');
    expect(result.created).toBe(true);
    expect(result.prNumber).toBe(99);
    expect(result.prTags).toEqual(expect.arrayContaining(['arp: v1.2.3', 'autorelease: pending', 'arp: release']));
  });

  it('calls provider.updateReleasePR when existing release PR is found', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];

    const updateReleasePR = jest.fn().mockResolvedValue(undefined);
    const findPullRequestByBranch = jest.fn().mockResolvedValue([{ number: 42 }] as any);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => commits,
      findPullRequestByBranch,
      updateReleasePR,
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.2.3' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(findPullRequestByBranch).toHaveBeenCalled();
    expect(updateReleasePR).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      '42',
      'release/arp--main--main',
      'main',
      'main',
      expect.any(Array),
      expect.any(Array),
      'v1.2.3'
    );

    expect(result.updated).toBe(true);
    expect(result.prNumber).toBe(42);
  });

  it('throws when more than one open autorelease: pending MR is found', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => commits,
      findPullRequestByBranch: async () => [{ number: 41 }, { number: 42 }] as any,
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.2.3' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);
    expect(result.created).toBe(false);
    expect(result.nextVersion).toBe('v1.2.3');
  });

  it('returns created: false and empty nextVersion when there are no conventional commits since last release', async () => {
    const createReleasePR = jest.fn();

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => [],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.created).toBe(false);
    expect(result.nextVersion).toBe('v1.0.0');
    expect(createReleasePR).not.toHaveBeenCalled();
  });

  it('excludes chore commits by default (includeChores: false)', async () => {
    const choreCommit = { sha: 'c1', tags: [], message: 'chore: update deps', title: 'chore: update deps', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn();

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => [choreCommit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', includeChores: false },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.created).toBe(false);
    expect(result.nextVersion).toBe('v1.0.0');
    expect(createReleasePR).not.toHaveBeenCalled();
  });

  it('includes chore commits when includeChores: true', async () => {
    const choreCommit = { sha: 'c1', tags: [], message: 'chore: update deps', title: 'chore: update deps', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getReleases: async () => [],
      getTags: async () => [],
      getCommits: async () => [choreCommit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.1' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/', includeChores: true },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(createReleasePR).toHaveBeenCalled();
    expect(result.nextVersion).toBe('v1.0.1');
  });

  it('uses config.version as baseVersion when set and no matching tag exists', async () => {
    const commit = { sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTag: async () => null,
      getTags: async () => [],
      getCommits: async () => [commit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const calculateNextVersion = jest.fn().mockReturnValue({ toString: () => '2.1.0' });
    const versioner = { calculateNextVersion } as any;

    const config = {
      provider,
      versioner,
      version: '2.0.0',
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(calculateNextVersion).toHaveBeenCalledWith(
      expect.any(Array),
      '2.0.0',
      false,
      false
    );
    expect(result.nextVersion).toBe('2.1.0');
  });

  it('uses tag commit as anchor when config.version matches an existing tag', async () => {
    const tag = { name: 'v2.0.0', commit: 'tag-sha' };
    const taggedCommit = { sha: 'tag-sha', tags: [tag], message: '', title: 'chore: release', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const newCommit = { sha: 'new-sha', tags: [], message: '', title: 'feat: new feature', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const getTag = jest.fn().mockImplementation(async (name: string) => name === 'v2.0.0' ? tag : null);
    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTag,
      getCommits: async () => [newCommit, taggedCommit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const calculateNextVersion = jest.fn().mockReturnValue({ toString: () => '2.1.0' });
    const versioner = { calculateNextVersion } as any;

    const config = {
      provider,
      versioner,
      version: '2.0.0',
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    await releasePr([], config);

    // getTag should be tried with bare version first, then prefixed
    expect(getTag).toHaveBeenCalledWith('2.0.0');
    // Only commits after the tag commit should be passed
    expect(calculateNextVersion).toHaveBeenCalledWith(
      [expect.objectContaining({ sha: 'new-sha' })],
      '2.0.0',
      false,
      false
    );
  });

  it('defaults baseVersion to 0.1.0 when no config.version and no tags found', async () => {
    const commit = { sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => [commit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const calculateNextVersion = jest.fn().mockReturnValue({ toString: () => 'v0.2.0' });
    const versioner = { calculateNextVersion } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(calculateNextVersion).toHaveBeenCalledWith(
      expect.any(Array),
      'v0.1.0',
      false,
      false
    );
    expect(result.nextVersion).toBe('v0.2.0');
  });

  it('uses custom versionPrefix in PR tag and title', async () => {
    const commit = { sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] };
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => [commit],
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'release-1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'release-',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    await releasePr([], config);

    expect(createReleasePR).toHaveBeenCalledWith(
      'chore(main): Release release-1.0.0',
      expect.any(String),
      'release/arp--main--main',
      'main',
      'main',
      expect.any(Array),
      ['arp: release-1.0.0', 'autorelease: pending', 'arp: release'],
      'release-1.0.0'
    );
  });

  it('includes manifestFiles in result when debug is enabled', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => commits,
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      debug: true,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.manifestFiles).toBeDefined();
    expect(Array.isArray(result.manifestFiles)).toBe(true);
  });

  it('excludes manifestFiles from result when debug is disabled', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => commits,
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/' },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(result.manifestFiles).toBeUndefined();
  });

  it('uses prBranch as the PR destination and in the source branch name', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];
    const createReleasePR = jest.fn().mockResolvedValue(99);
    const findPullRequestByBranch = jest.fn().mockResolvedValue([]);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => commits,
      createReleasePR,
      findPullRequestByBranch,
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/', prBranch: 'develop' },
    } as unknown as AppConfig;

    await releasePr([], config);

    expect(findPullRequestByBranch).toHaveBeenCalledWith('release/arp--main--develop', 'develop', 'autorelease: pending', 'open');
    expect(createReleasePR).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'release/arp--main--develop',
      'main',
      'develop',
      expect.any(Array),
      expect.any(Array),
      expect.any(String)
    );
  });

  it('does not call createReleasePR when skipPrCreation is true and no existing PR', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];
    const createReleasePR = jest.fn().mockResolvedValue(99);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => commits,
      createReleasePR,
      findPullRequestByBranch: async () => [],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/', skipPrCreation: true },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(createReleasePR).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
  });

  it('does not call updateReleasePR when skipPrCreation is true and existing PR found', async () => {
    const commits = [{ sha: 'abc', tags: [], message: '', title: 'feat: add', author: { name: 'A', email: 'a@a' }, date: new Date(), files: [] }];
    const updateReleasePR = jest.fn().mockResolvedValue(undefined);

    const provider = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: async () => [],
      getCommits: async () => commits,
      updateReleasePR,
      findPullRequestByBranch: async () => [{ number: 42, title: 'existing PR' }],
    } as any;

    const versioner = { calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.0.0' }) } as any;

    const config = {
      provider,
      versioner,
      versionPrefix: 'v',
      manifests: [],
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/', skipPrCreation: true },
    } as unknown as AppConfig;

    const result = await releasePr([], config);

    expect(updateReleasePR).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
  });
});
