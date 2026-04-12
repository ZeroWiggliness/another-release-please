# Install Guide

Use this page to get another-release-please built locally and ready to talk to a GitHub or GitLab repository.

## Requirements

- Node.js 20 or newer
- Yarn 4 or newer
- Access to the target GitHub or GitLab repository
- A provider token supplied with `--token` or the matching environment variable

## Available Providers

| Provider | CLI value | Repository type |
| --- | --- | --- |
| GitLab | `gitlab` | GitLab-hosted repositories |
| GitHub | `github` | GitHub-hosted repositories |

## Build The CLI

```bash
corepack enable
yarn install
yarn build
```

If you prefer the container image instead of a local install, use:

```bash
docker pull darrenv/another-release-please:latest
```

The compiled CLI entry point is:

```bash
node ./dist/bin/arp.js [global-options] <command> [command-options]
```

## Required Startup Inputs

The CLI startup path currently expects:

- `--provider <gitlab|github>`
- `--repository <https://host/owner/repo>`
- authentication through `--token` or the matching environment variable

Examples:

| CLI | Docker | Config or environment |
| --- | --- | --- |
| `export GITLAB_TOKEN=glpat_xxxxxxxxxxxx`<br>`node ./dist/bin/arp.js --provider gitlab --repository https://gitlab.com/group/project release-pr` | `docker run --rm -e GITLAB_TOKEN="$GITLAB_TOKEN" -v "$PWD:/workspace" -w /workspace darrenv/another-release-please:latest --provider gitlab --repository https://gitlab.com/group/project release-pr` | `{"provider":"gitlab","gitlab":{"repository":"https://gitlab.com/group/project"}}` |

The provider and repository still need to be present on the CLI at startup even if the config file contains provider metadata.

## Generate A Starter Config

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

That prints a valid starter object based on the currently resolved runtime config. Save it to the repository root as `.arp.config.json`, then adjust the `release` block and manifest entries for the repository you want to manage.

## First Validation Run

Before adding CI, validate the setup with a dry run:

```bash
node ./dist/bin/arp.js \
  --provider gitlab \
  --repository https://gitlab.com/group/project \
  --target-branch main \
  --dry-run \
  --debug \
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
  --dry-run \
  --debug \
  release-pr
```

That lets you confirm:

- the target branch and PR destination branch
- the current version anchor
- the next calculated version
- the selected manifests
- the planned file updates

Next: read [pr-based-releases.md](pr-based-releases.md) for the main release loop.
