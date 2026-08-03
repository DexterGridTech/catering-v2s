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
}

allprojects {
    group = "com.catering.v2s"
    version = "0.1.0-SNAPSHOT"
}

subprojects {
    apply(plugin = "java")

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
        doFirst {
            // Docker-backed tests are a remote technical-validation lane. Never let Gradle/Testcontainers
            // auto-discover a developer's local Docker socket; scripts/test/r5-remote-testcontainers.mjs
            // is the only approved entry and marks the remote JVM explicitly before this task starts.
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
