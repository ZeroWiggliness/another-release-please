import { reduceTagsToLatest, reduceTagsOnBranchToLatest } from '../../src/helpers/tag-helpers';
import type { Tag, Commit } from '../../src/types/provider';
import type { Versioner } from '../../src/interfaces/versioner.interface';

function makeTag(name: string, commit = 'abc123'): Tag {
  return { name, commit };
}

function makeCommit(sha: string, tags: Tag[] = []): Commit {
  return {
    sha,
    title: `commit ${sha}`,
    message: '',
    author: { name: 'A', email: 'a@a.com' },
    date: new Date(),
    files: [],
    tags,
  };
}

function makeVersioner(validNames: string[]): Versioner {
  return {
    versionPrefix: 'v',
    match: (name: string) => validNames.includes(name),
    increment: jest.fn(),
    version: jest.fn(),
    calculateNextVersion: jest.fn(),
  } as unknown as Versioner;
}

describe('reduceTagsToLatest', () => {
  test('returns the first matching tag', () => {
    const versioner = makeVersioner(['v1.0.0', 'v2.0.0']);
    const tags = [makeTag('v2.0.0'), makeTag('v1.0.0')];

    const result = reduceTagsToLatest(tags, versioner);

    expect(result?.name).toBe('v2.0.0');
  });

  test('returns null when no tags match', () => {
    const versioner = makeVersioner(['v1.0.0']);
    const tags = [makeTag('refs/heads/main'), makeTag('not-a-version')];

    const result = reduceTagsToLatest(tags, versioner);

    expect(result).toBeNull();
  });

  test('returns null for empty tags array', () => {
    const versioner = makeVersioner(['v1.0.0']);

    const result = reduceTagsToLatest([], versioner);

    expect(result).toBeNull();
  });

  test('skips non-matching tags before a matching one', () => {
    const versioner = makeVersioner(['v3.0.0']);
    const tags = [makeTag('beta'), makeTag('nightly'), makeTag('v3.0.0')];

    const result = reduceTagsToLatest(tags, versioner);

    expect(result?.name).toBe('v3.0.0');
  });
});

describe('reduceTagsOnBranchToLatest', () => {
  test('returns first matching tag found on any commit', () => {
    const versioner = makeVersioner(['v1.2.3']);
    const commits = [
      makeCommit('aaa', [makeTag('v1.2.3')]),
      makeCommit('bbb', [makeTag('v1.0.0')]),
    ];

    const result = reduceTagsOnBranchToLatest(commits, versioner);

    expect(result?.name).toBe('v1.2.3');
  });

  test('returns null when no commit has a matching tag', () => {
    const versioner = makeVersioner(['v1.0.0']);
    const commits = [
      makeCommit('aaa', [makeTag('beta')]),
      makeCommit('bbb'),
    ];

    const result = reduceTagsOnBranchToLatest(commits, versioner);

    expect(result).toBeNull();
  });

  test('returns null for empty commits array', () => {
    const versioner = makeVersioner(['v1.0.0']);

    const result = reduceTagsOnBranchToLatest([], versioner);

    expect(result).toBeNull();
  });

  test('returns null when commits have no tags', () => {
    const versioner = makeVersioner(['v1.0.0']);
    const commits = [makeCommit('aaa'), makeCommit('bbb')];

    const result = reduceTagsOnBranchToLatest(commits, versioner);

    expect(result).toBeNull();
  });

  test('returns the matching tag from the second commit when the first has none', () => {
    const versioner = makeVersioner(['v2.0.0']);
    const commits = [
      makeCommit('aaa'),
      makeCommit('bbb', [makeTag('v2.0.0')]),
    ];

    const result = reduceTagsOnBranchToLatest(commits, versioner);

    expect(result?.name).toBe('v2.0.0');
  });

  test('handles commits with multiple tags and returns first matching', () => {
    const versioner = makeVersioner(['v1.5.0']);
    const commits = [
      makeCommit('aaa', [makeTag('beta'), makeTag('v1.5.0'), makeTag('v1.4.0')]),
    ];

    const result = reduceTagsOnBranchToLatest(commits, versioner);

    expect(result?.name).toBe('v1.5.0');
  });
});
