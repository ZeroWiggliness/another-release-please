import { release } from '../../src/commands/release';
import type { AppConfig } from '../../src/config/config-types';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('release command', () => {
  it('creates tag and release for merged MR with version label', async () => {
    const mrBody = `## v1.2.3 (2026-03-22)

### Features

* add new widget abc1234`;
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: mrBody,
        sourceBranch: 'release/arp--main',
        targetBranch: 'main',
        state: 'merged',
        draft: false,
        webUrl: 'https://gitlab.com/owner/repo/-/merge_requests/42',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn().mockResolvedValue([{ name: 'v1.2.3', commit: 'abcd' }]),
      createRelease: jest.fn().mockResolvedValue({ name: 'Release v1.2.3', tagName: 'v1.2.3', description: '', prerelease: false, created: true, createdAt: new Date() }),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = {
      match: jest.fn().mockReturnValue(true)
    };

    const config = {
      provider,
      versioner,
      manifests: [{ path: '.', currentVersion: 'v1.2.3', type: 'node' }],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false },
      useFileSystem: false,
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(provider.createTags).toHaveBeenCalledWith([{ name: 'v1.2.3', ref: 'main', message: 'Release v1.2.3' }]);
    const createReleaseCall = provider.createRelease.mock.calls[0][0];
    expect(createReleaseCall.tagName).toBe('v1.2.3');
    expect(createReleaseCall.name).toBe('Release v1.2.3');
    expect(createReleaseCall.description).toContain(`## Release v1.2.3`);
    expect(createReleaseCall.description).toContain(mrBody);
    expect(createReleaseCall.description).toMatch(/Released on \d{4}-\d{2}-\d{2}T/);
    expect(result.created).toBe(true);
    expect(result.tagName).toBe('v1.2.3');
    expect(result.manifestVersions).toEqual(['v1.2.3']);
    expect(provider.updatePullRequestLabels).toHaveBeenCalledWith(42, ['autorelease: released'], ['autorelease: pending'], false);
  });

  it('falls back to tag message if MR body is empty', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: '',
        sourceBranch: 'release/arp--main',
        targetBranch: 'main',
        state: 'merged',
        draft: false,
        webUrl: 'https://gitlab.com/owner/repo/-/merge_requests/42',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn().mockResolvedValue([{ name: 'v1.2.3', commit: 'abcd' }]),
      createRelease: jest.fn().mockResolvedValue({ name: 'Release v1.2.3', tagName: 'v1.2.3', description: '', prerelease: false, created: true, createdAt: new Date() }),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = {
      match: jest.fn().mockReturnValue(true)
    };

    const config = {
      provider,
      versioner,
      manifests: [],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false },
    } as unknown as AppConfig;

    const result = await release([], config);

    const createReleaseCall = provider.createRelease.mock.calls[0][0];
    expect(createReleaseCall.description).toContain('## Release v1.2.3');
    expect(createReleaseCall.description).toContain('Release v1.2.3');
    expect(createReleaseCall.description).toMatch(/Released on \d{4}-\d{2}-\d{2}T/);
    expect(result.created).toBe(true);
  });

  it('does not create release if MR is not merged', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: '',
        sourceBranch: 'release/arp--main',
        targetBranch: 'main',
        state: 'open',
        draft: false,
        webUrl: 'https://gitlab.com/owner/repo/-/merge_requests/42',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn(),
      createRelease: jest.fn(),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = {
      match: jest.fn().mockReturnValue(true)
    };

    const config = {
      provider,
      versioner,
      manifests: [],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false },
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(provider.createTags).not.toHaveBeenCalled();
    expect(provider.createRelease).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(provider.updatePullRequestLabels).not.toHaveBeenCalled();
  });

  it('throws when more than one merged autorelease: pending MR is found', async () => {
    const mr = {
      number: 1,
      title: 'chore(main): Release v1.2.3',
      body: '',
      sourceBranch: 'release/arp--main',
      targetBranch: 'main',
      state: 'merged',
      draft: false,
      webUrl: 'https://gitlab.com/owner/repo/-/merge_requests/1',
      labels: ['arp: v1.2.3', 'autorelease: pending'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([mr, { ...mr, number: 2 }]),
    };

    const versioner: any = { match: jest.fn().mockReturnValue(true) };
    const config = {
      provider,
      versioner,
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false },
    } as unknown as AppConfig;

    await expect(release([], config)).resolves.toEqual({ tagName: '', created: false, manifestVersions: [] });
  });

  it('prints a message when no pending autorelease MRs are found', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([]),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const config = {
      provider,
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false },
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(result.created).toBe(false);
    expect(provider.updatePullRequestLabels).not.toHaveBeenCalled();
  });

  it('uses prBranch in source branch name when searching for merged MR', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([]),
    };

    const config = {
      provider,
      release: { targetBranch: 'main', releaseBranchPrefix: 'release/', prBranch: 'develop' },
    } as unknown as AppConfig;

    await release([], config);

    expect(provider.findPullRequestByBranch).toHaveBeenCalledWith('release/arp--main--develop', 'develop', 'autorelease: pending', 'merged');
  });

  it('skips tag creation when skipTag is true but still creates the release', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: 'release body',
        sourceBranch: 'feature/arp--main',
        targetBranch: 'main',
        state: 'merged',
        draft: false,
        webUrl: 'https://github.com/owner/repo',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn(),
      createRelease: jest.fn().mockResolvedValue({ name: 'Release v1.2.3', tagName: 'v1.2.3', description: '', prerelease: false, created: true, createdAt: new Date() }),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = { match: jest.fn().mockReturnValue(true) };

    const config = {
      provider,
      versioner,
      manifests: [],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false, skipTag: true },
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(provider.createTags).not.toHaveBeenCalled();
    expect(provider.createRelease).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
    expect(result.tagName).toBe('v1.2.3');
  });

  it('skips release creation when skipRelease is true but still creates the tag', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: 'release body',
        sourceBranch: 'feature/arp--main',
        targetBranch: 'main',
        state: 'merged',
        draft: false,
        webUrl: 'https://github.com/owner/repo',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn().mockResolvedValue([{ name: 'v1.2.3', commit: 'abcd1234' }]),
      createRelease: jest.fn(),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = { match: jest.fn().mockReturnValue(true) };

    const config = {
      provider,
      versioner,
      manifests: [],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false, skipRelease: true },
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(provider.createTags).toHaveBeenCalledWith([{ name: 'v1.2.3', ref: 'main', message: 'Release v1.2.3' }]);
    expect(provider.createRelease).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.releaseUrl).toBeUndefined();
    expect(result.tagName).toBe('v1.2.3');
  });

  it('skips both tag and release creation when skipTag and skipRelease are both true', async () => {
    const provider: any = {
      name: 'mock',
      getRepository: async () => ({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      findPullRequestByBranch: jest.fn().mockResolvedValue([{
        number: 42,
        title: 'chore(main): Release v1.2.3',
        body: 'release body',
        sourceBranch: 'feature/arp--main',
        targetBranch: 'main',
        state: 'merged',
        draft: false,
        webUrl: 'https://github.com/owner/repo',
        labels: ['arp: v1.2.3', 'autorelease: pending'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
      createTags: jest.fn(),
      createRelease: jest.fn(),
      updatePullRequestLabels: jest.fn().mockResolvedValue(true),
    };

    const versioner: any = { match: jest.fn().mockReturnValue(true) };

    const config = {
      provider,
      versioner,
      manifests: [],
      release: { targetBranch: undefined, maxReleases: 20, maxCommits: 100, prerelease: false, skipTag: true, skipRelease: true },
    } as unknown as AppConfig;

    const result = await release([], config);

    expect(provider.createTags).not.toHaveBeenCalled();
    expect(provider.createRelease).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
  });
});
