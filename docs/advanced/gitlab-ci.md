# GitLab CI/CD

The repository ships a GitLab CI example at [../../examples/ci/.gitlab-ci.yml](../../examples/ci/.gitlab-ci.yml). It models the release lifecycle as three stages:

1. `release` checks whether a release should be published and writes `RELEASE_CREATED` to a dotenv artifact.
2. `calculate-next` only runs when a release was created.
3. `release-pr` only runs when a release was not created.

## Example Pipeline Shape

The included example uses:

- a dedicated ARP container image
- provider token injection through `GITLAB_TOKEN`
- dotenv artifacts to pass release state between jobs
- rules that limit execution to the default branch or release branches

## Why This Split Works

- `release` is safe to run first because it only acts when a merged autorelease MR already exists
- `calculate-next` advances versions when a release just happened
- `release-pr` refreshes the next autorelease MR when no release was published in the current pipeline

## Adapting The Example

Adjust these values before using the example directly:

- the container image tag
- repository branch rules
- whether you want prerelease mode on `calculate-next`
- whether the pipeline should use the local filesystem or provider APIs

Start from [../../examples/ci/.gitlab-ci.yml](../../examples/ci/.gitlab-ci.yml) rather than rebuilding the orchestration from scratch.