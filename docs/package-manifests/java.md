# `java` Package Manifest

Use `java` for Maven projects where the release version is defined in `pom.xml`.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target files | `**/pom.xml` below the manifest path |
| File type | `xml` |
| Version pattern | Project-level `<version>` within `<project>` |
| Default prerelease identifier | `SNAPSHOT` |

## Example

```json
{
  "path": "services/api",
  "version": "2.0.0",
  "type": "java"
}
```

## Notes

- explicit `files` entries are ignored for `java`
- the built-in pattern targets the project version and avoids rewriting dependency versions under `<parent>` or dependency declarations