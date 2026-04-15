[![Version](https://img.shields.io/badge/version-v0.1.2-blue)](https://github.com/ZeroWiggliness/another-release-please/releases)

# another-release-please

another-release-please is a release automation CLI for GitHub and GitLab repositories that use conventional commits and manifest-driven version updates. It follows a release-please style workflow, but adds explicit manifest processing, GitLab support, and more control over how versioned files are discovered and updated.

## Features

- Create or update a release PR or MR from conventional commits
- Calculate the next version and update files without opening a PR
- Create provider tags and releases after the autorelease PR or MR is merged
- Support GitHub and GitLab providers from the same CLI
- Ability to handle multiple flows in addition to GitHub Flow, and GitFlow can also be achieved
- Manage single-package, multi-package, and custom versioned file layouts
- Return JSON from every command so the tool fits naturally into CI/CD pipelines
- Can be run from locations other than the ddefault repo

## Providers

another-release-please currently supports these providers:

- `gitlab` for GitLab repositories
- `github` for GitHub repositories

Select the provider with `--provider <gitlab|github>`.

## Quick Start & Workflow

## Add a config file to your project

It's not necessary, but it offers more flexibility and provides a fixed location for all project and subproject versions.

Add `.arp.config.json` to the root of the repository:

```json
{
  "provider": "github",
  "release": {
    "prerelease": false,
    "releaseBranchPrefix": "feature/",
    "maxReleases": 10,
    "maxCommits": 100,
    "includeChores": false
  },
  "version": "v0.0.1",
  "versionPrefix": "v",
  "manifests": [
    {
      "path": ".",
      "type": "node",
      "version": "0.0.1"
    }
  ]
}
```

If you are migrating an existing project you can set the versions to the existing project versions. ARP will use these as a starting point.

For other project types, see the manifest documentation.

## General flow

On your default branch (or hotfix/maintenance branches), two commands need to be run:

**release** – Typically used to check if a merge request can be converted into a release. Tags the branch with the version. Returns information about the release created, current versions, etc., as JSON.

**release-pr** – Creates a Pull Request if conventional commits since the last release are detected on the target (default or hotfix/maintenance) branch. Can be directed to create PRs targeting other branches for use in GitFlow-style releases. Returns a JSON object of current and next version numbers.

**NOTE:** Do NOT run **release-pr** on non-target branches. It may pick up commits that cause it to create new PRs.

**calculate-next** – Can be used to update the project versions to the next predicted version. For example, this can be used to set the default branch `pom.xml` to `-SNAPSHOT` for Java projects. Most projects won't need this unless you release pre-release versions.

## Recommended settings

Use squash commits when merging. This helps prevent errors in version generation.

Always keep the pull request branch rebased to the latest default branch before merging. If it is behind the latest version, it may not pick up the conventional commit and generate the correct version.

It is recommened to use a personal PAT in the workflow. Especially when using **calculate-next**. This will trigger other workflows to execute.

### GitHub specific

When not using a custom PAT make sure the following in Repo Settings->Actions->General->Allow GitHub Actions to create and approve pull requests is enabled. This is not required when using a PAT.

## CI/CD

For Github it is recommened to use the [action](https://github.com/ZeroWiggliness/another-release-please-action).

There is a Gitlab CI/CD example using Docker in ./examples/ci.

## Install

Install and build the project:

```bash
corepack enable
yarn install
yarn build
```

Or use the published container image instead of a local Node.js build:

```bash
docker pull darrenv/another-release-please:latest
```

Create the tag and provider release after the autorelease PR or MR is merged:

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

Generate a starter config file:

```bash
node ./dist/bin/arp.js \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  init-manifest > .arp.config.json
```

```bash
docker run --rm \
  -e GITLAB_TOKEN="$GITLAB_TOKEN" \
  -v "$PWD:/workspace" \
  -w /workspace \
  darrenv/another-release-please:latest \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  init-manifest > .arp.config.json
```

Create or update a release PR or MR:

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

Calculate the next version without opening a PR:

```bash
node ./dist/bin/arp.js \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  calculate-next
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
  calculate-next
```

Start with the main documentation index at [docs/README.md](docs/README.md).
