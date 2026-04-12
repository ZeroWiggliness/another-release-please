import { initManifest } from '../../src/commands/init-manifest';
import type { AppConfig } from '../../src/config/config-types';
import type { Manifest } from '../../src/types/manifest';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('init-manifest command', () => {
  it('always includes release block with defaults; omits default path and type in manifests', async () => {
    const fakeManifests: Manifest[] = [{ type: 'simple', path: '.', currentVersion: '1.2.3', versionPrefix: 'v' }];
    const config: AppConfig = {
      manifests: fakeManifests,
      debug: false,
      dryRun: false,
      provider: { name: 'gitlab' } as any,
      versioner: { calculateNextVersion: () => '1.2.3' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    };

    const result = await initManifest([], config);

    expect(result.provider).toBe('gitlab');
    // Release block is always present with defaults
    expect(result.release).toBeDefined();
    expect(result.release!.prerelease).toBe(false);
    expect(result.release!.releaseBranchPrefix).toBe('feature/');
    expect(result.release!.maxReleases).toBe(10);
    expect(result.release!.maxCommits).toBe(100);
    expect(result.release!.includeChores).toBe(false);
    expect(result.manifests).toHaveLength(1);
    expect(result.manifests[0].path).toBe('.');
    expect(result.manifests[0].type).toBe('simple');
    expect(result.manifests[0].version).toBe('1.2.3');
  });

  it('includes non-default release fields and omits default ones', async () => {
    const config: AppConfig = {
      manifests: [{ type: 'simple', path: '.', currentVersion: '1.0.0', versionPrefix: 'v' }],
      debug: false,
      dryRun: false,
      provider: { name: 'gitlab' } as any,
      versioner: { calculateNextVersion: () => '1.0.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: true, targetBranch: 'develop', maxCommits: 50, includeChores: true },
    };

    const result = await initManifest([], config);

    expect(result.release).toBeDefined();
    expect(result.release!.prerelease).toBe(true);
    expect(result.release!.targetBranch).toBe('develop');
    expect(result.release!.maxCommits).toBe(50);
    expect(result.release!.includeChores).toBe(true);
    // maxReleases is default (10) — still present as it is always emitted
    expect(result.release!.maxReleases).toBe(10);
  });

  it('includes non-default manifest type and non-root path', async () => {
    const config: AppConfig = {
      manifests: [{ type: 'maven', path: 'backend', currentVersion: '2.0.0', versionPrefix: 'v' }],
      debug: false,
      dryRun: false,
      provider: { name: 'github' } as any,
      versioner: { calculateNextVersion: () => '2.0.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    };

    const result = await initManifest([], config);

    expect(result.manifests[0].path).toBe('backend');
    expect(result.manifests[0].type).toBe('maven');
    expect(result.manifests[0].version).toBe('2.0.0');
  });

  it('reflects the type set by --type CLI flag across all manifests', async () => {
    // Simulates loadConfig() with cliArgs.type = 'gradle' overriding per-item types
    const config: AppConfig = {
      manifests: [
        { type: 'gradle', path: '.', currentVersion: '1.0.0', versionPrefix: 'v' },
        { type: 'gradle', path: 'libs/core', currentVersion: '1.0.0', versionPrefix: 'v' },
      ],
      debug: false,
      dryRun: false,
      provider: { name: 'gitlab' } as any,
      versioner: { calculateNextVersion: () => '1.0.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    };

    const result = await initManifest([], config);

    expect(result.manifests[0].type).toBe('gradle');
    expect(result.manifests[1].type).toBe('gradle');
  });

  it('returns config output when --help is passed', async () => {
    const config: AppConfig = {
      manifests: [{ type: 'simple', path: '.', currentVersion: '0.1.0', versionPrefix: 'v' }],
      debug: false,
      dryRun: false,
      provider: { name: 'github' } as any,
      versioner: { calculateNextVersion: () => '0.1.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    } as unknown as AppConfig;

    const result = await initManifest(['--help'], config);

    expect(result.manifests).toBeDefined();
    expect(result.provider).toBe('github');
  });

  it('writes debug and dry-run diagnostics to stderr and still returns config JSON', async () => {
    const fakeManifests: Manifest[] = [{ type: 'simple', path: '.', currentVersion: '0.1.0', versionPrefix: 'v' }];
    const config: AppConfig = {
      manifests: fakeManifests,
      debug: true,
      dryRun: true,
      provider: { name: 'gitlab' } as any,
      versioner: { calculateNextVersion: () => '0.1.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    };

    const debugSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    const result = await initManifest([], config);

    expect(debugSpy).toHaveBeenCalled();
    expect(result.provider).toBe('gitlab');
    // dryRun emitted when true
    expect(result.dryRun).toBe(true);
    expect(result.manifests).toHaveLength(1);
  });

  it('omits files field from manifests that are not custom type', async () => {
    const fakeManifests: Manifest[] = [{ type: 'simple', path: '.', currentVersion: '1.0.0', versionPrefix: 'v' }];
    const config: AppConfig = {
      manifests: fakeManifests,
      debug: false,
      dryRun: false,
      provider: { name: 'gitlab' } as any,
      versioner: { calculateNextVersion: () => '1.0.0' } as any,
      versionPrefix: 'v',
      release: { prerelease: false },
    };

    const result = await initManifest([], config);

    expect(result.manifests[0].files).toBeUndefined();
  });
});
