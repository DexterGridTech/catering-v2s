import java.io.File
import java.security.MessageDigest

plugins {
    java
}

apply(plugin = "org.springframework.boot")
apply(plugin = "io.spring.dependency-management")

description = "Single-node terminal WebSocket transport runtime; not a business deployable or TDP."

configure<io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension> {
    imports {
        mavenBom("io.projectreactor:reactor-bom:2025.0.7")
        mavenBom("io.netty:netty-bom:4.2.18.Final")
    }
}

dependencies {
    implementation(project(":apps:backend:catering-business-server:modules:terminal-binding"))
    implementation(project(":apps:backend:catering-business-server:modules:execution-context"))
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("io.projectreactor:reactor-core")
    implementation("io.projectreactor.netty:reactor-netty-core")
    implementation("io.projectreactor.netty:reactor-netty-http")
    implementation("io.netty:netty-common")
    implementation("io.netty:netty-codec-base")
    implementation("io.netty:netty-codec-compression")
    implementation("io.netty:netty-codec-http")
    implementation("io.netty:netty-transport")
    implementation("org.postgresql:postgresql")
    implementation("tools.jackson.core:jackson-core")
    implementation("tools.jackson.core:jackson-databind")
    implementation("org.slf4j:slf4j-api")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.netty:netty-buffer")
    testImplementation("io.projectreactor.tools:blockhound:1.0.17.RELEASE")
    testImplementation("com.tngtech.archunit:archunit:1.4.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test>().configureEach {
    jvmArgs("-XX:+AllowRedefinitionToAddDeleteMethods")
    systemProperty("junit.jupiter.extensions.autodetection.enabled", "true")
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    mainClass.set("com.catering.v2s.terminaldataserver.TerminalDataServerApplication")
    archiveFileName.set("terminal-data-server.jar")
}

val terminalConnectionProtocolSource =
    rootProject.file("contracts/protocol/terminal-connection-protocol.json")
val terminalConnectionProtocolClasspathCopy =
    layout.buildDirectory.file("resources/main/protocol/terminal-connection-protocol.json")

val processTdsResources =
    tasks.named<org.gradle.language.jvm.tasks.ProcessResources>("processResources") {
        from(terminalConnectionProtocolSource) {
            into("protocol")
        }
    }

val verifyTerminalConnectionProtocolResource = tasks.register("verifyTerminalConnectionProtocolResource") {
    dependsOn(processTdsResources)
    inputs.file(terminalConnectionProtocolSource)
    inputs.file(terminalConnectionProtocolClasspathCopy)

    doLast {
        val classpathCopy = terminalConnectionProtocolClasspathCopy.get().asFile
        check(classpathCopy.isFile) {
            "TDS_PROTOCOL_RESOURCE_MISSING: protocol/terminal-connection-protocol.json"
        }

        val digest = MessageDigest.getInstance("SHA-256")
        val sourceDigest = digest.digest(terminalConnectionProtocolSource.readBytes())
        val classpathDigest = digest.digest(classpathCopy.readBytes())
        check(MessageDigest.isEqual(sourceDigest, classpathDigest)) {
            "TDS_PROTOCOL_RESOURCE_DIGEST_MISMATCH: protocol/terminal-connection-protocol.json"
        }
    }
}

tasks.named("check") {
    dependsOn(verifyTerminalConnectionProtocolResource)
}

val backendAcceptanceTdsClasspathReport =
    layout.buildDirectory.file("reports/backend-acceptance/tds-runtime-classpaths.txt")
val writeBackendAcceptanceTdsClasspathReport = tasks.register("writeBackendAcceptanceTdsClasspathReport") {
    group = "verification"
    description = "Resolves and reports the TDS-owned runtime classpaths for backend acceptance."
    dependsOn(tasks.named("testClasses"))
    val testSourceSetRuntimeClasspath = sourceSets.getByName("test").runtimeClasspath
    inputs.files(configurations.named("runtimeClasspath"), testSourceSetRuntimeClasspath)
    outputs.file(backendAcceptanceTdsClasspathReport)

    doLast {
        val runtimeClasspath = configurations.getByName("runtimeClasspath")
        val testRuntimeClasspath = configurations.getByName("testRuntimeClasspath")
        fun artifactCoordinates(configuration: org.gradle.api.artifacts.Configuration): Set<String> =
            configuration.resolvedConfiguration.resolvedArtifacts
                .map { artifact ->
                    val id = artifact.moduleVersion.id
                    "${id.group}:${artifact.name}:${id.version}"
                }
                .toSortedSet()

        val runtimeArtifacts = artifactCoordinates(runtimeClasspath)
        val testRuntimeArtifacts = artifactCoordinates(testRuntimeClasspath)
        check(testRuntimeArtifacts.any { artifact ->
            artifact.startsWith("io.projectreactor.tools:blockhound:") && artifact.endsWith(":1.0.17.RELEASE")
        }) {
            "TDS_TEST_BLOCKHOUND_VERSION_MISMATCH:1.0.17.RELEASE"
        }

        val report = buildString {
            appendLine("tdsRuntimeClasspath=${runtimeArtifacts.joinToString(",")}")
            appendLine("tdsTestRuntimeArtifacts=${testRuntimeArtifacts.joinToString(",")}")
            appendLine("tdsTestRuntimeClasspath=${testSourceSetRuntimeClasspath.files
                .joinToString(File.pathSeparator) { it.absolutePath }}")
        }
        val reportFile = backendAcceptanceTdsClasspathReport.get().asFile
        reportFile.parentFile.mkdirs()
        reportFile.writeText(report)
        println("BACKEND_ACCEPTANCE_TDS_CLASSPATH_REPORT=${reportFile.absolutePath}")
        println("BACKEND_ACCEPTANCE_TDS_RUNTIME_ARTIFACTS=${runtimeArtifacts.size}")
        println("BACKEND_ACCEPTANCE_TDS_TEST_RUNTIME_ARTIFACTS=${testRuntimeArtifacts.size}")
    }
}
