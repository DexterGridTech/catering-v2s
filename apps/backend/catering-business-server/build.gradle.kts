import java.io.File

plugins {
    java
}

apply(plugin = "org.springframework.boot")
apply(plugin = "io.spring.dependency-management")

val catalogInventoryP1BackendWireOutput = layout.buildDirectory.dir("generated/sources/catalog-inventory-p1/main/java")
val backendPerformanceM1CommandExecutionOutput = layout.buildDirectory.dir("generated/sources/backend-performance-m1-command-execution/main/java")
val catalogInventoryP1BackendWireInputs = listOf(
    "scripts/generate/catalog-inventory-p1.mjs",
    "contracts/policy/catalog-inventory-copy-policy.json",
    "contracts/policy/catalog-inventory-design-byte-coverage.json",
    "contracts/policy/catalog-inventory-media-assets.json",
    "contracts/policy/catalog-inventory-reference-path-matrix.json",
    "doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md",
    "doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md",
    "doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md",
    "doc/plans/platform/2026-08-08-v2s-catalog-reference-model-category-remediation-design-codex.md",
    "doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json",
    "doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-intake-codex.md"
).map { rootProject.file(it) }
val generateCatalogInventoryP1BackendWire = tasks.register<Exec>("generateCatalogInventoryP1BackendWire") {
    group = "build"
    description = "Generates catalog-family backend wire DTOs from the catalog contract."
    inputs.files(catalogInventoryP1BackendWireInputs)
    inputs.dir(rootProject.file("contracts/policy/catalog-inventory-p1-media"))
    inputs.property("catalogInventoryP1BackendWireSourceRoot", catalogInventoryP1BackendWireOutput.get().asFile.absolutePath)
    outputs.dir(catalogInventoryP1BackendWireOutput)
    workingDir(rootProject.projectDir)
    commandLine("node", rootProject.file("scripts/generate/catalog-inventory-p1.mjs").absolutePath)
}

val generateBackendPerformanceM1CommandExecutionBindings = tasks.register<Exec>("generateBackendPerformanceM1CommandExecutionBindings") {
    group = "build"
    description = "Generates typed operations command edge bindings from operation-handler bindings."
    dependsOn(generateCatalogInventoryP1BackendWire)
    inputs.files(
        rootProject.file("scripts/generate/backend-performance-m1-command-execution-bindings.mjs"),
        rootProject.file("contracts/registry/operation-handler-bindings.json")
    )
    inputs.dir(catalogInventoryP1BackendWireOutput)
    outputs.dir(backendPerformanceM1CommandExecutionOutput)
    workingDir(rootProject.projectDir)
    commandLine("node", rootProject.file("scripts/generate/backend-performance-m1-command-execution-bindings.mjs").absolutePath, "--emit")
}

sourceSets.named("main") {
    java.srcDir(catalogInventoryP1BackendWireOutput)
    java.srcDir(backendPerformanceM1CommandExecutionOutput)
}

tasks.named("compileJava") {
    dependsOn(generateCatalogInventoryP1BackendWire)
    dependsOn(generateBackendPerformanceM1CommandExecutionBindings)
}

dependencies {
    implementation(project(":apps:backend:catering-business-server:modules:execution-context"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:platform-admin-iam"))
    implementation(project(":apps:backend:catering-business-server:modules:workspace"))
    implementation(project(":apps:backend:catering-business-server:modules:asset"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation(project(":apps:backend:catering-business-server:modules:extension"))
    implementation(project(":apps:backend:catering-business-server:modules:workspace-iam"))
    implementation(project(":apps:backend:catering-business-server:modules:store-contract"))
    implementation(project(":apps:backend:catering-business-server:modules:audit-read"))
    implementation(project(":apps:backend:catering-business-server:modules:catalog"))
    implementation(project(":apps:backend:catering-business-server:modules:inventory"))
    implementation(project(":apps:backend:catering-business-server:modules:collaboration"))
    implementation(project(":apps:backend:catering-business-server:modules:business-channel"))
    implementation(project(":apps:backend:catering-business-server:modules:sales-menu"))
    implementation(project(":apps:backend:catering-business-server:modules:store-terminal"))
    implementation(project(":apps:backend:catering-business-server:modules:terminal-binding"))
    implementation(project(":apps:backend:catering-business-server:modules:terminal-control"))
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("com.fasterxml.jackson.core:jackson-databind")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
    testImplementation("org.postgresql:postgresql:42.7.7")
    testImplementation("org.testcontainers:junit-jupiter:1.21.4")
    testImplementation("org.testcontainers:postgresql:1.21.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val terminalDataServerProject = rootProject.project(":apps:backend:terminal-data-server")
val terminalDataServerBootJar = rootProject.file("apps/backend/terminal-data-server/build/libs/terminal-data-server.jar")
val terminalDataServerClasspathReport =
    terminalDataServerProject.layout.buildDirectory.file("reports/backend-acceptance/tds-runtime-classpaths.txt")
val backendAcceptanceClasspathReport =
    layout.buildDirectory.file("reports/backend-acceptance/runtime-classpaths.txt")
val verifyBackendAcceptanceRuntimeClasspaths = tasks.register("verifyBackendAcceptanceRuntimeClasspaths") {
    group = "verification"
    description = "Verifies isolated business acceptance and TDS runtime dependency graphs."
    dependsOn(":apps:backend:terminal-data-server:bootJar")
    dependsOn(":apps:backend:terminal-data-server:writeBackendAcceptanceTdsClasspathReport")
    inputs.files(configurations.named("testRuntimeClasspath"))
    inputs.file(terminalDataServerClasspathReport)
    outputs.file(backendAcceptanceClasspathReport)
    doLast {
        val businessClasspath = configurations.getByName("testRuntimeClasspath")
        val businessArtifacts = businessClasspath.resolvedConfiguration.resolvedArtifacts
            .map { artifact ->
                val id = artifact.moduleVersion.id
                "${id.group}:${artifact.name}:${id.version}"
            }
            .toSortedSet()
        val tdsClasspathValues = terminalDataServerClasspathReport.get().asFile.readLines()
            .mapNotNull { line ->
                val separator = line.indexOf('=')
                if (separator < 0) null else line.substring(0, separator) to line.substring(separator + 1)
            }
            .toMap()
        val tdsArtifacts = tdsClasspathValues.getValue("tdsRuntimeClasspath")
            .split(',')
            .filter(String::isNotBlank)
            .toSortedSet()
        val tdsTestArtifacts = tdsClasspathValues.getValue("tdsTestRuntimeArtifacts")
            .split(',')
            .filter(String::isNotBlank)
            .toSortedSet()
        val tdsTestRuntimeClasspath = tdsClasspathValues.getValue("tdsTestRuntimeClasspath")
        check(tdsTestRuntimeClasspath.isNotBlank()) { "TDS_TEST_RUNTIME_CLASSPATH_EMPTY" }
        val businessComponents = businessClasspath.incoming.resolutionResult.allComponents
            .map { it.id.displayName }
        check(businessArtifacts.any { it.startsWith("org.springframework.boot:spring-boot:") && it.endsWith(":4.1.0") }) {
            "BUSINESS_ACCEPTANCE_SPRING_BOOT_VERSION_MISMATCH:4.1.0"
        }
        check(businessComponents.none { it.contains(":apps:backend:terminal-data-server") }) {
            "BACKEND_ACCEPTANCE_TDS_ON_BUSINESS_TEST_RUNTIME_CLASSPATH"
        }
        val prohibitedTdsArtifacts = listOf(
            "catering-business-server",
            "platform-admin-iam",
            "organization",
            "extension",
            "catalog",
            "asset",
            "store-terminal",
            "flyway-core",
            "flyway-database-postgresql",
            "minio",
        )
        val prohibited = tdsArtifacts.filter { artifact ->
            val coordinates = artifact.split(':')
            coordinates.getOrNull(0) == "software.amazon.awssdk" ||
                prohibitedTdsArtifacts.any { it in coordinates }
        }
        check(prohibited.isEmpty()) {
            "TDS_RUNTIME_PROHIBITED_ARTIFACT:${prohibited.joinToString(",")}" 
        }
        fun requireVersion(module: String, version: String) {
            check(tdsArtifacts.any { it.startsWith("$module:") && it.endsWith(":$version") }) {
                "TDS_RUNTIME_VERSION_MISMATCH:$module:$version"
            }
        }
        requireVersion("org.springframework.boot:spring-boot", "4.1.0")
        requireVersion("io.projectreactor.netty:reactor-netty-http", "1.3.7")
        requireVersion("io.projectreactor:reactor-core", "3.8.7")
        check(tdsArtifacts.filter { it.startsWith("io.netty:") }.all { it.endsWith(":4.2.18.Final") }) {
            "TDS_RUNTIME_NETTY_VERSION_MISMATCH"
        }
        check(tdsTestArtifacts.any { artifact ->
            artifact.startsWith("io.projectreactor.tools:blockhound:") && artifact.endsWith(":1.0.17.RELEASE")
        }) {
            "TDS_TEST_BLOCKHOUND_VERSION_MISMATCH:1.0.17.RELEASE"
        }
        check(terminalDataServerBootJar.isFile) { "TDS_BOOT_JAR_MISSING" }
        val report = buildString {
            appendLine("schemaVersion=1")
            appendLine("businessTestRuntimeClasspath=${businessArtifacts.joinToString(",")}")
            appendLine("tdsRuntimeClasspath=${tdsArtifacts.joinToString(",")}")
            appendLine("tdsTestRuntimeClasspath=$tdsTestRuntimeClasspath")
            appendLine("tdsBootJar=${terminalDataServerBootJar.absolutePath}")
        }
        val reportFile = backendAcceptanceClasspathReport.get().asFile
        reportFile.parentFile.mkdirs()
        reportFile.writeText(report)
        println("BACKEND_ACCEPTANCE_CLASSPATH_REPORT=${reportFile.absolutePath}")
        println("BACKEND_ACCEPTANCE_BUSINESS_TEST_RUNTIME_ARTIFACTS=${businessArtifacts.size}")
        println("BACKEND_ACCEPTANCE_TDS_RUNTIME_ARTIFACTS=${tdsArtifacts.size}")
    }
}

tasks.named<Test>("test") {
    dependsOn(verifyBackendAcceptanceRuntimeClasspaths)
    systemProperty("v2s.acceptance.repository-root", rootProject.projectDir.absolutePath)
    systemProperty("v2s.acceptance.runtime-classpath-report", backendAcceptanceClasspathReport.get().asFile.absolutePath)
    systemProperty("v2s.acceptance.tds-boot-jar", terminalDataServerBootJar.absolutePath)
    systemProperty(
        "v2s.acceptance.registration-race-red-control",
        providers.gradleProperty("v2s.acceptance.registration-race-red-control").getOrElse("false"),
    )
}

// The architecture selector is a static Java test surface, while the app-level
// test task also contains Docker-backed tests and is therefore remote-gated.
// Keep this selector on a JavaExec lane without weakening the root
// Testcontainers guard or pretending that a local JVM is remote.
val foundationProject = project(":apps:backend:catering-business-server:modules:foundation")
val backendTestClasses = tasks.named("testClasses")
val foundationTestClasses = foundationProject.tasks.named("testClasses")
val foundationTestOutput = foundationProject.extensions
    .getByType<org.gradle.api.tasks.SourceSetContainer>()["test"].output
tasks.register<JavaExec>("backendModuleBoundariesArchunitSelector") {
    group = "verification"
    description = "Runs only the backend ArchUnit module-boundary selector without Docker-backed tests."
    dependsOn(backendTestClasses, foundationTestClasses)
    classpath = sourceSets["test"].runtimeClasspath + foundationTestOutput
    mainClass.set("architecture.BackendModuleBoundariesSelector")
}

tasks.register<JavaExec>("managedInvitationBootstrap") {
    group = "verification"
    description = "Runs the managed non-web workspace invitation bootstrap for isolated L2 fixtures."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.catering.v2s.app.bootstrap.ManagedInvitationBootstrap")
}
