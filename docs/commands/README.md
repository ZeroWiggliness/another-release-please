# Commands

another-release-please exposes four CLI commands. The same global options are shared across them, but each command fits a different point in the release lifecycle.

## Command Chooser

| Command | Use it when | Result |
| --- | --- | --- |
| [release.md](release.md) | The autorelease PR or MR has already been merged | Creates the tag and provider release |
| [release-pr.md](release-pr.md) | You want a reviewable release PR or MR | Calculates the next version, updates files, and creates or updates an autorelease PR or MR |
| [calculate-next.md](calculate-next.md) | You need version bumps without a PR or MR | Updates files directly on the target branch or locally |
| [init-manifest.md](init-manifest.md) | You are bootstrapping a new repository | Prints a starter `.arp.config.json` object |

## Providers

| Provider | CLI value | Notes |
| --- | --- | --- |
| GitLab | `gitlab` | Uses `GITLAB_TOKEN` when `--token` is omitted |
| GitHub | `github` | Uses `GITHUB_TOKEN` when `--token` is omitted |

## Shared Global Options

| Option | Config equivalent | Notes |
| --- | --- | --- |
| `--provider` | None | Required at startup. Must be `gitlab` or `github`. |
| `--repository` | Provider block in `.arp.config.json` | Required at startup. |
| `--token` | `gitlab.token` or `github.token` | Can also come from `GITLAB_TOKEN` or `GITHUB_TOKEN`. |
| `--target-branch` | `release.targetBranch` | Branch to analyze for history and releases. |
| `--pr-branch` | `release.prBranch` | Destination branch for the PR or MR. Defaults to `targetBranch`. |
| `--prerelease` | `release.prerelease` | Enables prerelease version calculation. |
| `--type` | top-level `type` | Overrides every manifest type. |
| `--version-prefix` | `versionPrefix` | Prefix used for release tags. |
| `--issue-url-template` | `issueUrlTemplate` | Template for issue references. |
| `--dry-run` | `dryRun` or `ARP_DRY_RUN` | Computes the result without provider-side writes. |
| `--debug` | `ARP_DEBUG` | Enables detailed logging. |
| `--include-chores` | `release.includeChores` | Includes `chore:` commits in release eligibility. |
| `--use-file-system` | `useFileSystem` or `ARP_USE_FILE_SYSTEM` | Uses the local checkout for file scanning. |
| `--no-use-file-system` | `useFileSystem: false` | Forces provider API file access. |
| `--update-all-versions` | `updateAllVersions` | Bumps every manifest even if its path did not change. |
| `--skip-tag` | `release.skipTag` | Skips provider tag creation in `release`. |
| `--skip-release` | `release.skipRelease` | Skips provider release creation in `release`. |

Known quirks in the current implementation:

- `--version` appears in help output but is not implemented by the CLI entry point.
- `draft` is loaded into config, but the current `release-pr` implementation does not pass draft state through to provider methods.
- `maxReleases` and `maxCommits` are config-only settings. They are loaded at runtime, but there are no CLI flags for them.

Choose one of the command pages for the full command-specific details.
