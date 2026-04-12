import { resolveCommitContext, expandCommits } from '../../src/helpers/commit-context';
import type { AppConfig } from '../../src/config/config-types';
import type { Tag, Commit } from '../../src/types/provider';
import * as logger from '../../src/logger';

jest.mock('../../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function makeTag(name: string, commit = 'abc12345', extras: Partial<Tag> = {}): Tag {
  return { name, commit, ...extras };
}

function makeCommit(sha: string, title: string, tags: Tag[] = [], files: string[] = [], branch?: string): Commit {
  return {
    sha,
    title,
    message: title,
    author: { name: 'Test', email: 'test@test.com' },
    date: new Date('2024-01-01'),
    files,
    tags,
    branch,
  };
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    provider: {
      getRepository: jest.fn().mockResolvedValue({ fullPath: 'owner/repo', defaultBranch: 'main' }),
      getTags: jest.fn().mockResolvedValue([]),
      getTag: jest.fn().mockResolvedValue(undefined),
      getCommits: jest.fn().mockResolvedValue([]),
      getFileContents: jest.fn(),
      getDefaultBranch: jest.fn().mockResolvedValue('main'),
    } as any,
    versioner: {
      versionPrefix: 'v',
      match: (v: string) => /^v?\d+\.\d+\.\d+/.test(v),
      calculateNextVersion: jest.fn().mockReturnValue({ toString: () => 'v1.1.0' }),
    } as any,
    release: {
      prerelease: false,
      targetBranch: 'main',
      prBranch: 'main',
      maxCommits: 100,
      includeChores: false,
    },
    versionPrefix: 'v',
    manifests: [],
    dryRun: false,
    debug: false,
    ...overrides,
  };
}

describe('resolveCommitContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without config.version (standard flow)', () => {
    test('returns empty conventionalCommits when there are no commits', async () => {
      const config = makeConfig();

      const ctx = await resolveCommitContext(config);

      expect(ctx.commits).toEqual([]);
      expect(ctx.conventionalCommits).toEqual([]);
      expect(ctx.lastVersionTag).toBeNull();
    });

    test('resolves targetBranch from config.release.targetBranch', async () => {
      const config = makeConfig({ release: { prerelease: false, targetBranch: 'develop', prBranch: 'develop', maxCommits: 100 } });

      const ctx = await resolveCommitContext(config);

      expect(ctx.targetBranch).toBe('develop');
    });

    test('falls back to repo defaultBranch when targetBranch is not set', async () => {
      const config = makeConfig({ release: { prerelease: false, prBranch: 'main', maxCommits: 100 } });

      const ctx = await resolveCommitContext(config);

      expect(ctx.targetBranch).toBe('main');
    });

    test('logs prerelease info when prerelease is true', async () => {
      const config = makeConfig({ release: { prerelease: true, targetBranch: 'main', prBranch: 'main', maxCommits: 100 } });

      await resolveCommitContext(config);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Prerelease'));
    });

    test('finds version tag from commits', async () => {
      const tag = makeTag('v1.0.0', 'sha001');
      const commit = makeCommit('sha001', 'feat: initial', [tag]);
      const config = makeConfig();
      (config.provider.getCommits as jest.Mock).mockResolvedValue([commit]);
      (config.provider.getTags as jest.Mock).mockResolvedValue([tag]);

      const ctx = await resolveCommitContext(config);

      expect(ctx.lastVersionTag?.name).toBe('v1.0.0');
    });

    test('fetches tags with maxCommits limit', async () => {
      const config = makeConfig({ release: { prerelease: false, targetBranch: 'main', maxCommits: 50 } });

      await resolveCommitContext(config);

      expect(config.provider.getTags).toHaveBeenCalledWith(50);
    });
  });

  describe('with config.version set', () => {
    test('looks up tag by exact version name', async () => {
      const tag = makeTag('v2.0.0', 'sha002');
      const config = makeConfig({ version: 'v2.0.0' });
      (config.provider.getTag as jest.Mock).mockResolvedValue(tag);
      (config.provider.getCommits as jest.Mock).mockResolvedValue([makeCommit('sha002', 'feat: something')]);

      const ctx = await resolveCommitContext(config);

      expect(config.provider.getTag).toHaveBeenCalledWith('v2.0.0');
      expect(ctx.tags).toEqual([tag]);
      expect(ctx.lastVersionTag?.name).toBe('v2.0.0');
    });

    test('tries prefixed version when bare version tag is not found', async () => {
      const tag = makeTag('v2.0.0', 'sha003');
      const config = makeConfig({ version: '2.0.0', versionPrefix: 'v' });
      (config.provider.getTag as jest.Mock)
        .mockResolvedValueOnce(undefined)   // bare '2.0.0' not found
        .mockResolvedValueOnce(tag);         // 'v2.0.0' found
      (config.provider.getCommits as jest.Mock).mockResolvedValue([makeCommit('sha003', 'feat: release')]);

      const ctx = await resolveCommitContext(config);

      expect(config.provider.getTag).toHaveBeenCalledWith('2.0.0');
      expect(config.provider.getTag).toHaveBeenCalledWith('v2.0.0');
      expect(ctx.lastVersionTag?.name).toBe('v2.0.0');
    });

    test('falls back to getTags when neither bare nor prefixed tag exists', async () => {
      const config = makeConfig({ version: '3.0.0', versionPrefix: 'v' });
      (config.provider.getTag as jest.Mock).mockResolvedValue(undefined);
      (config.provider.getTags as jest.Mock).mockResolvedValue([]);
      (config.provider.getCommits as jest.Mock).mockResolvedValue([]);

      await resolveCommitContext(config);

      expect(config.provider.getTags).toHaveBeenCalled();
    });

    test('mutates config.version to the resolved baseVersion', async () => {
      const tag = makeTag('v1.5.0', 'sha004');
      const config = makeConfig({ version: 'v1.5.0' });
      (config.provider.getTag as jest.Mock).mockResolvedValue(tag);
      (config.provider.getCommits as jest.Mock).mockResolvedValue([]);

      await resolveCommitContext(config);

      expect(config.version).toBe('v1.5.0');
    });
  });

  describe('debug logging', () => {
    test('logs tag details when debug=true and tags are present', async () => {
      const tag = makeTag('v1.0.0', 'deadbeef1234', { message: 'release tag', createdAt: new Date('2024-01-01') });
      const config = makeConfig({ debug: true });
      (config.provider.getTags as jest.Mock).mockResolvedValue([tag]);
      (config.provider.getCommits as jest.Mock).mockResolvedValue([makeCommit('deadbeef1234', 'feat: hi', [tag])]);

      await resolveCommitContext(config);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Tag Details'));
    });

    test('logs commit details when debug=true and commits are present', async () => {
      const commit = makeCommit('abc12345', 'feat: debug commit', [], ['src/index.ts']);
      const config = makeConfig({ debug: true });
      (config.provider.getCommits as jest.Mock).mockResolvedValue([commit]);

      await resolveCommitContext(config);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Commit Details'));
    });

    test('does not log debug details when debug=false', async () => {
      const tag = makeTag('v1.0.0', 'abc12345');
      const config = makeConfig({ debug: false });
      (config.provider.getTags as jest.Mock).mockResolvedValue([tag]);
      (config.provider.getCommits as jest.Mock).mockResolvedValue([makeCommit('abc12345', 'feat: hi', [tag])]);

      await resolveCommitContext(config);

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    test('baseVersion uses versionPrefix+0.1.0 when no version tag found', async () => {
      const config = makeConfig({ versionPrefix: 'v' });

      const ctx = await resolveCommitContext(config);

      expect(ctx.baseVersion).toBe('v0.1.0');
    });

    test('baseVersion uses lastVersionTag name when found', async () => {
      const tag = makeTag('v2.3.4', 'sha100');
      const commit = makeCommit('sha100', 'feat: x', [tag]);
      const config = makeConfig();
      (config.provider.getCommits as jest.Mock).mockResolvedValue([commit]);
      (config.provider.getTags as jest.Mock).mockResolvedValue([tag]);

      const ctx = await resolveCommitContext(config);

      expect(ctx.baseVersion).toBe('v2.3.4');
    });
  });
});

describe('expandCommits', () => {
  const author = { name: 'Test', email: 'test@test.com' };
  const date = new Date('2024-01-01');
  const tag = { name: 'v1.0.0', commit: 'sha001' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeRaw(message: string, tags: typeof tag[] = [], branch?: string): Commit {
    return { sha: 'abc123', tags, title: message.split('\n')[0], message, author, date, files: [], branch };
  }

  test('passes through a commit whose first line is not a conventional commit', async () => {
    const commit = makeRaw('just a plain message\nsome more prose', [tag]);
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(commit);
  });

  test('single conventional line produces one commit with correct title and message', async () => {
    const commit = makeRaw('feat: add search');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('feat: add search');
    expect(result[0].message).toBe('feat: add search');
  });

  test('single conventional line preserves tags', async () => {
    const commit = makeRaw('feat: add search', [tag]);
    const result = await expandCommits([commit]);
    expect(result[0].tags).toEqual([tag]);
  });

  test('single conventional line + BREAKING CHANGE produces one commit with suffix', async () => {
    const commit = makeRaw('feat: add search\nBREAKING CHANGE: removes old API');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('feat: add search');
    expect(result[0].message).toBe('feat: add search\n\nBREAKING CHANGE: removes old API');
  });

  test('BREAKING CHANGE line does not become a commit of its own', async () => {
    const commit = makeRaw('feat: add search\nBREAKING CHANGE: removes old API');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result.every(c => !c.title.startsWith('BREAKING CHANGE'))).toBe(true);
  });

  test('multiple conventional lines produce one commit each', async () => {
    const commit = makeRaw(
      'fix(something): Fixed something\n\nfeat: something else\nchore: another thing\nBREAKING CHANGE: A big breaking change',
      [tag],
    );
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.title)).toEqual([
      'fix(something): Fixed something',
      'feat: something else',
      'chore: another thing',
    ]);
  });

  test('tags are only on the first expanded commit', async () => {
    const commit = makeRaw(
      'fix(something): Fixed something\n\nfeat: something else\nchore: another thing\nBREAKING CHANGE: A big breaking change',
      [tag],
    );
    const result = await expandCommits([commit]);
    expect(result[0].tags).toEqual([tag]);
    expect(result[1].tags).toEqual([]);
    expect(result[2].tags).toEqual([]);
  });

  test('BREAKING CHANGE text is appended only to the first expanded commit', async () => {
    const commit = makeRaw(
      'fix(something): Fixed something\n\nfeat: something else\nchore: another thing\nBREAKING CHANGE: A big breaking change',
    );
    const result = await expandCommits([commit]);
    expect(result[0].message).toContain('BREAKING CHANGE: A big breaking change');
    expect(result[1].message).not.toContain('BREAKING CHANGE');
    expect(result[2].message).not.toContain('BREAKING CHANGE');
  });

  test('empty lines between conventional lines are ignored', async () => {
    const commit = makeRaw('feat: one\n\n\nfix: two\n\n');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('feat: one');
    expect(result[1].title).toBe('fix: two');
  });

  test('non-conventional first line — commit is passed through as-is', async () => {
    const commit = makeRaw('some prose\nfeat: real commit\nmore prose here');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(commit);
  });

  test('commit starting with a conventional line still drops non-conventional body lines', async () => {
    const commit = makeRaw('feat: real commit\nsome prose\nfix: another');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('feat: real commit');
    expect(result[1].title).toBe('fix: another');
  });

  test('BREAKING CHANGE in the middle is ignored and logs a warning', async () => {
    const commit = makeRaw('feat: add search\nBREAKING CHANGE: mid message\nfix: another');
    const result = await expandCommits([commit]);
    // only the two conventional lines become commits
    expect(result).toHaveLength(2);
    expect(result.map(c => c.title)).toEqual(['feat: add search', 'fix: another']);
    // no breaking-change suffix on either
    expect(result[0].message).not.toContain('BREAKING CHANGE');
    expect(result[1].message).not.toContain('BREAKING CHANGE');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-last position'));
  });

  test('BREAKING CHANGE only on last line is captured (not a warning)', async () => {
    const commit = makeRaw('feat: add search\nBREAKING CHANGE: removes old API');
    const result = await expandCommits([commit]);
    expect(result[0].message).toContain('BREAKING CHANGE: removes old API');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('two commits in the array each expand independently', async () => {
    const first = makeRaw('feat: one\nfix: two', [tag]);
    const second = makeRaw('chore: three\nperf: four');
    const result = await expandCommits([first, second]);
    expect(result).toHaveLength(4);
    expect(result[0].title).toBe('feat: one');
    expect(result[0].tags).toEqual([tag]);
    expect(result[1].title).toBe('fix: two');
    expect(result[1].tags).toEqual([]);
    expect(result[2].title).toBe('chore: three');
    expect(result[3].title).toBe('perf: four');
  });

  test('sha, author, date and files are copied to all expanded commits', async () => {
    const commit = makeRaw('feat: one\nfix: two');
    const result = await expandCommits([commit]);
    for (const c of result) {
      expect(c.sha).toBe(commit.sha);
      expect(c.author).toBe(commit.author);
      expect(c.date).toBe(commit.date);
      expect(c.files).toBe(commit.files);
    }
  });

  test('branch is preserved on all expanded commits', async () => {
    const commit = makeRaw('feat: one\nfix: two', [], 'main');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(2);
    expect(result[0].branch).toBe('main');
    expect(result[1].branch).toBe('main');
  });

  test('undefined branch is preserved on expanded commits', async () => {
    const commit = makeRaw('feat: one\nfix: two');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(2);
    expect(result[0].branch).toBeUndefined();
    expect(result[1].branch).toBeUndefined();
  });

  // ── Explicit cases from spec ─────────────────────────────────────────────

  // Case 1: single conventional line (covered above, included here for explicitness)
  test('case 1 — feat: new feature produces one commit', async () => {
    const commit = makeRaw('feat: new feature');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('feat: new feature');
    expect(result[0].message).toBe('feat: new feature');
  });

  // Case 2: single conventional + BREAKING CHANGE on last line
  test('case 2 — feat with BREAKING CHANGE last line appends suffix', async () => {
    const commit = makeRaw('feat: new feature\n\nBREAKING CHANGE: breaking feature');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('feat: new feature');
    expect(result[0].message).toBe('feat: new feature\n\nBREAKING CHANGE: breaking feature');
  });

  // Case 3: feat! + BREAKING CHANGE on last line
  test('case 3 — feat! with BREAKING CHANGE last line appends suffix', async () => {
    const commit = makeRaw('feat!: new feature\n\nBREAKING CHANGE: breaking feature');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('feat!: new feature');
    expect(result[0].message).toBe('feat!: new feature\n\nBREAKING CHANGE: breaking feature');
  });

  // Case 4: BREAKING CHANGE is NOT the last line — warn, no suffix, still expands
  test('case 4 — BREAKING CHANGE not last: 3 commits, warning, no suffix', async () => {
    const commit = makeRaw(
      'feat!: new feature\n\nBREAKING CHANGE: breaking feature\n\nfix: other fix\nfix: another fix',
    );
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.title)).toEqual(['feat!: new feature', 'fix: other fix', 'fix: another fix']);
    expect(result[0].message).not.toContain('BREAKING CHANGE');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-last position'));
  });

  test('case 4 with tag — tag only on first expanded commit', async () => {
    const commit = makeRaw(
      'feat!: new feature\n\nBREAKING CHANGE: breaking feature\n\nfix: other fix\nfix: another fix',
      [tag],
    );
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(3);
    expect(result[0].tags).toEqual([tag]);
    expect(result[1].tags).toEqual([]);
    expect(result[2].tags).toEqual([]);
  });

  // Case 5: BREAKING CHANGE IS the last line after multiple conventional lines
  test('case 5 — BREAKING CHANGE last: 3 commits, first gets suffix', async () => {
    const commit = makeRaw(
      'feat!: new feature\n\nfix: other fix\nfix: another fix\n\nBREAKING CHANGE: breaking feature',
    );
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.title)).toEqual(['feat!: new feature', 'fix: other fix', 'fix: another fix']);
    expect(result[0].message).toBe('feat!: new feature\n\nBREAKING CHANGE: breaking feature');
    expect(result[1].message).toBe('fix: other fix');
    expect(result[2].message).toBe('fix: another fix');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('case 5 with tag — tag only on first expanded commit', async () => {
    const commit = makeRaw(
      'feat!: new feature\n\nfix: other fix\nfix: another fix\n\nBREAKING CHANGE: breaking feature',
      [tag],
    );
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(3);
    expect(result[0].tags).toEqual([tag]);
    expect(result[1].tags).toEqual([]);
    expect(result[2].tags).toEqual([]);
  });

  // Extra: non-conventional commit passes through with all original properties intact
  test('non-conventional commit passes through with all original fields intact', async () => {
    const commit = makeRaw('Merged branch feature/xyz into main', [tag], 'main');
    const result = await expandCommits([commit]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(commit);
  });

  // Extra: mix of conventional and non-conventional commits in same batch
  test('mixed batch: non-conventional pass-through, conventional expands', async () => {
    const plain = makeRaw('Merged branch feature/xyz');
    const multi = makeRaw('feat: one\nfix: two', [tag]);
    const result = await expandCommits([plain, multi]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(plain);
    expect(result[1].title).toBe('feat: one');
    expect(result[1].tags).toEqual([tag]);
    expect(result[2].title).toBe('fix: two');
    expect(result[2].tags).toEqual([]);
  });
});
