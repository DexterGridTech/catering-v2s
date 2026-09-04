buildscript {
    repositories {
        maven { url = uri("https://repo.maven.apache.org/maven2") }
        gradlePluginPortal()
        mavenCentral()
    }
    configurations.classpath {
        resolutionStrategy.eachDependency {
            if (requested.group == "commons-io") {
                useVersion("2.22.0")
            }
        }
    }
    dependencies {
        classpath("org.springframework.boot:spring-boot-gradle-plugin:4.1.0")
        classpath("io.spring.gradle:dependency-management-plugin:1.1.7")
    }
}

plugins {
    java
    id("com.diffplug.spotless") version "7.0.2"
}

spotless {
    java {
        target("src/**/*.java")
        targetExclude(
            "**/app/edge/generated/**",
            "**/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java",
            "**/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java",
            "**/build/generated/**",
        )
        palantirJavaFormat("2.39.0").formatJavadoc(true)
        toggleOffOn()
        trimTrailingWhitespace()
        endWithNewline()
    }
}

allprojects {
    group = "com.catering.v2s"
    version = "0.1.0-SNAPSHOT"
}

subprojects {
    // The settings include the aggregate :apps and :apps:backend projects implicitly.
    // They have no source of their own; keep Spotless' bookkeeping out of the source tree
    // while leaving real application/module build directories unchanged.
    if (path == ":apps" || path == ":apps:backend") {
        val aggregateBuildName = path.removePrefix(":").replace(":", "-")
        layout.buildDirectory.set(
            rootProject.layout.projectDirectory.dir(".runtime/gradle-build/$aggregateBuildName"),
        )
    }

    apply(plugin = "java")
    apply(plugin = "pmd")
    apply(plugin = "com.diffplug.spotless")

    extensions.configure<com.diffplug.gradle.spotless.SpotlessExtension> {
        java {
            target("src/**/*.java")
            targetExclude(
                "**/app/edge/generated/**",
                "**/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java",
                "**/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java",
                "**/build/generated/**",
            )
            palantirJavaFormat("2.39.0").formatJavadoc(true)
            toggleOffOn()
            trimTrailingWhitespace()
            endWithNewline()
        }
    }

    val backendJavaUtf8LineLimit = tasks.register("backendJavaUtf8LineLimit") {
        group = "verification"
        description = "Checks the backend Java source set for UTF-8 lines over 120 bytes."
        doLast {
            val violations = fileTree(projectDir) {
                include("src/**/*.java")
                exclude(
                    "**/app/edge/generated/**",
                    "**/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java",
                    "**/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java",
                    "**/build/generated/**",
                )
            }.files.flatMap { source ->
                source.readLines(Charsets.UTF_8).mapIndexedNotNull { index, line ->
                    val bytes = line.toByteArray(Charsets.UTF_8).size
                    if (bytes > 120) "${source.relativeTo(projectDir)}:${index + 1}:$bytes" else null
                }
            }
            if (violations.isNotEmpty()) {
                throw GradleException("BACKEND_JAVA_UTF8_LINE_LIMIT:120:${violations.take(3).joinToString()}")
            }
        }
    }

    tasks.named("spotlessCheck") {
        dependsOn(backendJavaUtf8LineLimit)
    }

    extensions.configure<org.gradle.api.plugins.quality.PmdExtension> {
        toolVersion = "7.17.0"
        isIgnoreFailures = false
        isConsoleOutput = true
        ruleSetFiles = files(rootProject.file("tools/verify-gates/preserve-stack-trace.xml"))
        ruleSets = emptyList()
    }

    tasks.withType<org.gradle.api.plugins.quality.Pmd>().configureEach {
        exclude("**/app/edge/generated/wire/**")
        exclude("**/build/generated/**")
        reports.xml.required.set(true)
        reports.html.required.set(false)
    }

    java {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(21))
        }
    }

    tasks.withType<JavaCompile>().configureEach {
        options.encoding = "UTF-8"
        options.release.set(21)
        options.compilerArgs.add("-parameters")
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
        val dockerMarkers = listOf(
            "org.testcontainers",
            "@Testcontainers",
            "PostgreSQLContainer",
            "JdbcDatabaseContainer",
            "GenericContainer",
        )
        val dockerBackedTest = fileTree(projectDir) {
            include("src/test/**/*.java", "src/test/**/*.kt", "src/test/**/*.groovy")
        }.files.any { source ->
            val text = source.readText()
            dockerMarkers.any(text::contains)
        }
        if (dockerBackedTest) {
            // Testcontainers tests observe an external Docker/database state. A Gradle
            // cached or up-to-date Test task can report success without executing the
            // selected test, which makes the managed runner lose its business evidence.
            // Keep compilation/build preparation cacheable, but never reuse the Docker-backed
            // Test task result itself.
            outputs.upToDateWhen { false }
            outputs.cacheIf("Docker-backed tests require a fresh execution") { false }
        }
        doFirst {
            // Docker-backed tests are a remote technical-validation lane. Never let Gradle/Testcontainers
            // auto-discover a developer's local Docker socket; scripts/test/r5-remote-testcontainers.mjs
            // is the only approved entry and marks the remote JVM explicitly before this task starts.
            if (dockerBackedTest && System.getenv("V2S_TESTCONTAINERS_EXECUTION_PLANE") != "remote") {
                throw GradleException(
                    "V2S_TESTCONTAINERS_REMOTE_REQUIRED: Docker-backed tests must run through " +
                        "scripts/test/r5-remote-testcontainers.mjs on the remote development host; " +
                        "local Docker discovery is forbidden.",
                )
            }
        }
    }
}

tasks.register("backendPmdPreserveStackTrace") {
    group = "verification"
    description = "Runs the curated backend PMD PreserveStackTrace rule only."
    dependsOn(
        subprojects
            .filter { it.path.startsWith(":apps:backend:catering-business-server") }
            .map { it.tasks.named("pmdMain") },
    )
}

tasks.named("spotlessCheck") {
    dependsOn(subprojects.map { it.tasks.named("spotlessCheck") })
}

tasks.named("spotlessApply") {
    dependsOn(subprojects.map { it.tasks.named("spotlessApply") })
}
