# Current immutable install re-verification

COMMAND=`yarn install --immutable --mode=skip-build`
DATE=2026-09-15
BOUNDARY=Dependency resolution/link only; no application, Metro, DEV, Android, device, seed, UAT, deploy, or Git.

## Result

Exit code `0`. Yarn 4.17.0 completed resolution, post-resolution validation, fetch, and link.
It emitted `YN0002`/`YN0086` peer warnings, including existing workspace peer gaps and the
`assembly/base/android` `expo-modules-core` peer warning; these are warnings, not a lockfile
failure, and were not silently upgraded to a clean peer result.

The earlier lockfile mutation failure and its repair are preserved in
`yarn-install-first-failure-current.md` and `cp2-lock-closure.md`. This run confirms the current
lockfile is immutable after the package/graph cleanup. It does not prove native linking or release
APK behavior.

`FIRST_FAILURE`: none in this current immutable re-run.
`LAST_KNOWN_GOOD`: command exited 0 with warnings.
`BROKEN_BOUNDARY`: immutable install success -> native/build/device behavior.

