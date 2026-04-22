# `gradle` Package Manifest

Use `gradle` for Gradle projects where the release version is defined in `gradle.properties`, `build.gradle`, or `build.gradle.kts`.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target files | `gradle.properties`, `**/build.gradle`, `**/build.gradle.kts` below the manifest path |
| File type | `text` |
| Version patterns | `version=<value>` in `.properties`; `version = '<value>'` in Groovy DSL; `version = "<value>"` in Kotlin DSL |
| Default version prefix | *(none)* |
| Default prerelease identifier | `SNAPSHOT` |

## Example

```json
{
  "path": "services/api",
  "version": "2.0.0",
  "type": "gradle"
}
```

## Notes

- explicit `files` entries are ignored for `gradle`
- Gradle follows the Maven SNAPSHOT convention for pre-release builds: `2.0.0-SNAPSHOT`
- `gradle.properties` is resolved as a literal path at the root of the manifest path, not recursively
- `build.gradle` and `build.gradle.kts` use a `**/` glob to support multi-project builds where subprojects declare their own version
- the built-in patterns use a word boundary to avoid matching keys like `springVersion` or `ext.myVersion`
- files that do not exist in the repository are silently skipped by the glob matcher
