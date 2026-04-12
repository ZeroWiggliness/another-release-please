# `csharp` Package Manifest

Use `csharp` for .NET projects that version their packages in `.csproj` files.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target files | `**/*.csproj` below the manifest path |
| File type | `xml` |
| Version pattern | `<Version>` inside `<PropertyGroup>` |
| Default prerelease identifier | `alpha` |

## Example

```json
{
  "path": "src/MyLibrary",
  "version": "3.2.0",
  "type": "csharp"
}
```

## Notes

- explicit `files` entries are ignored for `csharp`
- the built-in pattern is intentionally scoped to `<PropertyGroup>` so dependency versions on `<PackageReference>` entries are not rewritten
- the current implementation only updates `<Version>`, not `VersionSuffix`