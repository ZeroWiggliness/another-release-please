# Package Manifest Reference

another-release-please ships six built-in package manifest processors. Each one turns a logical manifest entry into one or more concrete file operations.

## Built-In Processors

| Type | Primary target | Default prerelease identifier | Page |
| --- | --- | --- | --- |
| `simple` | `version.txt` | `prerelease` | [simple.md](simple.md) |
| `node` | `package.json` | `prerelease` | [node.md](node.md) |
| `java` | `**/pom.xml` | `SNAPSHOT` | [java.md](java.md) |
| `helm` | `**/Chart.yaml` | `prerelease` | [helm.md](helm.md) |
| `csharp` | `**/*.csproj` | `alpha` | [csharp.md](csharp.md) |
| `custom` | explicit `files` list | `prerelease` | [custom.md](custom.md) |

## Shared Rules

- `path` controls change detection for the manifest
- built-in processors ignore any explicit `files` entries and derive their own target files
- `custom` is the only built-in type that requires `files`
- per-manifest `versionPrefix`, `identifier`, and `identifierBase` override the defaults for that manifest

Choose a page below for the exact config shape and file behavior for each processor.