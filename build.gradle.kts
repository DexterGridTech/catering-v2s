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
    }
}
