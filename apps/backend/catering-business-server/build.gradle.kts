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
    testImplementation("org.testcontainers:junit-jupiter:1.21.4")
    testImplementation("org.testcontainers:postgresql:1.21.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
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
