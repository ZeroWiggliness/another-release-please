# `custom` Package Manifest

Use `custom` when the built-in processors do not match the repository layout or when version fields live across multiple files and formats.

## What Makes `custom` Different

`custom` is the only built-in manifest type that does not derive its own file targets. You must provide a non-empty `files` array in the manifest entry.

```json
{
  "path": "services/api",
  "version": "2.4.0",
  "type": "custom",
  "files": [
    {
      "path": "services/api/package.json",
      "filetype": "json",
      "versionPatterns": ["version"]
    }
  ]
}
```

If `files` is missing or empty, config loading fails before command execution.

## File Entry Shape

Each file entry contains:

- `path`: file path or glob, relative to the repository root
- `filetype`: `text`, `xml`, `json`, or `yaml`
- `versionPatterns`: one or more patterns interpreted according to the file type

## Pattern Semantics

| File type | Pattern behavior |
| --- | --- |
| `text` | JavaScript regex. Capture group 1 is replaced when present; otherwise the full match is replaced. |
| `xml` | Same regex behavior as `text`. |
| `json` | Dot-notation key paths in parsed JSON. |
| `yaml` | Dot-notation key paths in parsed YAML. |

## How To Build A Custom Manifest

1. Set `path` to the package root so change detection is predictable.
2. Choose `type: "custom"`.
3. Add one or more `files` entries.
4. Prefer `json` and `yaml` key paths over regex when the file format allows it.
5. Use `--dry-run --debug` to confirm the selected files and replacements before enabling write operations in CI.

## Example: Mixed File Types

```json
{
  "path": "services/api",
  "version": "2.4.0",
  "type": "custom",
  "versionPrefix": "api-",
  "identifier": "beta",
  "identifierBase": "1",
  "files": [
    {
      "path": "services/api/version.txt",
      "filetype": "text",
      "versionPatterns": ["(.*)"]
    },
    {
      "path": "services/api/package.json",
      "filetype": "json",
      "versionPatterns": ["version"]
    },
    {
      "path": "services/api/Chart.yaml",
      "filetype": "yaml",
      "versionPatterns": ["version", "appVersion"]
    },
    {
      "path": "services/api/pom.xml",
      "filetype": "xml",
      "versionPatterns": ["<version>([^<]+)</version>"]
    }
  ]
}
```

## Recipes

### Version Text File And Node Package

```json
{
  "path": "packages/web",
  "version": "1.3.0",
  "type": "custom",
  "files": [
    {
      "path": "packages/web/version.txt",
      "filetype": "text",
      "versionPatterns": ["(.*)"]
    },
    {
      "path": "packages/web/package.json",
      "filetype": "json",
      "versionPatterns": ["version"]
    }
  ]
}
```

### Multiple YAML Fields

```json
{
  "path": "deploy/app",
  "version": "1.8.0",
  "type": "custom",
  "files": [
    {
      "path": "deploy/app/values.yaml",
      "filetype": "yaml",
      "versionPatterns": ["image.tag", "appVersion"]
    }
  ]
}
```

### Regex Updating A Text-Based Build File

```json
{
  "path": "services/api",
  "version": "2.4.0",
  "type": "custom",
  "files": [
    {
      "path": "services/api/build.gradle",
      "filetype": "text",
      "versionPatterns": ["version = '([^']+)'"]
    }
  ]
}
```

## Caveats

- keep file paths relative to the repository root, not the manifest path
- unmatched globs do not fail loudly unless you inspect debug output
- overlapping file patterns can be hard to reason about, so keep one clear owner per file when possible
- built-in manifest processors ignore `files`, but `custom` depends on them entirely