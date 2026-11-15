import { loadConfig } from '../../src/config/config-loader';
import { releasePr } from '../../src/commands/release-pr';
import { release } from '../../src/commands/release';
import type { GitProvider } from '../../src/interfaces/git-provider.interface';
import type { Commit, CreateReleaseParams, PullRequest } from '../../src/types/provider';

jest.mock('../../src/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setDebug: jest.fn(),
}));

const DATE = new Date('2026-04-02T00:00:00Z');
const SHA = 'abc1234567890';

function makeProvider(name: string, includeDescription: boolean | undefined, updating: boolean) {
  const repoUrl = `https://${name}.example.com/owner/repo`;
  const fileConfig = {
    version: '1.2.3', includeDescription, useFileSystem: false,
    manifests: [{ path: '.', type: 'node', version: '1.2.3' }],
  };
  const oldChangelog = '## v1.2.3\n\n* Previously released';
  const files: Record<string, string> = {
    '.arp.config.json': JSON.stringify(fileConfig),
    'package.json': '{"name":"example","version":"1.2.3"}',
    'CHANGELOG.md': oldChangelog,
  };
  const commit: Commit = {
    sha: SHA, tags: [], title: 'feat(api): add search',
    message: [
      'feat(api): add search', '', 'Search **all** records.', '', 'Refs: #42', '',
      'fix: handle empty input', '', 'Return an empty result.', '', 'Closes: #7',
    ].join('\n'),
    author: { name: 'Test', email: 'test@example.com' }, date: DATE,
    files: ['src/index.ts'], branch: 'main',
  };
  const pr: PullRequest = {
    id: 12, number: 12, title: 'chore(main): Release v1.3.0', body: '',
    sourceBranch: 'feature/arp--main--main', targetBranch: 'main',
    state: 'open', draft: false, webUrl: `${repoUrl}/pull/12`,
    labels: ['arp: v1.3.0', 'autorelease: pending'],
    createdAt: DATE, updatedAt: DATE, mergeSha: SHA,
  };
  const unexpected = () => { throw new Error('Unexpected provider operation'); };
  const provider = {
    name,
    getRepository: jest.fn(async () => ({
      id: 1, name: 'repo', fullPath: 'owner/repo', webUrl: repoUrl, defaultBranch: 'main',
    })),
    getDefaultBranch: jest.fn(async () => 'main'),
    getFileContents: jest.fn(async (path: string) => files[path] ?? null),
    getCommits: jest.fn(async () => [commit]),
    getTag: jest.fn(async () => null),
    getTags: jest.fn(async () => []),
    listAllFiles: jest.fn(async () => Object.keys(files)),
    findPullRequestByBranch: jest.fn<Promise<PullRequest[]>, Parameters<GitProvider['findPullRequestByBranch']>>()
      .mockResolvedValue(updating ? [pr] : []),
    createReleasePR: jest.fn<ReturnType<GitProvider['createReleasePR']>, Parameters<GitProvider['createReleasePR']>>()
      .mockResolvedValue(12),
    updateReleasePR: jest.fn<ReturnType<GitProvider['updateReleasePR']>, Parameters<GitProvider['updateReleasePR']>>()
      .mockResolvedValue(undefined),
    createTags: jest.fn(async () => [{ name: 'v1.3.0', commit: SHA }]),
    createRelease: jest.fn(async (params: CreateReleaseParams) => ({
      ...params, prerelease: false, created: true,
    })),
    updatePullRequestLabels: jest.fn(async () => undefined),
    createPullRequest: jest.fn(unexpected),
    updatePullRequest: jest.fn(unexpected),
    getPullRequest: jest.fn(unexpected),
    mergePullRequest: jest.fn(unexpected),
    getLatestRelease: jest.fn(unexpected),
    getReleases: jest.fn(unexpected),
    commitFiles: jest.fn(unexpected),
  } satisfies GitProvider;
  return { provider, pr, repoUrl, oldChangelog };
}

describe.each(['github', 'gitlab'])('%s real changelog release flow', name => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(DATE);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    { title: 'chore: update deps', expected: 'v1.2.4' },
    { title: 'docs: update readme', expected: 'v1.2.4' },
    { title: 'Update readme', expected: 'v1.2.4' },
    { title: 'fix: handle empty input', expected: 'v1.2.4' },
    { title: 'feat: add search', expected: 'v1.3.0' },
    { title: 'feat!: change API', expected: 'v2.0.0' },
    { title: '', expected: 'v1.2.4' },
  ])('alwaysCreatePr creates a consistent release for "$title"', async ({ title, expected }) => {
    const { provider } = makeProvider(name, false, false);
    const [original] = await provider.getCommits();
    provider.getCommits.mockResolvedValue(title ? [{ ...original, title, message: title }] : []);
    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);
    config.release.alwaysCreatePr = true;

    const result = await releasePr([], config);

    expect(result.created).toBe(true);
    expect(result.nextVersion).toBe(expected);
    expect(result.manifestNextVersions).toEqual([expected.slice(1)]);
    const [prTitle, body, , , , operations, labels, version] = provider.createReleasePR.mock.calls[0];
    expect(prTitle).toBe(`chore(main): Release ${expected}`);
    expect(body).toContain(`## ${expected}`);
    expect(version).toBe(expected);
    expect(labels).toContain(`arp: ${expected}`);
    expect(JSON.parse(operations.find(file => file.path === 'package.json')!.content).version).toBe(expected.slice(1));
    const savedConfig = JSON.parse(operations.find(file => file.path === '.arp.config.json')!.content);
    expect(savedConfig.version).toBe(expected);
    expect(savedConfig.manifests[0].version).toBe(expected.slice(1));
    expect(config.release.includeChores).toBe(false);
  });

  it.each([
    { updating: true, dryRun: false, skipPrCreation: false },
    { updating: false, dryRun: true, skipPrCreation: false },
    { updating: false, dryRun: false, skipPrCreation: true },
    { updating: true, dryRun: false, skipPrCreation: true },
  ])('alwaysCreatePr respects update and write controls %j', async ({ updating, dryRun, skipPrCreation }) => {
    const { provider } = makeProvider(name, false, updating);
    const [original] = await provider.getCommits();
    provider.getCommits.mockResolvedValue([{ ...original, title: 'chore: update deps', message: 'chore: update deps' }]);
    const config = await loadConfig({ prerelease: false, dryRun }, provider);
    config.release.alwaysCreatePr = true;
    config.release.skipPrCreation = skipPrCreation;

    const result = await releasePr([], config);

    expect(result.nextVersion).toBe('v1.2.4');
    expect(result.created).toBe(false);
    expect(result.updated).toBe(updating && !dryRun && !skipPrCreation);
    expect(provider.createReleasePR).not.toHaveBeenCalled();
    expect(provider.updateReleasePR).toHaveBeenCalledTimes(result.updated ? 1 : 0);
    if (result.updated) {
      expect(provider.updateReleasePR.mock.calls[0][8]).toBe('v1.2.4');
    }
  });

  it('alwaysCreatePr uses the existing prerelease version rules', async () => {
    const { provider } = makeProvider(name, false, false);
    const [original] = await provider.getCommits();
    provider.getCommits.mockResolvedValue([{ ...original, title: 'chore: update deps', message: 'chore: update deps' }]);
    const config = await loadConfig({ prerelease: true, dryRun: false }, provider);
    config.release.alwaysCreatePr = true;

    const result = await releasePr([], config);

    expect(result.created).toBe(true);
    expect(result.nextVersion).toBe('v1.2.4-prerelease');
    expect(result.manifestNextVersions).toEqual(['1.2.4-prerelease']);
  });

  it.each([undefined, false])('keeps chore-only releases disabled when alwaysCreatePr=%s', async alwaysCreatePr => {
    const { provider } = makeProvider(name, false, false);
    const [original] = await provider.getCommits();
    provider.getCommits.mockResolvedValue([{ ...original, title: 'chore: update deps', message: 'chore: update deps' }]);
    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);
    config.release.alwaysCreatePr = alwaysCreatePr;

    const result = await releasePr([], config);

    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
    expect(provider.createReleasePR).not.toHaveBeenCalled();
    expect(provider.updateReleasePR).not.toHaveBeenCalled();
  });

  it.each([
    [false, undefined], [false, false], [false, true],
    [true, undefined], [true, false], [true, true],
  ])('updates existing=%s with includeDescription=%s', async (updating, includeDescription) => {
    const { provider, pr, repoUrl, oldChangelog } = makeProvider(name, includeDescription, updating);
    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);
    const result = await releasePr([], config);
    const commitUrl = `${repoUrl}${name === 'gitlab' ? '/-/commit' : '/commit'}/${SHA}`;
    const issueUrl = `${repoUrl}${name === 'gitlab' ? '/-/issues' : '/issues'}`;
    const expectedBody = [
      '## v1.3.0', '', '### Features',
      `* *(api)* add search — refs [#42](${issueUrl}/42) ([abc1234](${commitUrl}))`,
      ...(includeDescription ? ['', '  Search **all** records.'] : []),
      '', '### Bug Fixes',
      `* handle empty input — closes [#7](${issueUrl}/7) ([abc1234](${commitUrl}))`,
      ...(includeDescription ? ['', '  Return an empty result.'] : []),
      '', '---', '_Generated on 2026-04-02_',
    ].join('\n');

    expect(result.nextVersion).toBe('v1.3.0');
    expect(result.created).toBe(!updating);
    expect(result.updated).toBe(updating);
    const operations = updating
      ? provider.updateReleasePR.mock.calls[0][6]
      : provider.createReleasePR.mock.calls[0][5];
    const body = updating
      ? provider.updateReleasePR.mock.calls[0][1]
      : provider.createReleasePR.mock.calls[0][1];
    expect(body).toBe(expectedBody);
    expect(body.match(/^\* /gm)).toHaveLength(2);
    expect(operations.find(file => file.path === 'CHANGELOG.md')).toEqual({
      path: 'CHANGELOG.md', status: 'updated', content: `${expectedBody}\n\n${oldChangelog}`,
    });
    expect(JSON.parse(operations.find(file => file.path === 'package.json')!.content).version).toBe('1.3.0');
    const savedConfig = JSON.parse(operations.find(file => file.path === '.arp.config.json')!.content);
    expect(savedConfig.includeDescription).toBe(includeDescription);
    expect(savedConfig.version).toBe('v1.3.0');

    provider.findPullRequestByBranch.mockResolvedValue([{ ...pr, body, state: 'merged' }]);
    const released = await release([], config);
    expect(released.created).toBe(true);
    expect(provider.createRelease.mock.calls[0][0].description).toBe(
      `## Release v1.3.0\n\n${expectedBody}\n\n---\nReleased on 2026-04-02T00:00:00.000Z`,
    );
  });
});
