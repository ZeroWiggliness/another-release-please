# `simple` Package Manifest

Use `simple` when the package version lives in `version.txt`.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target file | `version.txt` under the manifest path |
| File type | `text` |
| Version pattern | `(.*)` |
| Default prerelease identifier | `prerelease` |

## Example

```json
{
  "path": ".",
  "version": "1.0.0",
  "type": "simple"
}
```

## Notes

- explicit `files` entries are ignored for `simple`
- the processor always derives a single `version.txt` target from the manifest path