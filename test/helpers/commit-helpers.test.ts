import { reduceCommitsToConventionalSinceLastRelease } from '../../src/helpers/index.js';
import * as logger from '../../src/logger.js';

jest.mock('../../src/logger.js', () => ({
  warn: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(logger.warn).mockClear();
});

const makeCommit = (sha: string, title: string, message = '', branch?: string) => ({ sha, tags: [], message, title, author: { name: 'A', email: 'a@a.com' }, date: new Date(), files: [], branch });

describe('reduceCommitsToConventionalSinceLastRelease', () => {
  test('includeAllCommits retains all target-branch commits but excludes the release anchor and older commits', () => {
    const commits = [
      makeCommit('a', 'Update readme', '', 'main'),
      makeCommit('b', 'chore: update deps', '', 'main'),
      makeCommit('c', 'feat!: unrelated branch', '', 'feature/other'),
      makeCommit('tag', 'feat!: already released', '', 'main'),
      makeCommit('old', 'fix: older', '', 'main'),
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, 'tag', false, 'main', true);
    expect(result.map(commit => commit.sha)).toEqual(['a', 'b']);
  });

  test('null sha returns all conventional commits', () => {
    const commits = [
      makeCommit('a', 'feat: add feature'),
      makeCommit('b', 'WIP on something'),
      makeCommit('c', 'fix: bugfix'),
      makeCommit('d', 'chore: cleanup')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat: add feature', 'fix: bugfix']);
  });

  test('null sha returns all conventional commits including scoped', () => {
    const commits = [
      makeCommit('a', 'feat(auth): add feature'),
      makeCommit('b', 'WIP on something'),
      makeCommit('c', 'fix(core): bugfix'),
      makeCommit('d', 'chore(deps): cleanup')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat(auth): add feature', 'fix(core): bugfix']);
  });

  test('sha present selects commits up to and including that sha', () => {
    const commits = [
      makeCommit('a', 'feat: A'),
      makeCommit('b', 'chore: B'),
      makeCommit('c', 'fix: C'),
      makeCommit('d', 'WIP: D')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, 'c', false);
    // should include a and c (b is chore and excluded when includeChores=false)
    expect(result.map(c_ => c_.title)).toEqual(['feat: A', 'fix: C']);
  });

  test('includeChores true includes chore commits', () => {
    const commits = [
      makeCommit('a', 'feat: A'),
      makeCommit('b', 'chore: B'),
      makeCommit('c', 'fix: C')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, true);
    expect(result.map(c => c.title)).toEqual(['feat: A', 'chore: B', 'fix: C']);
  });

  test('includeChores false excludes scoped chore commits', () => {
    const commits = [
      makeCommit('a', 'feat(ui): A'),
      makeCommit('b', 'chore(deps): B'),
      makeCommit('c', 'fix(core): C')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat(ui): A', 'fix(core): C']);
  });

  test('includeChores true includes scoped chore commits', () => {
    const commits = [
      makeCommit('a', 'feat(ui): A'),
      makeCommit('b', 'chore(deps): B'),
      makeCommit('c', 'fix(core): C')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, true);
    expect(result.map(c => c.title)).toEqual(['feat(ui): A', 'chore(deps): B', 'fix(core): C']);
  });

  test('non-conventional messages removed', () => {
    const commits = [
      makeCommit('a', 'random message'),
      makeCommit('b', 'also not conventional'),
      makeCommit('c', 'feat: conventional')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat: conventional']);
  });

  test('ignores unknown conventional types and suggests a likely spelling correction', () => {
    const commits = [
      makeCommit('a', 'chrore: documentation improvements'),
      makeCommit('b', 'fix: actual fix'),
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);

    expect(result.map(c => c.title)).toEqual(['fix: actual fix']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring commit "chrore: documentation improvements"'),
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Did you mean "chore"?'));
  });

  test('warns for unknown conventional types without a close spelling match', () => {
    const result = reduceCommitsToConventionalSinceLastRelease([
      makeCommit('a', 'security: rotate credentials'),
    ], null, false);

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-conventional type "security"'));
  });

  test('order preserved (newest-first)', () => {
    const commits = [
      makeCommit('a', 'feat: newest'),
      makeCommit('b', 'fix: older')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat: newest', 'fix: older']);
  });

  test('unknown sha treated as null (returns all conventional commits)', () => {
    const commits = [
      makeCommit('a', 'feat: x'),
      makeCommit('b', 'fix: y')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, 'notfound', false);
    expect(result.map(c => c.title)).toEqual(['feat: x', 'fix: y']);
  });

  test('detects breaking change using ! in type', () => {
    const commits = [
      makeCommit('a', 'feat!: breaking change'),
      makeCommit('b', 'fix: bug')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat!: breaking change', 'fix: bug']);
  });

  test('detects breaking change using ! after scope', () => {
    const commits = [
      makeCommit('a', 'feat(api)!: breaking change'),
      makeCommit('b', 'fix(core): bug')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat(api)!: breaking change', 'fix(core): bug']);
  });

  test('scoped chore! breaking commit is excluded when includeChores is false', () => {
    const commits = [
      makeCommit('a', 'feat(ui): feature'),
      makeCommit('b', 'chore(ci)!: drop node 14')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat(ui): feature']);
  });

  test('scoped chore! breaking commit is included when includeChores is true', () => {
    const commits = [
      makeCommit('a', 'feat(ui): feature'),
      makeCommit('b', 'chore(ci)!: drop node 14')
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, true);
    expect(result.map(c => c.title)).toEqual(['feat(ui): feature', 'chore(ci)!: drop node 14']);
  });

  test('targetBranch filters out commits from other branches', () => {
    const commits = [
      makeCommit('a', 'feat: on main', '', 'main'),
      makeCommit('b', 'fix: on feature', '', 'feature/foo'),
      makeCommit('c', 'fix: also on main', '', 'main'),
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false, 'main');
    expect(result.map(c => c.title)).toEqual(['feat: on main', 'fix: also on main']);
  });

  test('targetBranch includes commits without a branch set (backward compatibility)', () => {
    const commits = [
      makeCommit('a', 'feat: no branch'),
      makeCommit('b', 'fix: on main', '', 'main'),
      makeCommit('c', 'fix: on feature', '', 'feature/bar'),
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false, 'main');
    expect(result.map(c => c.title)).toEqual(['feat: no branch', 'fix: on main']);
  });

  test('no targetBranch includes commits from all branches', () => {
    const commits = [
      makeCommit('a', 'feat: on main', '', 'main'),
      makeCommit('b', 'fix: on feature', '', 'feature/foo'),
    ];

    const result = reduceCommitsToConventionalSinceLastRelease(commits, null, false);
    expect(result.map(c => c.title)).toEqual(['feat: on main', 'fix: on feature']);
  });
});
