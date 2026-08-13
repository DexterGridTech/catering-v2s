plugins {
    `java-library`
    `java-test-fixtures`
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    api(project(":apps:backend:catering-business-server:modules:execution-context"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation(project(":apps:backend:catering-business-server:modules:extension"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.19.1")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.flywaydb:flyway-core:11.11.2")
    testImplementation("org.flywaydb:flyway-database-postgresql:11.11.2")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
    testImplementation("org.testcontainers:junit-jupiter:1.21.4")
    testImplementation("org.testcontainers:postgresql:1.21.4")
    testRuntimeOnly("org.postgresql:postgresql:42.7.7")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testFixturesImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:asset")))
}
