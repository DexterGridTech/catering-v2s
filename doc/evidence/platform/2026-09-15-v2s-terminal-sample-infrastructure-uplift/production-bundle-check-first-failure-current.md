# Production-bundle checker invocation first failure

DATE=2026-09-15
COMMAND=`node tools/terminal-sample2/check-production-bundle.mjs`
BOUNDARY=Argument-validation failure only; no APK was read and no app/device/dynamic resource was started.

The helper exited `1` before inspecting a bundle because its required `--apk <release.apk>`
argument was omitted:

```text
Error: Usage: node tools/terminal-sample2/check-production-bundle.mjs --apk <release.apk>
```

`FIRST_FAILURE`: invalid invocation, not a production source or APK failure.
`BROKEN_BOUNDARY`: checker argument validation -> bundle inspection.
`LAST_KNOWN_GOOD`: none for this invocation; the source/static and U8 focused gates remain
independent and green in their own records.
`NEXT`: after a forced current-source release build, invoke the helper once per bound APK with
the explicit relative APK path and retain its output.

