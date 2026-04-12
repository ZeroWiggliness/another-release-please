# another-release-please Documentation

This documentation is organized around the release lifecycle: getting the tool running, choosing the right command, wiring it into real workflows, and configuring the package manifests that drive version updates.

## Getting Started

| Page | What it covers |
| --- | --- |
| [getting-started/install.md](getting-started/install.md) | Requirements, installation, build steps, and first invocation |
| [getting-started/pr-based-releases.md](getting-started/pr-based-releases.md) | The core release loop using `release-pr` and `release` |
| [commands/README.md](commands/README.md) | Command chooser and links to the detailed command pages |

## Commands

| Page | What it covers |
| --- | --- |
| [commands/release.md](commands/release.md) | Create the tag and provider release from a merged autorelease PR or MR |
| [commands/release-pr.md](commands/release-pr.md) | Create or refresh the autorelease PR or MR |
| [commands/calculate-next.md](commands/calculate-next.md) | Bump versions without opening a PR |
| [commands/init-manifest.md](commands/init-manifest.md) | Bootstrap a new `.arp.config.json` file |

## Advanced

| Page | What it covers |
| --- | --- |
| [advanced/README.md](advanced/README.md) | Overview of branching, automation, and deeper configuration topics |
| [advanced/github-flow.md](advanced/github-flow.md) | Mainline releases with `release-pr` |
| [advanced/gitflow.md](advanced/gitflow.md) | Release-branch workflows with `targetBranch` and `prBranch` |
| [advanced/github-actions.md](advanced/github-actions.md) | GitHub automation and the companion action repository |
| [advanced/gitlab-ci.md](advanced/gitlab-ci.md) | GitLab CI/CD pipeline design using the shipped example |
| [advanced/maintenance-hotfixes.md](advanced/maintenance-hotfixes.md) | Maintenance and hotfix branch patterns |
| [advanced/configuration.md](advanced/configuration.md) | `.arp.config.json`, precedence rules, and config-only settings |
| [advanced/manifests.md](advanced/manifests.md) | What manifests are and how manifest selection works |

## Package Manifests

| Page | What it covers |
| --- | --- |
| [package-manifests/README.md](package-manifests/README.md) | Overview of the built-in package manifest processors |
| [package-manifests/simple.md](package-manifests/simple.md) | `version.txt` projects |
| [package-manifests/node.md](package-manifests/node.md) | `package.json` projects |
| [package-manifests/java.md](package-manifests/java.md) | Maven `pom.xml` projects |
| [package-manifests/helm.md](package-manifests/helm.md) | Helm chart versioning |
| [package-manifests/csharp.md](package-manifests/csharp.md) | `.csproj` versioning |
| [package-manifests/custom.md](package-manifests/custom.md) | Explicit file patterns and custom manifest authoring |

## Additional References

| Page | What it covers |
| --- | --- |
| [contributing.md](contributing.md) | Local development workflow for this repository |
| [repository-files.md](repository-files.md) | Map of the project structure |

When you are validating a new setup, prefer `--dry-run --debug` first. That gives you the calculated version, the selected manifests, and the planned file operations without any provider-side writes.
