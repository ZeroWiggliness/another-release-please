# What Manifests Are

Manifests define the release units in a repository. Each manifest says two things:

1. which path determines whether that package should be considered for a version bump
2. which files should actually be updated when that package is selected

## Manifest Selection

Selection happens in two stages:

1. another-release-please checks whether any qualifying conventional commit touched files under the manifest `path`
2. the manifest processor resolves the concrete versioned files for that manifest type

If `updateAllVersions` is true, stage one is bypassed and every manifest is processed on every run.

## Manifest Item Shape

```json
{
  "path": "packages/web",
  "version": "1.2.3",
  "type": "node",
  "versionPrefix": "v",
  "identifier": "beta",
  "identifierBase": "1"
}
```

The shared fields are:

- `path`
- `version`
- `type`
- `versionPrefix`
- `identifier`
- `identifierBase`
- `files` for `custom` manifests only

## Built-In Types

| Type | Typical file target | Detailed page |
| --- | --- | --- |
| `simple` | `version.txt` | [../package-manifests/simple.md](../package-manifests/simple.md) |
| `node` | `package.json` | [../package-manifests/node.md](../package-manifests/node.md) |
| `java` | `pom.xml` | [../package-manifests/java.md](../package-manifests/java.md) |
| `helm` | `Chart.yaml` | [../package-manifests/helm.md](../package-manifests/helm.md) |
| `csharp` | `*.csproj` | [../package-manifests/csharp.md](../package-manifests/csharp.md) |
| `custom` | Explicit file list | [../package-manifests/custom.md](../package-manifests/custom.md) |

## Config Updates

When version updates are generated, the runtime also updates `.arp.config.json` when that file exists in the repository. It updates:

- the top-level `version`
- each `manifests[i].version` entry by index

That keeps the config file aligned with the generated file operations.