import { CSharpPackageManifest } from '../../src/processors/manifests/csharp-package-manifest';
import type { Manifest } from '../../src/types/manifest';
import * as logger from '../../src/logger';

jest.mock('../../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fakeProvider = {} as any;

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    type: 'csharp',
    path: 'src/MyProject',
    currentVersion: '1.2.3',
    ...overrides,
  };
}

describe('CSharpPackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('process returns *.csproj glob under manifest path', () => {
    const manifest = makeManifest();
    const processor = new CSharpPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toHaveLength(1);
    expect(result.fileOperations[0].path).toBe('src/MyProject/**/*.csproj');
    expect(result.fileOperations[0].filetype).toBe('xml');
  });

  test('process returns root *.csproj glob when path is empty', () => {
    const manifest = makeManifest({ path: '' });
    const processor = new CSharpPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations[0].path).toBe('**/*.csproj');
  });

  test('process passes through currentVersion and versionPrefix', () => {
    const manifest = makeManifest({ currentVersion: '2.0.0', versionPrefix: 'v' });
    const processor = new CSharpPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.currentVersion).toBe('2.0.0');
    expect(result.versionPrefix).toBe('v');
  });

  test('warns if manifest.files is present', () => {
    const manifest = makeManifest({ files: [{ path: 'MyApp.csproj', filetype: 'xml', versionPatterns: ['<Version>(.+)</Version>'] }] });
    const processor = new CSharpPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
  });

  describe('version patterns', () => {
    function applyPattern(pattern: string, content: string, newVersion: string): string {
      const re = new RegExp(pattern);
      return content.replace(re, (match, group1) => {
        if (group1 === undefined) return newVersion;
        return match.replace(group1, newVersion);
      });
    }

    const sampleCsproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Version>1.2.3</Version>
    <AssemblyName>MyApp</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json">
      <Version>13.0.1</Version>
    </PackageReference>
  </ItemGroup>
</Project>`;

    test('<Version> pattern matches project version inside PropertyGroup', () => {
      const manifest = makeManifest();
      const processor = new CSharpPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, sampleCsproj, '2.0.0');

      expect(updated).toContain('<Version>2.0.0</Version>');
      // PackageReference version should be unchanged (only first match replaced)
      const pkgRefMatch = updated.match(/<PackageReference[^>]*>[\s\S]*?<Version>([^<]+)<\/Version>/);
      expect(pkgRefMatch?.[1]).toBe('13.0.1');
    });

    test('<Version> pattern does not match when Version only appears in PackageReference', () => {
      const csprojNoProjectVersion = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="SomeLib">
      <Version>3.0.0</Version>
    </PackageReference>
  </ItemGroup>
</Project>`;
      const manifest = makeManifest();
      const processor = new CSharpPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const re = new RegExp(versionPattern);
      expect(re.test(csprojNoProjectVersion)).toBe(false);
    });
  });
});
