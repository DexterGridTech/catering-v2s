plugins {
    `java-library`
}

sourceSets {
    main {
        resources {
            srcDir("../../../../../contracts/policy")
            include("runtime-environment-keys.json")
        }
    }
}

dependencies {
    api("org.springframework:spring-context:7.0.2")
    api("org.slf4j:slf4j-api:2.0.17")
    api("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    api("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.junit.platform:junit-platform-launcher")
}
