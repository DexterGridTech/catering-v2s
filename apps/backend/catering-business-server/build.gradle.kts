import java.io.File
import org.gradle.api.artifacts.ProjectDependency

plugins {
    java
}

apply(plugin = "org.springframework.boot")
apply(plugin = "io.spring.dependency-management")

val catalogInventoryP1BackendWireOutput = layout.buildDirectory.dir("generated/sources/catalog-inventory-p1/main/java")
val backendPerformanceM1CommandExecutionOutput = layout.buildDirectory.dir("generated/sources/backend-performance-m1-command-execution/main/java")
val catalogInventoryP1BackendWireInputs = listOf(
    "scripts/generate/catalog-inventory-p1.mjs",
    "contracts/registry/catalog-inventory-p1-backend-wire-inputs.json",
    "contracts/registry/backend-performance-m1-command-execution-matrix.json",
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
    description = "Generates the matrix-admitted catalog-family backend P1 wire DTOs."
    inputs.files(catalogInventoryP1BackendWireInputs)
    inputs.dir(rootProject.file("contracts/policy/catalog-inventory-p1-media"))
    inputs.property("catalogInventoryP1BackendWireSourceRoot", catalogInventoryP1BackendWireOutput.get().asFile.absolutePath)
    outputs.dir(catalogInventoryP1BackendWireOutput)
    workingDir(rootProject.projectDir)
    commandLine("node", rootProject.file("scripts/generate/catalog-inventory-p1.mjs").absolutePath)
}

val generateBackendPerformanceM1CommandExecutionBindings = tasks.register<Exec>("generateBackendPerformanceM1CommandExecutionBindings") {
    group = "build"
    description = "Generates source-anchored M1 command edge bindings."
    dependsOn(generateCatalogInventoryP1BackendWire)
    inputs.files(
        rootProject.file("scripts/generate/backend-performance-m1-command-execution-bindings.mjs"),
        rootProject.file("contracts/registry/backend-performance-m1-command-execution-matrix.json"),
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

// Capturing the Gradle model occurs after all projects are configured.  The task action below
// only walks the immutable repository-owned file candidates, so it never resolves a dependent
// module's classpath or reads a cross-project task graph while Gradle holds another project lock.
val backendAcceptanceSurfaceInputs = linkedMapOf<File, MutableSet<String>>()
gradle.projectsEvaluated {
    val repositoryRoot = rootProject.projectDir.toPath().toAbsolutePath().normalize()
    val excludedSegments = setOf("build", ".gradle", ".runtime", "node_modules")
    fun relative(file: File): String? {
        val candidate = file.toPath().toAbsolutePath().normalize()
        if (!candidate.startsWith(repositoryRoot)) return null
        val value = repositoryRoot.relativize(candidate).toString().replace(File.separatorChar, '/')
        return if (value.split('/').any { it in excludedSegments }) null else value
    }
    fun capture(file: File, owner: String) {
        val value = relative(file) ?: return
        if (!file.exists()) throw GradleException("BACKEND_ACCEPTANCE_GRADLE_INPUT_MISSING:$value")
        if (file.isDirectory) file.walkTopDown().filter { it.isFile }.forEach { child ->
            backendAcceptanceSurfaceInputs.getOrPut(child.canonicalFile) { sortedSetOf() }.add(owner)
        } else {
            backendAcceptanceSurfaceInputs.getOrPut(file.canonicalFile) { sortedSetOf() }.add(owner)
        }
    }
    val projects = linkedSetOf<org.gradle.api.Project>()
    fun includeProject(candidate: org.gradle.api.Project) {
        if (!projects.add(candidate)) return
        candidate.configurations.findByName("runtimeClasspath")?.allDependencies
            ?.withType(ProjectDependency::class.java)
            ?.forEach { dependency: ProjectDependency -> includeProject(rootProject.project(dependency.path)) }
    }
    includeProject(project)
    capture(rootProject.file("settings.gradle.kts"), "gradle-model:settings")
    capture(rootProject.buildFile, "gradle-model:root-build")
    val properties = rootProject.file("gradle.properties")
    if (properties.exists()) capture(properties, "gradle-model:properties")
    for (backendProject in projects.sortedBy { it.path }) {
        capture(backendProject.buildFile, "gradle-model:${backendProject.path}:build-script")
        val sourceSets = backendProject.extensions.findByType(org.gradle.api.tasks.SourceSetContainer::class.java)
            ?: throw GradleException("BACKEND_ACCEPTANCE_GRADLE_MAIN_SOURCE_SET_MISSING:${backendProject.path}")
        val main = sourceSets.findByName("main")
            ?: throw GradleException("BACKEND_ACCEPTANCE_GRADLE_MAIN_SOURCE_SET_MISSING:${backendProject.path}")
        main.allSource.files.forEach { source -> capture(source, "gradle-source-set:${backendProject.path}:main") }
        val generatedRoots = main.allSource.srcDirs.filter { source ->
            source.toPath().toAbsolutePath().normalize().startsWith(backendProject.layout.buildDirectory.get().asFile.toPath().toAbsolutePath().normalize())
        }
        for (generatedRoot in generatedRoots) {
            val generators = backendProject.tasks.filter { task ->
                (task is org.gradle.api.tasks.AbstractExecTask<*> || task is org.gradle.api.tasks.JavaExec)
                    && task.outputs.files.files.any { output ->
                        val outputPath = output.toPath().toAbsolutePath().normalize()
                        val generatedPath = generatedRoot.toPath().toAbsolutePath().normalize()
                        outputPath == generatedPath || outputPath.startsWith(generatedPath) || generatedPath.startsWith(outputPath)
                    }
            }
            if (generators.isEmpty()) throw GradleException("BACKEND_ACCEPTANCE_GRADLE_GENERATOR_SOURCE_ROOT_UNTRACKED:${backendProject.path}:${generatedRoot}");
            for (generator in generators) {
                val key = "${generator.project.path}:${generator.name}"
                generator.inputs.files.files.forEach { input -> capture(input, "gradle-generator:$key") }
            }
        }
    }
}

// Emits the repository-owned production inputs that Gradle actually uses for this deployable.
// The backend-acceptance impact owner consumes this report for both P0 and P1.
tasks.register("backendAcceptanceProductionSurface") {
    group = "verification"
    description = "Emits the Gradle-derived repository-owned production surface for backend acceptance."
    doLast {
        val repositoryRoot = rootProject.projectDir.toPath().toAbsolutePath().normalize()
        val excludedSegments = setOf("build", ".gradle", ".runtime", "node_modules")
        fun relative(file: File): String? {
            val candidate = file.toPath().toAbsolutePath().normalize()
            if (!candidate.startsWith(repositoryRoot)) return null
            val value = repositoryRoot.relativize(candidate).toString().replace(File.separatorChar, '/')
            return if (value.split('/').any { it in excludedSegments }) null else value
        }
        fun json(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
        val ownersByPath = sortedMapOf<String, MutableSet<String>>()
        for ((file, owners) in backendAcceptanceSurfaceInputs) {
            val value = relative(file) ?: continue
            if (!file.isFile) throw GradleException("BACKEND_ACCEPTANCE_GRADLE_INPUT_MISSING:$value")
            ownersByPath.getOrPut(value) { sortedSetOf() }.addAll(owners)
        }
        if (ownersByPath.isEmpty()) throw GradleException("BACKEND_ACCEPTANCE_GRADLE_SURFACE_EMPTY")
        val entries = ownersByPath.entries.joinToString(",") { (inputPath, owners) ->
            "{\"path\":${json(inputPath)},\"derivationOwner\":${json(owners.joinToString(";"))}}"
        }
        println("BACKEND_ACCEPTANCE_GRADLE_SURFACE={\"schemaVersion\":1,\"kind\":\"backend-acceptance-gradle-production-surface\",\"algorithmVersion\":\"V2_GRADLE_MODEL_MAIN_SOURCE_AND_TASK_INPUTS\",\"entries\":[$entries]}")
    }
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
    implementation(project(":apps:backend:catering-business-server:modules:fulfillment-production"))
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
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:asset")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:catalog")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:store-contract")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:extension")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:fulfillment-production")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:inventory")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:organization")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:platform-admin-iam")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:workspace")))
    testImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:workspace-iam")))
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
