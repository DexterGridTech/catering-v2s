plugins {
    `java-library`
}

dependencies {
    api("org.springframework:spring-context:7.0.2")
    api("org.slf4j:slf4j-api:2.0.17")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
