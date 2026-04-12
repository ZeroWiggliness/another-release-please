# Contributing

Welcome, and thanks for your interest in contributing! This project is a
TypeScript CLI built with Yarn and tested with Jest. This guide covers
everything you need to get up and running locally.

## Local Setup

```bash
corepack enable
yarn install
yarn build
```

If you want to work through the published container instead of a local Node.js runtime, start with:

```bash
docker pull darrenv/another-release-please:latest
```

The compiled CLI entry point is:

```text
dist/bin/arp.js
```

## Common Commands

- `yarn build`: compile TypeScript into `dist/`
- `yarn test`: run the Jest test suite
- `yarn test:coverage`: run tests with coverage output in `coverage/`
- `yarn clean`: remove `dist/`
- `yarn start`: build and run the CLI
- `yarn dev`: rebuild and run in watch mode

## Development Workflow

Recommended loop:

> [!TIP]
> Use `--dry-run` when testing changes to release behaviour. You get the full
> calculated result without touching the provider.

1. update code or docs
2. run `yarn build`
3. run `yarn test`
4. run targeted CLI commands in dry-run mode when changing release behavior

Example:

```bash
node ./dist/bin/arp.js \
  --provider github \
  --repository https://github.com/owner/repo \
  --target-branch main \
  --dry-run \
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
  release-pr
```

## Documentation Changes

Documentation lives in:

- the top-level `README.md` for project overview and quick-start guidance
- `docs/` for focused guides and deeper operational details

When you add or materially change behavior, update the relevant guide in `docs/`
and the root README if the change affects first-use instructions.

## Testing Notes

- tests live under `test/`
- Jest is configured through `jest.config.cjs`
- TypeScript is compiled with the settings in `tsconfig.json`
- coverage output is written to `coverage/`

If you change release calculation, manifest processing, or provider behavior,
prefer adding or updating tests in the matching command, config, manifest, or
provider test folder.

## Style And Tooling Notes

- local imports in main code use `.js` extensions
- the repository uses ESM TypeScript output
- `.editorconfig` defines UTF-8, LF, and two-space indentation
- Yarn 4 is the package manager for this repository

## Useful Reference Docs

- [Commands](commands/README.md)
- [Configuration](advanced/configuration.md)
- [Manifests](advanced/manifests.md)
- [Custom Manifest Authoring](package-manifests/custom.md)
- [Repository Files](repository-files.md)

← Back to [Home](README.md)
