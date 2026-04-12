# `release`

Use `release` after the autorelease PR or MR has been merged. This command finds the merged autorelease branch, reads the release version from its labels, creates the provider tag, and creates the provider release.

## When To Use It

- after the autorelease PR or MR has been merged
- when tags and provider releases should happen as a separate CI/CD step
- when you want the release publication to be driven from the merged autorelease metadata

## CLI, Docker, And Config Side By Side

| CLI | Docker | Config file |
| --- | --- | --- |
| `node ./dist/bin/arp.js --provider gitlab --repository https://gitlab.com/group/project --target-branch main --skip-release release` | `docker run --rm -e GITLAB_TOKEN="$GITLAB_TOKEN" -v "$PWD:/workspace" -w /workspace darrenv/another-release-please:latest --provider gitlab --repository https://gitlab.com/group/project --target-branch main --skip-release release` | `{"release":{"targetBranch":"main","skipTag":false,"skipRelease":true}}` |

## Important Flags

| Flag | Config equivalent | Effect |
| --- | --- | --- |
| `--target-branch` | `release.targetBranch` | Determines which release stream to inspect |
| `--pr-branch` | `release.prBranch` | Must match the value used by `release-pr` for the same stream |
| `--skip-tag` | `release.skipTag` | Skips provider tag creation |
| `--skip-release` | `release.skipRelease` | Skips provider release creation |
| `--dry-run` | `dryRun` | Computes and logs the intended release operations without applying them |

## What The Command Does

1. Resolves the target release stream from `targetBranch` and `prBranch`.
2. Finds the most recent merged PR or MR labeled `autorelease: pending` for that stream.
3. Reads the version from the `arp: <version>` label.
4. Creates the tag unless `skipTag` is active.
5. Creates the provider release unless `skipRelease` is active.
6. Replaces the `autorelease: pending` label with `autorelease: released` when the provider supports label updates.

## Output Shape

The command returns structured JSON with:

- `tagName`
- `created`
- `releaseUrl` when the provider returns one
- `release` with provider release details when available
- `currentVersion`
- `manifestVersions`

## Operational Notes

- The command depends on the labels created by `release-pr`. If the merged PR or MR does not have an `arp: <version>` label, the current implementation throws.
- `skipTag` and `skipRelease` are independent. You can skip one and still perform the other.
- `created` reflects release creation, not tag creation.

Next: see [../advanced/github-actions.md](../advanced/github-actions.md) or [../advanced/gitlab-ci.md](../advanced/gitlab-ci.md) for automation patterns.
