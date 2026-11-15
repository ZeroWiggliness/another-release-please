# Changelog Entries And Descriptions

One conventional commit can produce several changelog entries. Put each additional
standard conventional header (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`,
`test:`, `build:`, `ci:`, `style:`, `chore:`, or `revert:`) at the start of its
own line, outside code fences. Scopes and `!` are supported. Blank lines between
entries are recommended, but adjacent headers also work.

The first line must be a conventional commit header. Entries share the original
commit SHA and changed files. Entries are grouped by type, then sorted by scope
and subject; their displayed order need not match message order. The existing
writer does not display a `revert` section or unknown types. Chore eligibility
still depends on `release.includeChores`.

## Enable Descriptions

Add **top-level** `"includeDescription": true` to `.arp.config.json`.
Omitting it or setting it to `false` keeps the compact, bullet-only presentation.
Only JSON booleans are accepted, not `"true"` or `1`. There is no CLI flag,
environment variable, or per-manifest override for this setting.

```json
{
  "version": "1.0.0",
  "includeDescription": true,
  "release": {
    "prerelease": false,
    "targetBranch": "main"
  },
  "manifests": [
    { "path": ".", "type": "node", "version": "1.0.0" }
  ]
}
```

Descriptions preserve Markdown paragraphs, lists, relative indentation, links,
and fenced code, indented beneath their own bullet. They do not change entry
selection or version calculation. Issue auto-linking applies to subjects and
reference footers, not description text; write explicit Markdown links in a body.

Metadata trailers begin the footer portion of an entry. Their continuation lines
are not part of its description. `Refs`, `Fixes`, `Closes`, and `Resolves` produce
issue links; other trailers such as `Reviewed-by`, `PiperOrigin-RevId`, and
`Release-As` are not shown as description text. Put all description text before
the trailers. Do not write ordinary prose as an unindented `Token: value` line
unless it is intended as metadata; use prose, a list, or a code block instead.

Breaking notes stay in the dedicated breaking-changes section whether or not
descriptions are enabled. Both `BREAKING CHANGE:` and `BREAKING-CHANGE:` work,
including multiline notes. Footers belong to the immediately preceding entry.
This intentionally replaces the old behavior that only accepted a breaking
marker on the final line and attached it to the first entry.

## Copy-Pasteable Commit Commands

Use your editor for rich messages, or separate subject and body with `-m`:

```bash
git commit -m "feat: add search" -m "Search all records."
git commit -m "feat: add search" -m "Search all records." -m "fix: handle empty input"
```

These commands also work from PowerShell. For multiline Markdown, prefer
`git commit` and paste the complete message into your configured editor.
When squash-merging, retain the intended headers, descriptions, and footers in
the final squash commit message; intermediate PR/MR commits are not a substitute.

## Worked Examples

Every example supplies a config-file fragment, a complete commit message, and
the exact generated section. Merge the fragment into your existing config.
For reproducibility, examples start at version `1.0.0`, use commit SHA
`abc1234567890`, date `2026-04-02`, and repository
`https://github.com/owner/repo` unless another provider is specified.
Real links, versions, and dates come from your repository and release.

### Example 1: A Single Entry With Defaults

No option is needed for a basic bullet.

```json
{}
```

```text
feat: add search
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

---
_Generated on 2026-04-02_
```

### Example 2: Several Entries And Scopes

The single commit creates three bullets in their respective sections. Scoped
features sort before unscoped features.

```json
{}
```

```text
feat: add search

fix(parser): handle empty input

feat(api): add filters
```

```markdown
## v1.1.0

### Features
* *(api)* add filters ([abc1234](https://github.com/owner/repo/commit/abc1234567890))
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

### Bug Fixes
* *(parser)* handle empty input ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

---
_Generated on 2026-04-02_
```

### Example 3: Absent, False, And True

The same message always yields one entry and the same version. Only its
description's visibility changes.

#### Absent

```json
{}
```

```text
feat: add search

Search all records.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

---
_Generated on 2026-04-02_
```

#### Explicitly False

```json
{ "includeDescription": false }
```

```text
feat: add search

Search all records.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

---
_Generated on 2026-04-02_
```

#### Enabled

```json
{ "includeDescription": true }
```

```text
feat: add search

Search all records.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Search all records.

---
_Generated on 2026-04-02_
```

### Example 4: A Description For Each Entry

Neither description leaks into the other entry, even when entries are regrouped.

```json
{ "includeDescription": true }
```

```text
fix: handle empty input

Return an empty result.

feat(api): add search

Search all records.
```

```markdown
## v1.1.0

### Features
* *(api)* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Search all records.

### Bug Fixes
* handle empty input ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Return an empty result.

---
_Generated on 2026-04-02_
```

### Example 5: Rich Paragraphs

Paragraph breaks, emphasis, links, and inline code remain Markdown.

```json
{ "includeDescription": true }
```

```text
feat: add search

Find **anything** with `search()`.

Read [the guide](https://example.com/guide) for *examples*.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Find **anything** with `search()`.

  Read [the guide](https://example.com/guide) for *examples*.

---
_Generated on 2026-04-02_
```

Rendered preview of the entry:

* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Find **anything** with `search()`.

  Read [the guide](https://example.com/guide) for *examples*.

### Example 6: Nested Lists

Both kinds of list stay inside the changelog bullet. Existing relative
indentation is retained.

```json
{ "includeDescription": true }
```

```text
feat: add search

Highlights:

- Fast results
  - Cached queries
- Filters

Getting started:

1. Create a client.
2. Call search.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Highlights:

  - Fast results
    - Cached queries
  - Filters

  Getting started:

  1. Create a client.
  2. Call search.

---
_Generated on 2026-04-02_
```

### Example 7: Fenced Code Is Not Another Entry

A conventional-looking header or breaking marker inside a fence is only example
text. Backtick and tilde fences are supported.

```json
{ "includeDescription": true }
```

````text
feat: document message syntax

Example:

```text
fix!: example only
BREAKING CHANGE: not an actual breaking change
```
````

````markdown
## v1.1.0

### Features
* document message syntax ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Example:

  ```text
  fix!: example only
  BREAKING CHANGE: not an actual breaking change
  ```

---
_Generated on 2026-04-02_
````

### Example 8: Indented Headers Remain Description Text

Only unindented headers start additional entries. Four spaces make this an
indented Markdown code example.

```json
{ "includeDescription": true }
```

```text
feat: document syntax

An indented example:

    fix: not another entry
```

```markdown
## v1.1.0

### Features
* document syntax ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  An indented example:

      fix: not another entry

---
_Generated on 2026-04-02_
```

### Example 9: Some Entries Have No Description

An empty body does not introduce an empty description block.

```json
{ "includeDescription": true }
```

```text
feat: add search

fix: handle empty input

Return an empty result.
```

```markdown
## v1.1.0

### Features
* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

### Bug Fixes
* handle empty input ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Return an empty result.

---
_Generated on 2026-04-02_
```

### Example 10: Per-Entry Breaking Notes

Both spellings create breaking notes and a major bump. Migration text stays in
the breaking section, separate from the optional description. Each marker
belongs to the header immediately before it, not to the first entry globally.

```json
{ "includeDescription": true }
```

```text
feat(api): add search

Search all records.

BREAKING CHANGE: remove v1
Use v2 clients.

fix(auth): rename token

BREAKING-CHANGE: rename token to apiToken
Update your configuration.
```

```markdown
## v2.0.0

### ⚠ BREAKING CHANGES

* remove v1
  Use v2 clients. ([abc1234](https://github.com/owner/repo/commit/abc1234567890))
* rename token to apiToken
  Update your configuration. ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

### Features
* *(api)* add search ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Search all records.

### Bug Fixes
* *(auth)* rename token ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

---
_Generated on 2026-04-02_
```

### Example 11: References Without Metadata Leakage

Reference links stay on their entry line. Review and origin metadata, including
their continuation lines, do not become descriptions or extra entries.

```json
{ "includeDescription": true }
```

```text
feat: add search

Search all records.

Refs: #42
Reviewed-by: Reviewer
  Internal review context.
PiperOrigin-RevId: 123
```

```markdown
## v1.1.0

### Features
* add search — refs [#42](https://github.com/owner/repo/issues/42) ([abc1234](https://github.com/owner/repo/commit/abc1234567890))

  Search all records.

---
_Generated on 2026-04-02_
```

### Example 12: GitLab And Custom Issue Links

Examples above use GitHub links. Selecting GitLab changes commit and default
issue paths. A custom template changes issue URLs and displays a bare ticket ID.
In a real invocation, also pass the usual `--provider` and `--repository` options;
the config file's provider field alone does not select the CLI provider.

#### GitLab Defaults

```json
{ "provider": "gitlab", "includeDescription": true }
```

```text
feat: add search

Search all records.

Fixes: #42
```

```markdown
## v1.1.0

### Features
* add search — fixes [#42](https://gitlab.com/owner/repo/-/issues/42) ([abc1234](https://gitlab.com/owner/repo/-/commit/abc1234567890))

  Search all records.

---
_Generated on 2026-04-02_
```

#### GitLab With A Custom Tracker

```json
{
  "provider": "gitlab",
  "includeDescription": true,
  "issueUrlTemplate": "https://tracker.example.com/browse/{id}"
}
```

```text
feat: add search

Search all records.

Fixes: PROJ-42
```

```markdown
## v1.1.0

### Features
* add search — fixes [PROJ-42](https://tracker.example.com/browse/PROJ-42) ([abc1234](https://gitlab.com/owner/repo/-/commit/abc1234567890))

  Search all records.

---
_Generated on 2026-04-02_
```

## Where The Text Appears

`release-pr` writes the section to the root `CHANGELOG.md` and uses the same
section in the release PR/MR body. `release` embeds that merged body in provider
release notes. Toggling the setting later does not rewrite a merged release body.
`calculate-next` continues to calculate versions without generating a changelog.

This feature does not extract arbitrary PR/MR-body text or add release
introductions, custom sections, author attribution, compare headers, template
configuration, per-package changelogs, `BEGIN_COMMIT_OVERRIDE`, or nested blocks.
Unlike multiple-entry parsing, body descriptions are an ARP extension:
release-please's default notes renderer omits commit bodies too.

See [configuration.md](configuration.md) for all settings and
[../commands/release-pr.md](../commands/release-pr.md) for the command workflow.
