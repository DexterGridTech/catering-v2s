# TER Stage B CP-01 implementation proof

`CP=CP-01` · `STATUS=IMPLEMENTATION_PROOF_WITH_STATIC_HANDOFF` · `REVIEW=MATCHED`

This record covers only CP-01 on the current bytes. It is not a Stage A or Stage B overall verdict, and it does not upgrade unrun update behavior to PASS.

Independent full-CP three-dimensional reconciliation: `MATCHED` (fresh read-only reviewer, 2026-10-09). The reviewer reopened the current formal requirement, Stage B design/plan and applicable memory rules; verified current proof fingerprints, all 18 Stage B HTTP operation identities, the 13-operation terminal JSON consumer with binary exclusion, M1 emitter/self-test shape, IDENTITY_ONLY support, and the CP-03 deferral of real CBS rule adapters. No CP-01 OPEN remained. The reconciliation did not rerun commands; command outcomes below remain the recorded execution evidence, and Stage B dynamic behavior remains NOT_RUN.

## Current input and generated chain

Stage B's canonical chain is:

`contracts/openapi-source/terminal-update.schemas.json` + `contracts/openapi/paths/terminal/terminal-update.paths.json` + the R5 edge catalog, IAM manifest and admin catalog → `scripts/generate/r5-edge-materialize.mjs` → `scripts/generate/edge-codegen.mjs` → `scripts/generate/terminal-client-api.mjs`.

The CP-01 terminal JSON consumer contains 13 operation IDs. The three Stage B JSON operations are `terminalReadProjectUpdateRuleSnapshotPage`, `issueTerminalUpdateArtifactDownloadGrant`, and `submitTerminalUpdateReport`. The fourth terminal-facing operation, `downloadTerminalUpdateArtifact`, returns ZIP bytes and is explicitly excluded from the JSON client. The materialized route source is `contracts/openapi/paths/terminal/terminal-update.paths.json`; the selector source is not counted a second time as a generated edge capability.

The R5 operation denominator is 264, with face counts platform-admin 66, operations-admin 172, public 12, and terminal 14. The Stage B roster contains exactly these 18 HTTP operations: `stagePlatformTerminalUpdateArtifact`, `registerPlatformTerminalUpdateArtifact`, `releasePlatformTerminalUpdateArtifactStage`, `getPlatformTerminalUpdateArtifactPage`, `getPlatformTerminalUpdateArtifactDetail`, `getOperationsProjectTerminalVersionPage`, `getOperationsProjectTerminalUpdateRulePage`, `getOperationsProjectTerminalUpdateRuleDetail`, `createOperationsProjectTerminalUpdateRule`, `changeOperationsProjectTerminalUpdateRuleStatus`, `getOperationsTerminalUpdateArtifactCandidatePage`, `terminalReadProjectUpdateRuleSnapshotPage`, `issueTerminalUpdateArtifactDownloadGrant`, `downloadTerminalUpdateArtifact`, `getOperationsProjectTerminalUpdateRuleStorePage`, `getOperationsProjectTerminalVersionDetail`, `submitTerminalUpdateReport`, and `getOperationsProjectTerminalUpdateReportHistoryPage`.

## Actual resolved toolchain and upstream references

| Item | Current evidence | Official/version-specific reference |
| --- | --- | --- |
| Java | `java -version`: OpenJDK 21.0.12.1, Homebrew build, macOS host | Java SE 21 `ZipFile` API: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/zip/ZipFile.html |
| Android Gradle | Both sample Android projects declare Gradle wrapper 9.3.1 in `android/gradle/wrapper/gradle-wrapper.properties`; their own wrapper `help` completed | Version-pinned release notes: https://docs.gradle.org/9.3.1/release-notes.html; official wrapper behavior: https://docs.gradle.org/current/userguide/gradle_wrapper.html |
| Expo / React Native | Resolved package files: Expo 57.0.18 and React Native 0.86.3 | Versioned Expo SDK 57 reference: https://docs.expo.dev/versions/v57.0.0/; exact React Native release: https://github.com/react/react-native/releases/tag/v0.86.3 |
| Expo Android tool versions | Running the app's own `./gradlew help --no-daemon` reported Build Tools 36.0.0, compile/target SDK 36, Kotlin 2.1.20, KSP 2.1.20-2.0.1, NDK 27.1.12297006 | Installed Expo plugin source is `node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/com/expo/modules/plugin/ExpoRootProjectPlugin.kt`; the installed Build Tools `source.properties` reports revision 36.0.0. Official versioned setting: https://developer.android.com/tools/releases/build-tools |
| APK tooling | Installed `apksigner version` reports 0.9; installed `aapt2 version` reports `2.20-13193326` | https://developer.android.com/tools/apksigner and https://developer.android.com/tools/aapt2 |
| MinIO | `./gradlew :apps:backend:catering-business-server:modules:asset:dependencyInsight --dependency io.minio:minio --configuration runtimeClasspath --no-daemon` selected `io.minio:minio:8.5.17` | Pinned upstream source: https://github.com/minio/minio-java/blob/8.5.17/api/src/main/java/io/minio/MinioClient.java |

The app Gradle wrapper is required. An initial CP-01 configuration probe incorrectly used the repository-root Gradle 9.7 wrapper and failed while compiling Expo/RN settings plugins because its bundled Kotlin metadata was newer than the plugin compiler. That failed probe did not compile application code. The correct sample-terminal Android wrapper (9.3.1) subsequently completed `help` successfully and printed the resolved Expo Android versions above. No source or wrapper change was made to mask the first failure.

## Commands and results

| Command | Result |
| --- | --- |
| `node scripts/generate/r5-edge-materialize.mjs` | PASS, 264 operations, faces 66/172/12/14 |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --write` | PASS, 481 files |
| `node scripts/generate/terminal-client-api.mjs --write` | PASS, 13 terminal-client operations |
| `node --test scripts/test/terminal-client-generation.test.mjs` | PASS, 1 test; covers canonical reference normalization, idempotency policy, and binary exclusion |
| `node scripts/generate/r5-edge-materialize.mjs --check` | PASS, 264 operations, faces 66/172/12/14 |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --check` | PASS, 481 files |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --self-test` | PASS; red mutations reported PASS |
| `node scripts/generate/r5-edge-materialize.mjs --self-test` | PASS; red mutations reported PASS |
| `node scripts/generate/terminal-client-api.mjs --check` | PASS, 13 terminal-client operations |
| `node scripts/build/terminal-update-artifact.mjs --self-test` | PASS; package identity, ZIP entry, manifest/resource and output-bound red assertions reported PASS |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` | PASS, exit 0 |
| `./gradlew help --no-daemon` from `apps/terminal/application/android/sample-terminal/android` | PASS, app wrapper 9.3.1; reports Build Tools 36.0.0 and Expo SDK versions above |
| `./gradlew :apps:backend:catering-business-server:modules:asset:dependencyInsight --dependency io.minio:minio --configuration runtimeClasspath --no-daemon` | PASS, selects MinIO 8.5.17 |
| `node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --check` | PASS, 122 M1 command identities, including the two Stage B rule operations |
| `node scripts/generate/backend-performance-m1-command-execution-bindings.mjs --self-test` | PASS, red controls include each Stage B rule emitter and its typed adapter invocation |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node --test scripts/test/backend-performance-operation-reconciliation.test.mjs` | PASS, 6 pass / 0 fail / 1 intentionally skipped measured-budget case |
| `node --check scripts/dev/r5-dev-runner.mjs` | PASS |

## Error-set and generated operation closure

The 18 Stage B operations map to the existing catalog sets and current additions below; the base set remains owned by `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`:

| operationId | base errorSetRef | operation additions |
| --- | --- | --- |
| `stagePlatformTerminalUpdateArtifact` | `OWNER_COMMAND` | `TERMINAL_UPDATE_ARTIFACT_INVALID`, `PLATFORM_DEPENDENCY_UNAVAILABLE`, `TERMINAL_UPDATE_BUSY` |
| `registerPlatformTerminalUpdateArtifact` | `OWNER_COMMAND` | `TERMINAL_UPDATE_STAGE_NOT_OWNED`, `TERMINAL_UPDATE_STAGE_EXPIRED`, `TERMINAL_UPDATE_MINIMUM_FULL_INVALID`, `TERMINAL_UPDATE_PUBLICATION_CONFLICT` |
| `releasePlatformTerminalUpdateArtifactStage` | `OWNER_COMMAND` | `TERMINAL_UPDATE_STAGE_NOT_OWNED` |
| `getPlatformTerminalUpdateArtifactPage` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED`, `TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE` |
| `getPlatformTerminalUpdateArtifactDetail` | `AUTHZ_READ` | `PLATFORM_COMMON_RESOURCE_NOT_FOUND` |
| `getOperationsProjectTerminalVersionPage` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED`, `TERMINAL_UPDATE_SCOPE_MISMATCH`, `TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE` |
| `getOperationsProjectTerminalUpdateRulePage` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED`, `TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE` |
| `getOperationsProjectTerminalUpdateRuleDetail` | `AUTHZ_READ` | `PLATFORM_COMMON_RESOURCE_NOT_FOUND` |
| `createOperationsProjectTerminalUpdateRule` | `OWNER_COMMAND` | `TERMINAL_UPDATE_SCOPE_MISMATCH`, `TERMINAL_UPDATE_RULE_TARGET_INVALID`, `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT` |
| `changeOperationsProjectTerminalUpdateRuleStatus` | `OWNER_COMMAND` | `PLATFORM_COMMON_RESOURCE_NOT_FOUND`, `PLATFORM_COMMON_VERSION_CONFLICT`, `TERMINAL_UPDATE_RULE_TARGET_INVALID` |
| `getOperationsTerminalUpdateArtifactCandidatePage` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED`, `TERMINAL_UPDATE_SCOPE_MISMATCH` |
| `terminalReadProjectUpdateRuleSnapshotPage` | `TERMINAL_DATA_READ` | `TERMINAL_UPDATE_SNAPSHOT_CHANGED`, `TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE` |
| `issueTerminalUpdateArtifactDownloadGrant` | `TERMINAL_DATA_READ` | `TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED`, `TERMINAL_UPDATE_GRANT_EXPIRED`, `TERMINAL_UPDATE_BUSY` |
| `downloadTerminalUpdateArtifact` | `TERMINAL_UPDATE_CONTENT_READ` | `TERMINAL_UPDATE_GRANT_EXPIRED`, `TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED` |
| `getOperationsProjectTerminalUpdateRuleStorePage` | `AUTHZ_READ` | `PLATFORM_COMMON_RESOURCE_NOT_FOUND`, `PLATFORM_COMMON_VALIDATION_FAILED` |
| `getOperationsProjectTerminalVersionDetail` | `AUTHZ_READ` | `PLATFORM_COMMON_RESOURCE_NOT_FOUND` |
| `submitTerminalUpdateReport` | `TERMINAL_UPDATE_REPORT_WRITE` | `PLATFORM_COMMON_VALIDATION_FAILED`, `PLATFORM_COMMON_ACCESS_DENIED`, `PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED`, `PLATFORM_COMMON_RESOURCE_NOT_FOUND`, `PLATFORM_DEPENDENCY_UNAVAILABLE`, `TERMINAL_BINDING_CREDENTIAL_INVALID`, `PLATFORM_COMMON_RESULT_UNKNOWN`, `TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT` |
| `getOperationsProjectTerminalUpdateReportHistoryPage` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED`, `PLATFORM_COMMON_RESOURCE_NOT_FOUND` |

The operation catalog currently has 18 Stage B identities; the generated terminal JSON policy has 13 identities and excludes the binary ZIP download. `scripts/generate/r5-edge-materialize.mjs` emits the supported HTTP Problem response slots including 422 and 503. The error disposition source currently maps `PLATFORM_DEPENDENCY_UNAVAILABLE` to itself with `RETAIN`, and the Stage B native codes are active in that same canonical catalog. This is current-source evidence, not a claim that the later CBS owner handlers already exist. CP-03 still owns real application adapters and their `compileJava` proof.

Earlier Stage A D-S-1 focused tests/typecheck remain recorded in `doc/review/platform/2026-10-09-ter-version-update-stage-a-non-success-readback-intake-codex.md`. No Stage A full-device rerun was performed.

## Static A handoff scope and unverified behavior

`apps/terminal/kernel/base/platform-ports/src/types/update.ts` exposes six narrow `UpdatePort` calls: `readFacts`, `prepareArtifact`, `applyPrepared`, `readAction`, `confirmBoot`, and `releasePrepared`. `TerminalUpdateRuntime.selectedFacts` reads actual installed identity separately from the selected JS bundle version/publication; `scripts/build/terminal-update-artifact.mjs` records the FULL outer ZIP SHA-256, inner APK SHA-256, signing certificate, and content `publicationId` separately and emits `full-package.json`.

This is source and generator evidence only. Real FULL installation, ordinary HOT cold-start readiness, FULL unknown→success fixed-HOT continuation, admin-page flow, server report persistence, and single-machine dual-screen behavior remain `NOT_RUN` at CP-01 and are assigned to their later CP focused/managed runs. `OPEN_A_HANDOFF` here means those behaviors still need the Stage B planned real flow; it does not block source-level confirmation that CP-01 consumes the existing port/artifact shapes.

No CP-01 acceptance or production update flow was simulated. The only web evidence in this record is official-document lookup, not Expo Web business verification.

## Byte fingerprints

SHA-256 values bind the canonical/generator inputs and installed SDK tools observed for this CP-01 snapshot:

```text
5161860b9e87bf3b39d9b1cf4c84e8d8eed57ddb841d7aabeb4198bc62474b3d  contracts/openapi-source/terminal-update.schemas.json
c11147f6557c6cd10125f23a537acd8f51a7fb801845d102dc4f1ba2f69357a3  contracts/openapi/paths/terminal/terminal-update.paths.json
b5eff5621ea972ddc15d5f649df39841433cd98fd7038e969ec0efd07246cadc  contracts/policy/terminal-client-generation.json
a7c3aa2c576ec4fdc214ca8c063d674d3989102aa7647dcc873837aac0c5c685  contracts/policy/backend-performance-operation-counts.json
c3076a780c38f2182b1b85e979608b6ffbfd5de99f2e4139cb70ee5a2dcf3bd5  scripts/generate/terminal-client-api.mjs
d895e63e6fb659f49aa849c08f43167b78db3c972d8b56ec2d8ca726a7e3805e  doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
02406235afb5a93826399c0cfbe6ff5c941f0233acba6e3975f4bbd6a7a56cd4  doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json
eb9f2ae487ff8ab25ea704e387798d0d16cba93ad2515c0d01187a6348073419  contracts/registry/operation-handler-bindings.json
688994821749da3ac3cd4cde940be9f4146076c77dbb55d10e249efe4195c1f8  scripts/generate/backend-performance-m1-command-execution-bindings.mjs
af2ba067d67d9c323218b471b375200fa673d88f4b1864febe3e1fa61413b11c  scripts/test/backend-performance-operation-reconciliation.test.mjs
d895e63e6fb659f49aa849c08f43167b78db3c972d8b56ec2d8ca726a7e3805e  doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
7dee6632e9ad6cb111da2bb99d747211e27927061b1276d040bb1d71fded5ebb  $ANDROID_HOME/build-tools/36.0.0/source.properties
b47549e373b895ce6ca620d0c7887e674d9615ffa837a86ac601dcfd04adb0f0  $ANDROID_HOME/build-tools/36.0.0/apksigner
a8844d4089b442b034aed8953deee1893253053c900e03141ae7173e3edd8157  $ANDROID_HOME/build-tools/36.0.0/aapt2
```
