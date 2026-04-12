# GitHub CI/CD

For GitHub automation, prefer the companion action repository:

- [ZeroWiggliness/another-release-please-action](https://github.com/ZeroWiggliness/another-release-please-action)

That repository is the right home for the reusable GitHub Actions wrapper. This page focuses on how the CLI fits into the underlying workflow.

## Recommended Split

Use two separate automation stages:

1. Run `release-pr` on pushes to the release branch, on a schedule, or on demand.
2. Run `release` only after the autorelease PR has been merged.

That keeps version calculation and publication separate, which is easier to reason about and safer to rerun.

## Minimal Direct CLI Example

```yaml
name: release-pr

on:
  push:
    branches:
      - main

jobs:
  release-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: corepack enable
      - run: yarn install --immutable
      - run: yarn build
      - run: |
          node ./dist/bin/arp.js \
            --provider github \
            --repository https://github.com/owner/repo \
            --target-branch main \
            release-pr
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Operational Notes

- keep `release-pr` and `release` in separate jobs or workflows
- run `--dry-run --debug` in validation workflows when changing manifest rules
- if you are standardizing GitHub automation across repositories, use the companion action repo rather than copying raw CLI steps everywhere