import { JavaPackageManifest } from '../../src/processors/manifests/java-package-manifest';
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
    type: 'java',
    path: 'services/my-service',
    currentVersion: '1.2.3',
    ...overrides,
  };
}

describe('JavaPackageManifest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('process returns pom.xml glob under manifest path', () => {
    const manifest = makeManifest();
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations).toHaveLength(1);
    expect(result.fileOperations[0].path).toBe('services/my-service/**/pom.xml');
    expect(result.fileOperations[0].filetype).toBe('xml');
  });

  test('process returns root pom.xml glob when path is empty', () => {
    const manifest = makeManifest({ path: '' });
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.fileOperations[0].path).toBe('**/pom.xml');
  });

  test('process passes through currentVersion', () => {
    const manifest = makeManifest({ currentVersion: '2.0.0' });
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.currentVersion).toBe('2.0.0');
  });

  test('process forwards explicit versionPrefix to ProcessedManifest', () => {
    const manifest = makeManifest({ versionPrefix: 'v' });
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.versionPrefix).toBe('v');
  });

  test('process defaults versionPrefix to empty string when not set', () => {
    const manifest = makeManifest({ versionPrefix: undefined });
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    const result = processor.process([]);

    expect(result.versionPrefix).toBe('');
  });

  test('warns if manifest.files is present', () => {
    const manifest = makeManifest({ files: [{ path: 'pom.xml', filetype: 'xml', versionPatterns: ['<version>(.+)</version>'] }] });
    const processor = new JavaPackageManifest(manifest, fakeProvider);

    processor.process([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('explicitly configured files'));
  });

  describe('version pattern', () => {
    function applyPattern(pattern: string, content: string, newVersion: string): string {
      const re = new RegExp(pattern);
      return content.replace(re, (match, group1, group2) => {
        if (group1 === undefined) return newVersion;
        if (typeof group2 === 'string') return group1 + newVersion + group2;
        return match.replace(group1, newVersion);
      });
    }

    const samplePom = `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-service</artifactId>
  <version>1.2.3</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.0</version>
    </dependency>
  </dependencies>
</project>`;

    test('version pattern matches project version and not dependency version', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, samplePom, '2.0.0');

      expect(updated).toContain('<version>2.0.0</version>');
      // Dependency version should be unchanged (only first match replaced)
      expect(updated).toContain('<version>5.3.0</version>');
    });

    const pomWithParent = `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <artifactId>parent</artifactId>
    <version>3.0.0</version>
  </parent>
  <artifactId>my-service</artifactId>
  <version>1.2.3</version>
</project>`;

    test('version pattern skips parent version and matches project version', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, pomWithParent, '2.0.0');

      expect(updated).toContain('<version>2.0.0</version>');
      // Parent version should be unchanged
      expect(updated).toContain('<version>3.0.0</version>');
    });

    const pomWithSameParentAndProjectVersion = `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <artifactId>parent</artifactId>
    <version>1.2.3</version>
  </parent>
  <artifactId>my-service</artifactId>
  <version>1.2.3</version>
</project>`;

    test('version pattern updates project version when parent version equals project version', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, pomWithSameParentAndProjectVersion, '2.0.0');

      // Project version must be updated
      expect(updated).toContain('<version>2.0.0</version>');
      // Parent version must remain unchanged
      const parentVersionMatch = updated.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/);
      expect(parentVersionMatch?.[1]).toBe('1.2.3');
    });

    const realWorldSimplePom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.gk-software.core.cloud.etlf</groupId>
  <name>Ingest transaction Route</name>
  <version>1.2.3</version>
  <packaging>jar</packaging>
</project>`;

    test('version pattern updates project version in a simple POM with no parent or dependencies', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, realWorldSimplePom, '2.0.0');

      expect(updated).toContain('<version>2.0.0</version>');
    });

    const realWorldPomVersionBeforeParent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.gk-software.core.cloud.etlf</groupId>
  <name>Ingest transaction Route</name>
  <version>1.2.3</version>
  <packaging>jar</packaging>

  <parent>
    <groupId>com.gk-software.core.maven</groupId>
    <artifactId>mod-pom-global</artifactId>
    <version>3.0.0</version>
    <relativePath />
  </parent>
</project>`;

    test('version pattern updates project version when it appears before the parent block', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, realWorldPomVersionBeforeParent, '2.0.0');

      expect(updated).toContain('<version>2.0.0</version>');
      // Parent version must remain unchanged
      const parentVersionMatch = updated.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/);
      expect(parentVersionMatch?.[1]).toBe('3.0.0');
    });

    const realWorldPomVersionBeforeParentWithDependencyManagement = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.gk-software.core.cloud.etlf</groupId>
  <name>Ingest transaction Route</name>
  <version>1.2.3</version>
  <packaging>jar</packaging>

  <parent>
    <groupId>com.gk-software.core.maven</groupId>
    <artifactId>mod-pom-global</artifactId>
    <version>3.0.0</version>
    <relativePath />
  </parent>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>com.gk-software.core.cloud.etlf</groupId>
        <artifactId>integration-etlf</artifactId>
        <version>4.5.6</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>

      <dependency>
        <groupId>net.java.dev.jna</groupId>
        <artifactId>jna-platform</artifactId>
        <version>5.12.0</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>`;

    test('version pattern updates only project version when it appears before parent and dependencyManagement blocks', () => {
      const manifest = makeManifest();
      const processor = new JavaPackageManifest(manifest, fakeProvider);
      const result = processor.process([]);
      const versionPattern = result.fileOperations[0].versionPatterns[0];

      const updated = applyPattern(versionPattern, realWorldPomVersionBeforeParentWithDependencyManagement, '2.0.0');

      expect(updated).toContain('<version>2.0.0</version>');
      // Parent version must remain unchanged
      const parentVersionMatch = updated.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/);
      expect(parentVersionMatch?.[1]).toBe('3.0.0');
      // Managed dependency versions must remain unchanged
      expect(updated).toContain('<version>4.5.6</version>');
      expect(updated).toContain('<version>5.12.0</version>');
    });
  });
});
