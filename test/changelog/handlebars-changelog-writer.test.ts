import { HandlebarsChangelogWriter } from '../../src/changelog/handlebars-changelog-writer';
import type { ChangelogRepoContext } from '../../src/changelog/changelog-writer';
import type { Commit } from '../../src/types/provider';

/** Build a minimal Commit for testing */
function makeCommit(title: string, message?: string, sha = 'abc1234567890'): Commit {
  return {
    sha,
    tags: [],
    title,
    message: message ?? title,
    author: { name: 'Test', email: 'test@test.com' },
    date: new Date('2024-01-01T00:00:00Z'),
    files: [],
  };
}

/** Default context used in most tests (GitLab, no custom issue template) */
function makeContext(overrides: Partial<ChangelogRepoContext> = {}): ChangelogRepoContext {
  return {
    repoUrl: 'https://gitlab.example.com/owner/repo',
    commitPath: '/-/commit',
    issueUrlTemplate: 'https://gitlab.example.com/owner/repo/-/issues/{id}',
    issueUrlIsCustom: false,
    ...overrides,
  };
}

const FIXED_DATE = new Date('2026-04-02T00:00:00Z');
const writer = new HandlebarsChangelogWriter();

// ---------------------------------------------------------------------------
// Version heading
// ---------------------------------------------------------------------------

describe('HandlebarsChangelogWriter', () => {
  describe('version heading', () => {
    it('starts the output with ## version', async () => {
      const output = await writer.generate([makeCommit('feat: add search')], 'v1.2.3', FIXED_DATE, makeContext());
      expect(output).toMatch(/^## v1\.2\.3/);
    });

    it('preserves the exact version string supplied', async () => {
      const output = await writer.generate([makeCommit('fix: typo')], '2.0.0-beta.1', FIXED_DATE, makeContext());
      expect(output).toMatch(/^## 2\.0\.0-beta\.1/);
    });
  });

  // ---------------------------------------------------------------------------
  // Date footer
  // ---------------------------------------------------------------------------

  describe('date footer', () => {
    it('appends a --- separator and _Generated on YYYY-MM-DD_ footer', async () => {
      const output = await writer.generate([makeCommit('feat: something')], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('---');
      expect(output).toContain('_Generated on 2026-04-02_');
    });

    it('uses the provided date (not the current date)', async () => {
      const pastDate = new Date('2020-06-15T00:00:00Z');
      const output = await writer.generate([makeCommit('feat: something')], 'v1.0.0', pastDate, makeContext());
      expect(output).toContain('_Generated on 2020-06-15_');
    });
  });

  // ---------------------------------------------------------------------------
  // Commit type → section mapping
  // ---------------------------------------------------------------------------

  describe('commit type → section mapping', () => {
    it.each([
      ['feat: add search', '### Features'],
      ['feat(auth): add search', '### Features'],
      ['fix: null pointer', '### Bug Fixes'],
      ['perf: optimise query', '### Performance Improvements'],
      ['refactor: extract method', '### Refactors'],
      ['docs: update readme', '### Documentation'],
      ['test: add unit tests', '### Tests'],
      ['build: upgrade webpack', '### Build'],
      ['ci: fix pipeline', '### CI'],
      ['style: reformat code', '### Style'],
      ['chore: update deps', '### Chores'],
      ['chore(deps): update deps', '### Chores'],
    ])('%s → %s', async (title, section) => {
      const output = await writer.generate([makeCommit(title)], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain(section);
    });

    it('filters out commits with unknown types', async () => {
      const output = await writer.generate([makeCommit('unknown: something weird')], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).not.toContain('something weird');
    });

    it('filters out non-conventional commit titles', async () => {
      const output = await writer.generate([makeCommit('just a plain message')], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).not.toContain('plain message');
    });
  });

  // ---------------------------------------------------------------------------
  // Section ordering
  // ---------------------------------------------------------------------------

  describe('section ordering', () => {
    it.each([
      ['feat: a feature', 'fix: a fix'],
      ['feat(ui): a feature', 'fix: a fix'],
    ])('puts Features before Bug Fixes (%s)', async (featTitle, fixTitle) => {
      const commits = [makeCommit(fixTitle), makeCommit(featTitle)];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('### Features')).toBeLessThan(output.indexOf('### Bug Fixes'));
    });

    it('puts Bug Fixes before Performance Improvements', async () => {
      const commits = [makeCommit('perf: speed'), makeCommit('fix: bugfix')];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('### Bug Fixes')).toBeLessThan(output.indexOf('### Performance Improvements'));
    });

    it.each([
      ['feat: exciting', 'chore: boring'],
      ['feat(ui): exciting', 'chore(build): boring'],
    ])('puts Features before Chores (%s)', async (featTitle, choreTitle) => {
      const commits = [makeCommit(choreTitle), makeCommit(featTitle)];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('### Features')).toBeLessThan(output.indexOf('### Chores'));
    });

    it.each([
      ['feat: only a feature'],
      ['feat(ui): only a feature'],
    ])('omits sections with no matching commits (%s)', async (title) => {
      const output = await writer.generate([makeCommit(title)], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).not.toContain('### Bug Fixes');
      expect(output).not.toContain('### Chores');
    });
  });

  // ---------------------------------------------------------------------------
  // Breaking changes
  // ---------------------------------------------------------------------------

  describe('breaking changes', () => {
    it.each([
      ['feat!: remove old API'],
      ['feat(api)!: remove old API'],
    ])('adds a ⚠ BREAKING CHANGES section for %s', async (title) => {
      const output = await writer.generate([makeCommit(title)], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('⚠ BREAKING CHANGES');
      expect(output).toContain('remove old API');
    });

    it.each([
      ['feat!: remove old API'],
      ['feat(api)!: remove old API'],
    ])('places the BREAKING CHANGES section before Features for %s', async (title) => {
      const output = await writer.generate([makeCommit(title)], 'v2.0.0', FIXED_DATE, makeContext());
      const breakingIdx = output.indexOf('⚠ BREAKING CHANGES');
      const featuresIdx = output.indexOf('### Features');
      expect(breakingIdx).toBeLessThan(featuresIdx);
    });

    it.each([
      ['chore!: drop node 14'],
      ['chore(ci)!: drop node 14'],
    ])('adds BREAKING CHANGES for any type with ! (%s)', async (title) => {
      const output = await writer.generate([makeCommit(title)], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('⚠ BREAKING CHANGES');
      expect(output).toContain('drop node 14');
    });

    it.each([
      ['feat: normal feature'],
      ['feat(ui): normal feature'],
    ])('does not add BREAKING CHANGES section for normal commits (%s)', async (title) => {
      const output = await writer.generate([makeCommit(title)], 'v1.1.0', FIXED_DATE, makeContext());
      expect(output).not.toContain('⚠ BREAKING CHANGES');
    });

    it('lists multiple breaking changes', async () => {
      const commits = [
        makeCommit('feat!: remove API v1'),
        makeCommit('fix!: changed error format'),
      ];
      const output = await writer.generate(commits, 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('remove API v1');
      expect(output).toContain('changed error format');
      // both under the same BREAKING CHANGES heading
      expect((output.match(/⚠ BREAKING CHANGES/g) ?? []).length).toBe(1);
    });

    it('lists multiple breaking changes including scoped commits', async () => {
      const commits = [
        makeCommit('feat(api)!: remove API v1'),
        makeCommit('fix!: changed error format'),
      ];
      const output = await writer.generate(commits, 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('remove API v1');
      expect(output).toContain('changed error format');
      // both under the same BREAKING CHANGES heading
      expect((output.match(/⚠ BREAKING CHANGES/g) ?? []).length).toBe(1);
    });

    it.each([
      ['feat: add search', 'feat: add search\n\nBREAKING CHANGE: removes old API', 'removes old API'],
      ['fix: adjust errors', 'fix: adjust errors\n\nBREAKING CHANGE: error format changed', 'error format changed'],
    ])('BREAKING CHANGE footer triggers ⚠ section (%s)', async (_title, message, footerText) => {
      const output = await writer.generate([makeCommit(_title, message)], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('⚠ BREAKING CHANGES');
      expect(output).toContain(footerText);
    });

    it('footer text is used instead of title subject when BREAKING CHANGE footer is present', async () => {
      const commit = makeCommit('feat!: short title', 'feat!: short title\n\nBREAKING CHANGE: detailed description of the break');
      const output = await writer.generate([commit], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('detailed description of the break');
      expect(output).not.toContain('* short title\n');
    });

    it('appends a short-hash link to breaking change entries when repoUrl and commitPath are provided', async () => {
      const commit = makeCommit('feat!: remove old API');
      const output = await writer.generate([commit], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('⚠ BREAKING CHANGES');
      expect(output).toContain('([abc1234](https://gitlab.example.com/owner/repo/-/commit/abc1234567890))');
    });

    it('omits the hash link in breaking change entries when repoUrl is absent', async () => {
      const commit = makeCommit('feat!: remove old API');
      const context = makeContext();
      context.repoUrl = undefined;
      const output = await writer.generate([commit], 'v2.0.0', FIXED_DATE, context);
      expect(output).toContain('⚠ BREAKING CHANGES');
      expect(output).not.toContain('abc1234');
    });

    it('appends a short-hash link to breaking changes triggered by BREAKING CHANGE footer', async () => {
      const commit = makeCommit('feat: add search', 'feat: add search\n\nBREAKING CHANGE: removes old API');
      const output = await writer.generate([commit], 'v2.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('removes old API');
      expect(output).toContain('([abc1234](https://gitlab.example.com/owner/repo/-/commit/abc1234567890))');
    });
  });

  // ---------------------------------------------------------------------------
  // Scope handling
  // ---------------------------------------------------------------------------

  describe('scope handling', () => {
    it('renders the scope inline in italic parens for scoped commits', async () => {
      const output = await writer.generate([makeCommit('feat(auth): login')], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('*(auth)*');
    });

    it('does not render a scope prefix for unscoped commits', async () => {
      const output = await writer.generate([makeCommit('feat: plain feature')], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).not.toMatch(/\*\([^)]+\)\*/m);
    });

    it('places scoped commits before unscoped commits within the same section', async () => {
      const commits = [
        makeCommit('feat: unscoped feature'),
        makeCommit('feat(auth): scoped feature'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('scoped feature')).toBeLessThan(output.indexOf('unscoped feature'));
    });

    it('sorts scope groups alphabetically within a section', async () => {
      const commits = [
        makeCommit('feat(zebra): z feature'),
        makeCommit('feat(alpha): a feature'),
        makeCommit('feat(middle): m feature'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('*(alpha)*')).toBeLessThan(output.indexOf('*(middle)*'));
      expect(output.indexOf('*(middle)*')).toBeLessThan(output.indexOf('*(zebra)*'));
    });

    it('renders the scope inline for each commit in the same scope', async () => {
      const commits = [
        makeCommit('feat(auth): login'),
        makeCommit('feat(auth): logout'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect((output.match(/\*\(auth\)\*/g) ?? []).length).toBe(2);
    });

    it('sorts commits within the same scope by subject alphabetically', async () => {
      const commits = [
        makeCommit('feat(auth): zebra commit'),
        makeCommit('feat(auth): alpha commit'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('alpha commit')).toBeLessThan(output.indexOf('zebra commit'));
    });

    it('sorts unscoped commits by subject', async () => {
      const commits = [
        makeCommit('feat: zz last'),
        makeCommit('feat: aa first'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      expect(output.indexOf('aa first')).toBeLessThan(output.indexOf('zz last'));
    });

    it('keeps scope groups from different sections independent', async () => {
      const commits = [
        makeCommit('feat(auth): feat auth'),
        makeCommit('fix(auth): fix auth'),
      ];
      const output = await writer.generate(commits, 'v1.0.0', FIXED_DATE, makeContext());
      // Each commit in each section renders the scope inline
      expect((output.match(/\*\(auth\)\*/g) ?? []).length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Footer refs (git trailers)
  // ---------------------------------------------------------------------------

  describe('footer refs (git-trailer style)', () => {
    it('renders GitLab issue ref with #id display', async () => {
      const commit = makeCommit(
        'feat: add search',
        'feat: add search\n\nRefs: #42',
      );
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('[#42](https://gitlab.example.com/owner/repo/-/issues/42)');
    });

    it('renders GitHub issue ref with #id display', async () => {
      const commit = makeCommit(
        'fix: edge case',
        'fix: edge case\n\nFixes: #10',
      );
      const ctx = makeContext({
        repoUrl: 'https://github.com/owner/repo',
        commitPath: '/commit',
        issueUrlTemplate: 'https://github.com/owner/repo/issues/{id}',
        issueUrlIsCustom: false,
      });
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      expect(output).toContain('[#10](https://github.com/owner/repo/issues/10)');
    });

    it('renders Jira custom template ref with bare id (no # prefix)', async () => {
      const commit = makeCommit(
        'feat: export',
        'feat: export\n\nRefs: PROJ-123',
      );
      const ctx = makeContext({
        issueUrlTemplate: 'https://jira.example.com/browse/{id}',
        issueUrlIsCustom: true,
      });
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      expect(output).toContain('[PROJ-123](https://jira.example.com/browse/PROJ-123)');
      expect(output).not.toContain('[#PROJ-123]');
    });

    it('renders multiple refs from a single commit', async () => {
      const commit = makeCommit(
        'feat: perf',
        'feat: perf\n\nRefs: #7\nCloses: #8',
      );
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('[#7](https://gitlab.example.com/owner/repo/-/issues/7)');
      expect(output).toContain('[#8](https://gitlab.example.com/owner/repo/-/issues/8)');
    });

    it('does not render links when issueUrlTemplate is absent', async () => {
      const commit = makeCommit(
        'feat: no links',
        'feat: no links\n\nRefs: #42',
      );
      const ctx: ChangelogRepoContext = { issueUrlIsCustom: false };
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      expect(output).not.toContain('[#42]');
    });
  });

  // ---------------------------------------------------------------------------
  // Inline issue linking (subject text)
  // ---------------------------------------------------------------------------

  describe('inline issue linking in subject', () => {
    it('links #123 in the subject when issueUrlTemplate is set', async () => {
      const commit = makeCommit('feat: fix #42 typo');
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('[#42](https://gitlab.example.com/owner/repo/-/issues/42)');
    });

    it('links a Jira-style #PROJ-123 in the subject', async () => {
      const commit = makeCommit('feat: resolve #PROJ-456 blocker');
      const ctx = makeContext({
        issueUrlTemplate: 'https://jira.example.com/browse/{id}',
        issueUrlIsCustom: true,
      });
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      expect(output).toContain('[#PROJ-456](https://jira.example.com/browse/PROJ-456)');
    });

    it('does not create inline links when issueUrlTemplate is absent', async () => {
      const commit = makeCommit('feat: fix #42 something');
      const ctx: ChangelogRepoContext = { issueUrlIsCustom: false };
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      // #42 appears as plain text, no markdown link
      expect(output).not.toContain('[#42]');
      expect(output).toContain('#42');
    });
  });

  // ---------------------------------------------------------------------------
  // Commit hash link
  // ---------------------------------------------------------------------------

  describe('commit hash link', () => {
    it('appends a short-hash link when repoUrl and commitPath are provided', async () => {
      const commit = makeCommit('feat: something', undefined, 'deadbeef1234567');
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, makeContext());
      expect(output).toContain('([deadbee](https://gitlab.example.com/owner/repo/-/commit/deadbeef1234567))');
    });

    it('omits the hash link when repoUrl is absent', async () => {
      const commit = makeCommit('feat: something', undefined, 'deadbeef1234567');
      const ctx: ChangelogRepoContext = { issueUrlIsCustom: false };
      const output = await writer.generate([commit], 'v1.0.0', FIXED_DATE, ctx);
      expect(output).not.toContain('deadbee');
    });
  });
});
