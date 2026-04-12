# PR-Based Releases

another-release-please is built around a PR or MR based release loop. The normal path is:

1. Run `release-pr` to calculate the next version, update versioned files, and open or refresh an autorelease PR or MR.
2. Review and merge that PR or MR.
3. Run `release` to create the tag and provider release from the merged autorelease branch.

## The Core Loop

### 1. Create Or Refresh The Autorelease PR Or MR

```bash
node ./dist/bin/arp.js \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  release-pr
```

```bash
docker run --rm \
  -e GITLAB_TOKEN="$GITLAB_TOKEN" \
  -v "$PWD:/workspace" \
  -w /workspace \
  darrenv/another-release-please:latest \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  release-pr
```

`release-pr` does the heavy lifting:

- loads `.arp.config.json` from the target branch first, then the default branch
- finds the current version from the release history and config state
- filters commits to conventional commits
- calculates the next version
- updates versioned files and prepends changelog content
- creates or updates a release PR or MR with autorelease labels

If there are no qualifying conventional commits since the last release, the command returns structured JSON without opening or updating a PR or MR.

### 2. Review And Merge The Release PR Or MR

The generated PR or MR is labeled so the later `release` step can identify it. The important labels are:

- `arp: <version>`
- `autorelease: pending`
- `arp: release` or `arp: prerelease`

These labels are operational, not decorative. The `release` command depends on them to locate the merged autorelease branch and determine which version to publish.

### 3. Create The Tag And Provider Release

```bash
node ./dist/bin/arp.js \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  release
```

```bash
docker run --rm \
  -e GITLAB_TOKEN="$GITLAB_TOKEN" \
  -v "$PWD:/workspace" \
  -w /workspace \
  darrenv/another-release-please:latest \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  release
```

`release` looks up the merged autorelease PR or MR for the resolved source branch, reads the version label, creates the tag unless `--skip-tag` is set, creates the provider release unless `--skip-release` is set, and then moves the PR or MR label from `autorelease: pending` to `autorelease: released`.

## Release-Pr Vs Calculate-Next

Use `release-pr` when you want a reviewable change set with changelog output and a PR or MR.

Use `calculate-next` when you want version updates without a PR or MR. It skips changelog generation and either commits directly to the target branch or writes files locally with `--write-local`.

## First-Time Validation

When you are wiring up a repository for the first time, run the main loop in dry-run mode before enabling write operations:

```bash
node ./dist/bin/arp.js \
  --provider github \
  --repository https://github.com/owner/repo \
  --target-branch main \
  --dry-run \
  --debug \
  release-pr
```

```bash
docker run --rm \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -v "$PWD:/workspace" \
  -w /workspace \
  darrenv/another-release-please:latest \
  --provider github \
  --repository https://github.com/owner/repo \
  --target-branch main \
  --dry-run \
  --debug \
  release-pr
```

That gives you the computed version, selected manifests, and file operations without creating branches, tags, releases, or provider-side PR updates.

Next: use [../commands/README.md](../commands/README.md) to choose the right command page.
