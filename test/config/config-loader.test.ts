import { loadConfig } from '../../src/config/config-loader';
import type { GitProvider } from '../../src/providers/git-provider';

describe('config loader', () => {
  it('defaults manifest version to 0.1.0 when config file is missing', async () => {
    const provider = {
      getDefaultBranch: async () => 'master',
      getFileContents: async (_path: string, _ref: string) => undefined,
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.manifests).toBeDefined();
    expect(config.manifests.length).toBeGreaterThan(0);
    expect(config.manifests[0].currentVersion).toBe('0.1.0');
    expect(config.manifests[0].type).toBe('simple');
    expect(config.manifests[0].path).toBe('.');
  });

  it('uses default version 0.1.0 for manifests that omit version', async () => {
    const provider = {
      getDefaultBranch: async () => 'master',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ manifests: [{ path: '.' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.manifests[0].currentVersion).toBe('0.1.0');
    expect(config.manifests[0].type).toBe('simple');
    expect(config.manifests[0].path).toBe('.');
  });

  it('uses global version and type from file when items omit them', async () => {
    const provider = {
      getDefaultBranch: async () => 'master',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ version: '2.0.0', type: 'maven', manifests: [{ path: '.' }, { path: 'sub' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.manifests[0].currentVersion).toBe('2.0.0');
    expect(config.manifests[0].type).toBe('maven');
    expect(config.manifests[1].currentVersion).toBe('2.0.0');
    expect(config.manifests[1].type).toBe('maven');
  });

  it('CLI --type overrides global and per-item type', async () => {
    const provider = {
      getDefaultBranch: async () => 'master',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ type: 'maven', manifests: [{ path: '.' }, { path: 'sub', type: 'gradle' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, type: 'simple' }, provider);

    expect(config.manifests[0].type).toBe('simple');
    expect(config.manifests[1].type).toBe('simple');
  });

  it('defaults release.targetBranch to repository default if not provided', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) => undefined,
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.release.targetBranch).toBe('main');
  });

  it('prefers provided targetBranch over repository default', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) => undefined,
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release' }, provider);

    expect(config.release.targetBranch).toBe('release');
  });

  it('loads release config from .arp.config.json', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({
          release: { targetBranch: 'develop', maxCommits: 50, includeChores: true },
          manifests: [{ path: '.' }],
        }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.release.targetBranch).toBe('develop');
    expect(config.release.maxCommits).toBe(50);
    expect(config.release.includeChores).toBe(true);
  });

  it('reads .arp.config.json from target branch when specified', async () => {
    const refs: string[] = [];
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, ref: string) => {
        refs.push(ref);
        if (ref === 'release/v2') {
          return JSON.stringify({ version: '2.0.0', manifests: [{ path: '.', version: '2.0.0', type: 'simple' }] });
        }
        return undefined;
      },
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2' }, provider);

    expect(refs[0]).toBe('release/v2');
    expect(config.manifests[0].currentVersion).toBe('2.0.0');
  });

  it('falls back to default branch when .arp.config.json is absent on target branch', async () => {
    const refs: string[] = [];
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, ref: string) => {
        refs.push(ref);
        if (ref === 'main') {
          return JSON.stringify({ version: '1.5.0', manifests: [{ path: '.', version: '1.5.0', type: 'simple' }] });
        }
        return undefined; // not found on target branch
      },
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2' }, provider);

    expect(refs).toContain('release/v2');
    expect(refs).toContain('main');
    expect(config.manifests[0].currentVersion).toBe('1.5.0');
  });

  it('sets config.version from fileConfig.version when valid', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ version: '1.2.3' }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.version).toBe('1.2.3');
  });

  it('throws when fileConfig.version is not a valid version string', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ version: 'not-a-version' }),
    } as unknown as GitProvider;

    await expect(loadConfig({ prerelease: false, dryRun: false }, provider))
      .rejects.toThrow('Invalid version in config: "not-a-version"');
  });

  it('config.version is undefined when fileConfig has no version field', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) => undefined,
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.version).toBeUndefined();
  });

  it('defaults versionPrefix to "v" when not set', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) => undefined,
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.versionPrefix).toBe('v');
    expect(config.versioner.versionPrefix).toBe('v');
  });

  it('CLI versionPrefix overrides file config versionPrefix', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ versionPrefix: 'release-' }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, versionPrefix: 'ver-' }, provider);

    expect(config.versionPrefix).toBe('ver-');
    expect(config.versioner.versionPrefix).toBe('ver-');
  });

  it('file config versionPrefix is used when CLI does not set one', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ versionPrefix: 'release-' }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.versionPrefix).toBe('release-');
    expect(config.versioner.versionPrefix).toBe('release-');
  });

  it('manifest versionPrefix is undefined when not set on item (falls back to global at runtime)', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ versionPrefix: 'ver-', manifests: [{ path: '.', version: '1.0.0' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.manifests[0].versionPrefix).toBeUndefined();
  });

  it('uses per-manifest versionPrefix when set, overriding global', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({
          versionPrefix: 'v',
          manifests: [
            { path: '.', version: '1.0.0' },
            { path: 'app', version: 'app-1.0.0', versionPrefix: 'app-' },
          ],
        }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

    expect(config.manifests[0].versionPrefix).toBeUndefined();
    expect(config.manifests[1].versionPrefix).toBe('app-');
  });

  it('manifests without explicit versionPrefix store undefined regardless of CLI versionPrefix', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ manifests: [{ path: '.', version: '1.0.0' }, { path: 'sub', version: '1.0.0' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, versionPrefix: 'rel-' }, provider);

    expect(config.manifests[0].versionPrefix).toBeUndefined();
    expect(config.manifests[1].versionPrefix).toBeUndefined();
  });

  it('per-manifest versionPrefix overrides CLI versionPrefix', async () => {
    const provider = {
      getDefaultBranch: async () => 'main',
      getFileContents: async (_path: string, _ref: string) =>
        JSON.stringify({ manifests: [{ path: '.', version: '1.0.0', versionPrefix: 'pkg-' }] }),
    } as unknown as GitProvider;

    const config = await loadConfig({ prerelease: false, dryRun: false, versionPrefix: 'v' }, provider);

    expect(config.manifests[0].versionPrefix).toBe('pkg-');
  });

  describe('updateAllVersions', () => {
    it('defaults to false when absent from config file', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) => undefined,
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

      expect(config.updateAllVersions).toBe(false);
    });

    it('is true when set to true in config file', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) =>
          JSON.stringify({ updateAllVersions: true }),
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

      expect(config.updateAllVersions).toBe(true);
    });

    it('is false when explicitly set to false in config file', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) =>
          JSON.stringify({ updateAllVersions: false }),
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false }, provider);

      expect(config.updateAllVersions).toBe(false);
    });

    it('CLI --update-all-versions overrides file config false', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) =>
          JSON.stringify({ updateAllVersions: false }),
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, updateAllVersions: true }, provider);

      expect(config.updateAllVersions).toBe(true);
    });

    it('CLI --update-all-versions overrides absent file config', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) => undefined,
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, updateAllVersions: true }, provider);

      expect(config.updateAllVersions).toBe(true);
    });
  });

  describe('prBranch resolution', () => {
    it('defaults prBranch to targetBranch when not set', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) => undefined,
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2' }, provider);

      expect(config.release.prBranch).toBe('release/v2');
    });

    it('uses explicit prBranch when provided via CLI', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) => undefined,
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2', prBranch: 'main' }, provider);

      expect(config.release.prBranch).toBe('main');
    });

    it('uses prBranch from config file when not set via CLI', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) =>
          JSON.stringify({ release: { prBranch: 'develop' } }),
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2' }, provider);

      expect(config.release.prBranch).toBe('develop');
    });

    it('CLI prBranch overrides config file prBranch', async () => {
      const provider = {
        getDefaultBranch: async () => 'main',
        getFileContents: async (_path: string, _ref: string) =>
          JSON.stringify({ release: { prBranch: 'develop' } }),
      } as unknown as GitProvider;

      const config = await loadConfig({ prerelease: false, dryRun: false, targetBranch: 'release/v2', prBranch: 'main' }, provider);

      expect(config.release.prBranch).toBe('main');
    });
  });
});
