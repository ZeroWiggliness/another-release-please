# Maintenance And Hotfix Branches

another-release-please works best when each active release stream has a stable `targetBranch` and `prBranch` pairing.

## Maintenance Branches

For long-lived maintenance lines, define one pair per branch line. Example:

- `targetBranch: release/1.2`, `prBranch: main`
- `targetBranch: release/1.3`, `prBranch: main`

Each pair produces a distinct autorelease source branch, which lets the tool keep those release streams separate.

## Hotfixes

For hotfixes, treat the hotfix or maintenance branch like any other release stream:

1. merge the fix into the maintenance branch
2. run `release-pr` for that branch
3. merge the autorelease PR or MR
4. run `release`

If the hotfix also needs to be merged back into a main integration branch, do that with your normal branch management process. another-release-please does not perform the back-merge for you.

## Practical Rules

- keep one release stream per `targetBranch` and `prBranch` pair
- use dry runs before enabling automation on a new maintenance line
- keep manifest `path` values aligned with the package roots so change detection remains predictable on long-lived branches