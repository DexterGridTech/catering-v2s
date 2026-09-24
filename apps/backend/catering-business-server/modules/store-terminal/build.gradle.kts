plugins {
    `java-library`
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    api(project(":apps:backend:catering-business-server:modules:organization"))
    implementation(project(":apps:backend:catering-business-server:modules:catalog"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    implementation("org.postgresql:postgresql:42.7.7")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.mockito:mockito-core:5.17.0")
    testImplementation("org.testcontainers:junit-jupiter:1.21.4")
    testImplementation("org.testcontainers:postgresql:1.21.4")
    testImplementation("org.flywaydb:flyway-core:11.11.2")
    testImplementation("org.flywaydb:flyway-database-postgresql:11.11.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
