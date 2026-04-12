# `helm` Package Manifest

Use `helm` for Helm charts that store their chart version in `Chart.yaml`.

## Derived Behavior

| Property | Value |
| --- | --- |
| Target files | `**/Chart.yaml` below the manifest path |
| File type | `yaml` |
| Version pattern | `version` |
| Default prerelease identifier | `prerelease` |

## Example

```json
{
  "path": "charts/web",
  "version": "1.4.0",
  "type": "helm"
}
```

## Notes

- explicit `files` entries are ignored for `helm`
- the built-in processor only updates the chart `version` field; use `custom` if you also need to update `appVersion` or other YAML keys