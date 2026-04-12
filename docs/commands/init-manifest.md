# `init-manifest`

Use `init-manifest` to print a starter `.arp.config.json` object to stdout. It is the fastest way to bootstrap a repository because it reflects the currently resolved runtime config without exposing token values.

## When To Use It

- when starting a new repository
- when you want a self-documenting config skeleton
- when you want to see which defaults the CLI would currently resolve

## CLI, Docker, And Config Side By Side

| CLI | Docker | Config output shape |
| --- | --- | --- |
| `node ./dist/bin/arp.js --provider gitlab --repository https://gitlab.com/group/project --target-branch main init-manifest > .arp.config.json` | `docker run --rm -e GITLAB_TOKEN="$GITLAB_TOKEN" -v "$PWD:/workspace" -w /workspace darrenv/another-release-please:latest --provider gitlab --repository https://gitlab.com/group/project --target-branch main init-manifest > .arp.config.json` | `{"provider":"gitlab","release":{"prerelease":false,"targetBranch":"main","releaseBranchPrefix":"feature/","maxReleases":10,"maxCommits":100,"includeChores":false},"version":"0.1.0","manifests":[{"path":".","version":"0.1.0","type":"simple"}]}` |

## Behavior

- prints JSON only, so the command can be piped directly into a file
- omits sensitive token values
- includes the resolved `release` block and manifest list
- always returns structured JSON, even when invoked with `--help`

## Output Shape

The command returns:

- `provider`
- `release`
- `version`
- `dryRun` when applicable
- `manifests`

## Notes

- The emitted `release` block is intentionally self-documenting, so it includes defaults like `maxReleases` and `maxCommits`.
- The first manifest version becomes the top-level `version` in the generated output.
- Global options still affect what gets printed, so `--target-branch` and `--prerelease` can be used while generating the starter file.

Next: [release-pr.md](release-pr.md) covers the main operational command.
