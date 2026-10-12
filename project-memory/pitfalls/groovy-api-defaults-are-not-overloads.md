---
id: pitfalls.groovy-api-defaults-are-not-overloads
status: active
layer: routed
taskKinds: ["implementation","review","testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform"]
impacts: ["architecture","evidence"]
triggers: ["third-party-api","build-failure"]
assertions: ["VERIFY_DSL_CALL_SHAPE_AGAINST_RESOLVED_API"]
sourceRefs: ["doc/platform/third-party-library-usage-standard.md","https://developer.android.com/reference/tools/gradle-api/8.12/com/android/build/api/variant/ApplicationAndroidComponentsExtension"]
---

# Kotlin API defaults do not make Groovy calls optional

When a build script calls a third-party API through Groovy DSL, check the exact
resolved API signature and invoke its required arguments explicitly. A Kotlin
default parameter shown in a Kotlin example is not a Java overload available to
Groovy. For AGP 8.12, `AndroidComponentsExtension.onVariants` takes both a
`VariantSelector` and a callback; use an explicit `selector().all()` when all
variants are intended. The shared TER artifact script is applied by both
Android applications, so a build proof must cover the affected app invocation.
