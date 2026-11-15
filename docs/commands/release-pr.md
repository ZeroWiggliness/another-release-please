# `release-pr`

Use `release-pr` to calculate the next version, update versioned files, generate changelog content, and create or update the autorelease PR or MR.

## When To Use It

- when you want a reviewable release change set
- when your workflow depends on one active autorelease PR or MR per release stream
- when you want changelog generation as part of the release flow

## CLI, Docker, And Config Side By Side

| CLI | Docker | Config file |
| --- | --- | --- |
| `node ./dist/bin/arp.js --provider github --repository https://github.com/owner/repo --target-branch main --pr-branch main --include-chores release-pr` | `docker run --rm -e GITHUB_TOKEN="$GITHUB_TOKEN" -v "$PWD:/workspace" -w /workspace darrenv/another-release-please:latest --provider github --repository https://github.com/owner/repo --target-branch main --pr-branch main --include-chores release-pr` | `{"release":{"targetBranch":"main","prBranch":"main","includeChores":true,"prerelease":false,"skipPrCreation":false}}` |

## What The Command Does

1. Resolves the current config from CLI options, environment variables, and `.arp.config.json`.
2. Loads commit history for `targetBranch`.
3. Calculates the next version from conventional commits.
4. Processes manifests and generates file operations.
5. Builds changelog content.
6. Creates or updates the autorelease PR or MR unless `--dry-run` or `skipPrCreation` is active.

## Important Flags

| Flag | Config equivalent | Effect |
| --- | --- | --- |
| `--target-branch` | `release.targetBranch` | Branch to analyze for tags, commits, and file updates |
| `--pr-branch` | `release.prBranch` | Destination branch for the PR or MR |
| `--prerelease` | `release.prerelease` | Generates prerelease versions |
| `--include-chores` | `release.includeChores` | Includes `chore:` commits in eligibility |
| `--skip-pr-creation` | `release.skipPrCreation` | Skips provider-side PR or MR creation and update |
| `--dry-run` | `dryRun` | Computes results without writing anything |

## Changelog Entries And Optional Descriptions

Additional unindented conventional headers in a commit message create separate
entries, grouped into the appropriate sections. Each entry keeps its own body
and footers. Headers inside fenced or indented code do not create extra entries.

Descriptions are hidden by default. Set **top-level**
`"includeDescription": true` in `.arp.config.json` to show Markdown beneath each
bullet; this is config-only and does not change version calculation.

For example:

```text
feat: add search

Search all records.

fix: handle empty input

Return an empty result.
```

This yields one Features bullet and one Bug Fixes bullet, each with its own
description when enabled. See the [example-rich changelog guide](../advanced/changelog.md)
for exact generated Markdown and twelve worked example categories, including
toggle comparisons, paragraphs, lists, fenced code, breaking notes, and links.

`BREAKING CHANGE:` and `BREAKING-CHANGE:` apply to their immediately preceding
entry and render in the breaking section. Metadata trailers are not descriptions.
The same generated section is written to the changelog and used as the PR/MR body.

## Output Shape

The command returns structured JSON with:

- `sourceBranch`
- `targetBranch`
- `created`
- `updated`
- `prNumber` when a provider-side PR or MR exists
- `currentVersion`
- `nextVersion`
- `manifestCurrentVersions`
- `manifestNextVersions`
- `prTags`
- `manifestFiles` in debug mode
- `dryRun`

## Operational Notes

- If no conventional commits are found since the last release, `release-pr` returns without creating or updating a PR or MR unless `release.alwaysCreatePr` is `true`.
- `release.alwaysCreatePr` is config-only and defaults to `false`. When enabled, chores and non-conventional commits are included, and a patch bump is used when no commit triggers a release. Feature, breaking-change, and explicit `Release-As` rules still apply. Even with no new commits, a patch release PR is created or updated and all manifest versions are updated. Dry-run and `skipPrCreation` still prevent provider writes. Other commands are unchanged.
- The generated labels are operational inputs for `release`: `arp: <version>`, `autorelease: pending`, and either `arp: release` or `arp: prerelease`.
- The current implementation loads `draft` into config, but does not pass it to provider create or update calls yet.

Next: use [release.md](release.md) after the autorelease PR or MR has been merged.
