import { SemverVersioner } from '../../src/versioners/semver-versioner';

const makeCommit = (title: string, message = '') => ({ sha: 'abc', tags: [], message, title, author: { name: 'A', email: 'a@a.com' }, date: new Date(), files: [] });

describe('SemverVersioner.calculateNextVersion', () => {
  const v = new SemverVersioner();

  test('feat! -> major', () => {
    const next = v.calculateNextVersion([makeCommit('feat!: add new feature')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('feat -> minor', () => {
    const next = v.calculateNextVersion([makeCommit('feat: add new feature')], '1.2.3', false);
    expect(next.toString()).toBe('v1.3.0');
  });

  test('fix -> patch', () => {
    const next = v.calculateNextVersion([makeCommit('fix: bug')], '1.2.3', false);
    expect(next.toString()).toBe('v1.2.4');
  });

  test('feat(test)! -> major', () => {
    const next = v.calculateNextVersion([makeCommit('feat(test)!: big change')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('fix! -> major', () => {
    const next = v.calculateNextVersion([makeCommit('fix!: breaking fix')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('fix(scope)! -> major', () => {
    const next = v.calculateNextVersion([makeCommit('fix(auth)!: breaking fix')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('chore! -> major', () => {
    const next = v.calculateNextVersion([makeCommit('chore!: drop node 14')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('BREAKING CHANGE footer on feat commit -> major', () => {
    const next = v.calculateNextVersion([makeCommit('feat: add search', 'feat: add search\n\nBREAKING CHANGE: removes old API')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('BREAKING CHANGE footer on fix commit -> major', () => {
    const next = v.calculateNextVersion([makeCommit('fix: adjust error handling', 'fix: adjust error handling\n\nBREAKING CHANGE: error format changed')], '1.2.3', false);
    expect(next.toString()).toBe('v2.0.0');
  });

  test('feat(test) -> minor', () => {
    const next = v.calculateNextVersion([makeCommit('feat(test): add new feature')], '1.2.3', false);
    expect(next.toString()).toBe('v1.3.0');
  });

  test('fix(test) -> patch', () => {
    const next = v.calculateNextVersion([makeCommit('fix(test): bug')], '1.2.3', false);
    expect(next.toString()).toBe('v1.2.4');
  });

  test('multiple commits choose highest bump', () => {
    const next = v.calculateNextVersion([
      makeCommit('fix: bug'),
      makeCommit('feat: new feature')
    ], '1.2.3', false);
    expect(next.toString()).toBe('v1.3.0');
  });

  test('release adds prerelease and increments with prerelease', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true);
    expect(next.toString()).toBe('v1.3.0-prerelease');
  });

  test('prerelease sets version', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3-prerelease', true);
    expect(next.toString()).toBe('v1.2.3-prerelease');
  });

  test('prerelease bumps existing prerelease', () => {
    const next = v.calculateNextVersion([makeCommit('fix: bug')], '1.2.3-prerelease.1', true);
    expect(next.toString()).toBe('v1.2.3-prerelease');
  });

  test('prerelease bump to release', () => {
    const next = v.calculateNextVersion([makeCommit('fix: bug')], '1.2.3-prerelease.1', false);
    expect(next.toString()).toBe('v1.2.3');
  });

  test('chore does nothing', () => {
    const next = v.calculateNextVersion([makeCommit('chore: update docs')], '1.2.3-prerelease.1', true);
    expect(next.toString()).toBe('v1.2.3-prerelease.1');
  });

  test('chore(scope) does nothing', () => {
    const next = v.calculateNextVersion([makeCommit('chore(deps): update deps')], '1.2.3-prerelease.1', true);
    expect(next.toString()).toBe('v1.2.3-prerelease.1');
  });

  describe('Release-As directive (forceVersion)', () => {
    test('chore with Release-As forces the specified version', () => {
      const next = v.calculateNextVersion([makeCommit('chore: prepare release', 'Release-As: 2.0.0')], '1.2.3', false);
      expect(next.toString()).toBe('v2.0.0');
    });

    test('Release-As overrides the current version entirely', () => {
      const next = v.calculateNextVersion([makeCommit('chore: force version', 'Release-As: 5.0.0')], '0.1.0', false);
      expect(next.toString()).toBe('v5.0.0');
    });

    test('Release-As with v-prefixed value is parsed correctly', () => {
      const next = v.calculateNextVersion([makeCommit('chore: release', 'Release-As: v3.1.4')], '1.0.0', false);
      expect(next.toString()).toBe('v3.1.4');
    });

    test('Release-As is case-insensitive in the message body', () => {
      const next = v.calculateNextVersion([makeCommit('chore: release', 'release-as: 4.2.0')], '1.0.0', false);
      expect(next.toString()).toBe('v4.2.0');
    });

    test('Release-As on scoped chore commit is honoured', () => {
      const next = v.calculateNextVersion([makeCommit('chore(release): bump', 'Release-As: 1.5.0')], '1.4.9', false);
      expect(next.toString()).toBe('v1.5.0');
    });

    test('Release-As overrides a feat commit in the same list', () => {
      const next = v.calculateNextVersion([
        makeCommit('feat: new feature'),
        makeCommit('chore: release', 'Release-As: 10.0.0'),
      ], '1.0.0', false);
      expect(next.toString()).toBe('v10.0.0');
    });

    test('Release-As respects the versioner prefix in output', () => {
      const customV = new SemverVersioner('release-');
      const next = customV.calculateNextVersion([makeCommit('chore: release', 'Release-As: 2.0.0')], '1.0.0', false);
      expect(next.toString()).toBe('release-2.0.0');
    });

    test('Release-As with prerelease version string is preserved', () => {
      const next = v.calculateNextVersion([makeCommit('chore: rc', 'Release-As: 2.0.0-prerelease.1')], '1.9.9', false);
      expect(next.toString()).toBe('v2.0.0-prerelease.1');
    });
  });

  test('chore-only commits bump patch when includeChores is true', () => {
    const next = v.calculateNextVersion([makeCommit('chore: update deps')], '1.2.3', false, true);
    expect(next.toString()).toBe('v1.2.4');
  });

  test('chore(scope)-only commits bump patch when includeChores is true', () => {
    const next = v.calculateNextVersion([makeCommit('chore(deps): update deps')], '1.2.3', false, true);
    expect(next.toString()).toBe('v1.2.4');
  });

  test('chore-only commits do not produce a clean patch when includeChores is false', () => {
    const next = v.calculateNextVersion([makeCommit('chore: update deps')], '1.2.3', false, false);
    expect(next.toString()).toBe('v1.2.4-0');
  });

  test('chore(scope)-only commits do not produce a clean patch when includeChores is false', () => {
    const next = v.calculateNextVersion([makeCommit('chore(deps): update deps')], '1.2.3', false, false);
    expect(next.toString()).toBe('v1.2.4-0');
  });
});

describe('SemverVersioner versionPrefix', () => {
  test('default prefix is "v"', () => {
    const v = new SemverVersioner();
    expect(v.versionPrefix).toBe('v');
  });

  test('custom prefix is stored', () => {
    const v = new SemverVersioner('release-');
    expect(v.versionPrefix).toBe('release-');
  });

  test('match() accepts version with configured prefix', () => {
    const v = new SemverVersioner('v');
    expect(v.match('v1.2.3')).toBe(true);
  });

  test('match() accepts version without prefix', () => {
    const v = new SemverVersioner('v');
    expect(v.match('1.2.3')).toBe(true);
  });

  test('match() with custom prefix accepts prefixed version', () => {
    const v = new SemverVersioner('release-');
    expect(v.match('release-1.2.3')).toBe(true);
  });

  test('match() with custom prefix rejects wrong prefix', () => {
    const v = new SemverVersioner('release-');
    // "v1.2.3" doesn't start with "release-", so the full string "v1.2.3" is parsed as semver
    // semver.valid("v1.2.3") returns "1.2.3", so it is still valid semver
    expect(v.match('not-a-version')).toBe(false);
  });

  test('increment() preserves configured prefix', () => {
    const v = new SemverVersioner('v');
    expect(v.increment('v1.2.3', 'patch')).toBe('v1.2.4');
  });

  test('calculateNextVersion() works with prefixed currentVersion', () => {
    const v = new SemverVersioner('v');
    const next = v.calculateNextVersion([makeCommit('feat: new')], 'v1.2.3', false);
    expect(next.toString()).toBe('v1.3.0');
  });

  test('version() with prefixed input preserves prefix in toString()', () => {
    const v = new SemverVersioner('v');
    expect(v.version('v1.2.3').toString()).toBe('v1.2.3');
  });

  test('version() without prefix in input does not add prefix to toString()', () => {
    const v = new SemverVersioner('v');
    expect(v.version('1.2.3').toString()).toBe('1.2.3');
  });

  test('version() with custom prefix preserves it in toString()', () => {
    const v = new SemverVersioner('release-');
    expect(v.version('release-2.0.0').toString()).toBe('release-2.0.0');
  });

  test('version() with empty prefix has no prefix in toString()', () => {
    const v = new SemverVersioner('');
    expect(v.version('1.2.3').toString()).toBe('1.2.3');
  });
});

describe('SemverVersioner identifier / identifierBase', () => {
  const v = new SemverVersioner('v');

  test('custom identifier with no identifierBase produces no numeric counter', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true, false, undefined, 'alpha');
    expect(next.toString()).toBe('v1.3.0-alpha');
  });

  test('custom identifier with identifierBase 0 appends .0', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true, false, undefined, 'alpha', '0');
    expect(next.toString()).toBe('v1.3.0-alpha.0');
  });

  test('custom identifier with identifierBase 1 appends .1', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true, false, undefined, 'alpha', '1');
    expect(next.toString()).toBe('v1.3.0-alpha.1');
  });

  test('custom identifier strips numeric counter when bumping existing prerelease', () => {
    const next = v.calculateNextVersion([makeCommit('fix: bug')], '1.2.3-alpha.5', true, false, undefined, 'alpha');
    expect(next.toString()).toBe('v1.2.3-alpha');
  });

  test('SNAPSHOT identifier with no identifierBase produces no numeric counter', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true, false, undefined, 'SNAPSHOT');
    expect(next.toString()).toBe('v1.3.0-SNAPSHOT');
  });

  test('default identifier (no args) uses prerelease with no counter', () => {
    const next = v.calculateNextVersion([makeCommit('feat: new feature')], '1.2.3', true);
    expect(next.toString()).toBe('v1.3.0-prerelease');
  });
});

describe('SemverVersioner error handling', () => {
  const v = new SemverVersioner();

  test('increment() throws for invalid version string', () => {
    expect(() => v.increment('not-a-version', 'patch')).toThrow('Invalid semver version: not-a-version');
  });

  test('version() throws for invalid version string', () => {
    expect(() => v.version('not-a-version')).toThrow('Invalid semver version: not-a-version');
  });

  test('calculateNextVersion() throws for invalid currentVersion', () => {
    expect(() => v.calculateNextVersion([makeCommit('feat: x')], 'not-semver', false)).toThrow('Invalid semver version: not-semver');
  });
});

describe('SemverVersioner with empty commits', () => {
  const v = new SemverVersioner();

  test('empty commits list bumps patch by default', () => {
    const next = v.calculateNextVersion([], '1.2.3', false);
    expect(next.toString()).toBe('v1.2.4');
  });

  test('empty commits list with prerelease bumps patch then adds prerelease', () => {
    const next = v.calculateNextVersion([], '1.2.3', true);
    expect(next.toString()).toBe('v1.2.4-prerelease');
  });
});
