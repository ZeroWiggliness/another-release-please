# GitFlow

Use this model when the branch you analyze for releases is not the same branch the autorelease PR should target.

## The Important Distinction

- `targetBranch` is the branch whose history and tags are analyzed
- `prBranch` is the branch the generated PR should target

That distinction is what makes `release-pr` useful in release-branch workflows.

## Typical Pattern

| Concern | Example value |
| --- | --- |
| release branch | `release/1.2` |
| `targetBranch` | `release/1.2` |
| `prBranch` | `develop` |

Example:

```json
{
  "release": {
    "targetBranch": "release/1.2",
    "prBranch": "develop",
    "releaseBranchPrefix": "feature/"
  },
  "manifests": [
    {
      "path": ".",
      "version": "1.2.0",
      "type": "node"
    }
  ]
}
```

## How `release-pr` Helps

`release-pr` analyzes commits on `release/1.2`, generates the version bump from that stream, and then opens or refreshes a PR into `develop`. The source branch includes both branches so the release stream remains unique.

`release` must later be called with the same `targetBranch` and `prBranch` pairing, otherwise it will look for the wrong merged autorelease branch.

## Practical Guidance

- treat `prBranch` as a literal branch name, not a strategy keyword
- keep the `targetBranch` and `prBranch` pairing consistent between `release-pr` and `release`
- run dry-run checks before automating any new release stream

Hotfix and maintenance branch variants are covered in [maintenance-hotfixes.md](maintenance-hotfixes.md).