# `calculate-next`

Use `calculate-next` when you want the next version and the corresponding file updates without opening or updating a PR or MR.

## When To Use It

- when you want direct commits on the target branch
- when a release PR or MR would add unnecessary overhead
- when you want to write updated files locally with `--write-local`

## CLI, Docker, And Config Side By Side

| CLI | Docker | Config file |
| --- | --- | --- |
| `node ./dist/bin/arp.js --provider gitlab --repository https://gitlab.com/group/project --target-branch main --prerelease calculate-next --write-local` | `docker run --rm -e GITLAB_TOKEN="$GITLAB_TOKEN" -v "$PWD:/workspace" -w /workspace darrenv/another-release-please:latest --provider gitlab --repository https://gitlab.com/group/project --target-branch main --prerelease calculate-next --write-local` | `{"release":{"targetBranch":"main","prerelease":true},"useFileSystem":true}` |

## What The Command Does

1. Resolves the current version context from `targetBranch`.
2. Calculates the next version from conventional commits.
3. Processes manifests and generates the file updates.
4. Either commits those files directly to `targetBranch` or writes them to the local working tree with `--write-local`.

Unlike `release-pr`, this command does not generate changelog content and does not create a PR or MR.

## Command-Specific Option

| Option | Config equivalent | Effect |
| --- | --- | --- |
| `--write-local` | None | Writes updated files into the local working tree instead of committing remotely |

## Output Shape

The command returns structured JSON with:

- `targetBranch`
- `nextVersion`
- `currentVersion`
- `manifestFiles` in debug mode
- `committed` when remote commits were created
- `writtenLocal` when files were written locally
- `dryRun`

## Operational Notes

- In normal mode the command commits versioned files to the target branch with the message `chore: update versions to <nextVersion>`.
- In dry-run mode it still returns the computed version and planned file updates.
- If no conventional commits are found, the command still computes a next version and selects file operations from the manifest processor.

Next: use [release-pr.md](release-pr.md) when you need a reviewable release workflow instead of direct updates.
