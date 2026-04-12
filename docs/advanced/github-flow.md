# GitHub Flow

Use this model when `main` is both the integration branch and the release branch.

## Recommended Shape

| Concern | Recommended value |
| --- | --- |
| `targetBranch` | `main` |
| `prBranch` | `main` |
| release source branch prefix | `feature/` |

Example:

```json
{
  "release": {
    "targetBranch": "main",
    "prBranch": "main",
    "releaseBranchPrefix": "feature/"
  },
  "type": "node",
  "manifests": [
    {
      "path": ".",
      "version": "1.0.0",
      "type": "node"
    }
  ]
}
```

## How `release-pr` Fits

`release-pr` analyzes `main`, creates a derived source branch such as `feature/arp--main--main`, updates the selected files, and opens or refreshes a PR back into `main`.

After that PR is merged, `release` uses the same `targetBranch` and `prBranch` pairing to find the merged autorelease branch and publish the tag and release.

## Recommended Automation

- run `release-pr` after merges to `main` or on a schedule
- run `release` only after the autorelease PR has been merged
- validate new manifest rules with `--dry-run --debug` before enabling writes in CI

GitHub Actions guidance is in [github-actions.md](github-actions.md).