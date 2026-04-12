# Configuration

another-release-please loads configuration from four sources, in this order:

1. CLI arguments
2. Environment variables
3. `.arp.config.json`
4. Built-in defaults

## Top-Level Shape

```json
{
  "provider": "gitlab",
  "gitlab": {
    "repository": "https://gitlab.com/group/project"
  },
  "release": {
    "targetBranch": "main",
    "prBranch": "main",
    "prerelease": false,
    "releaseBranchPrefix": "feature/",
    "maxReleases": 10,
    "maxCommits": 100,
    "includeChores": false,
    "skipTag": false,
    "skipRelease": false,
    "skipPrCreation": false
  },
  "versionPrefix": "v",
  "useFileSystem": true,
  "updateAllVersions": false,
  "manifests": [
    {
      "path": ".",
      "version": "0.1.0",
      "type": "simple"
    }
  ]
}
```

## Release Block

| Field | Meaning | CLI equivalent |
| --- | --- | --- |
| `prerelease` | Enable prerelease version calculation | `--prerelease` |
| `targetBranch` | Branch to analyze for tags, commits, and release operations | `--target-branch` |
| `prBranch` | Destination branch for the PR or MR | `--pr-branch` |
| `releaseBranchPrefix` | Prefix for generated autorelease source branches | None |
| `maxReleases` | Number of releases to inspect while discovering the current version | None |
| `maxCommits` | Number of commits to inspect while calculating changes | None |
| `includeChores` | Include `chore:` commits in eligibility | `--include-chores` |
| `skipTag` | Skip provider tag creation in `release` | `--skip-tag` |
| `skipRelease` | Skip provider release creation in `release` | `--skip-release` |
| `skipPrCreation` | Skip provider PR or MR creation and updates in `release-pr` | `--skip-pr-creation` |
| `draft` | Loaded into config, but not currently wired through to provider calls | None |

## Provider And Authentication

| Provider | CLI value | Token environment variable |
| --- | --- | --- |
| GitLab | `gitlab` | `GITLAB_TOKEN` |
| GitHub | `github` | `GITHUB_TOKEN` |

- `--provider` is required at startup and is not currently resolved from the config file alone.
- `--repository` is also required at startup, even though repository metadata can exist in the provider block.
- Tokens can come from the CLI or from `GITLAB_TOKEN` and `GITHUB_TOKEN`.

## Runtime Toggles

| Setting | CLI equivalent | Notes |
| --- | --- | --- |
| `dryRun` | `--dry-run` or `ARP_DRY_RUN=true` | Computes results without write operations |
| `useFileSystem` | `--use-file-system`, `--no-use-file-system`, or `ARP_USE_FILE_SYSTEM` | Controls local checkout vs provider API file access |
| `updateAllVersions` | `--update-all-versions` | Bumps every manifest regardless of changed paths |
| `issueUrlTemplate` | `--issue-url-template` | Template for issue references |
| `versionPrefix` | `--version-prefix` | Prefix used for tag discovery and release tags |

## Config-Only Notes

- `maxReleases` and `maxCommits` do not currently have CLI flags.
- The CLI help output lists `--version`, but the current entry point does not implement it.
- `draft` is loaded, but the current `release-pr` implementation does not pass it to the providers.

Next: read [manifests.md](manifests.md) for the manifest model and [../package-manifests/README.md](../package-manifests/README.md) for the per-type reference.
