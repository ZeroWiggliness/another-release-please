# `node` Package Manifest

Use `node` when the package version lives in the top-level `version` field of `package.json`.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target file | `package.json` under the manifest path |
| File type | `text` |
| Version pattern | `"version":\s*"([^"]+)"` |
| Default prerelease identifier | `prerelease` |

## Example

```json
{
  "path": "packages/web",
  "version": "1.4.0",
  "type": "node"
}
```

## Notes

- explicit `files` entries are ignored for `node`
- use `custom` instead if you need to update additional files alongside `package.json`