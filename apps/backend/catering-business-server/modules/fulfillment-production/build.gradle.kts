plugins {
    `java-library`
    `java-test-fixtures`
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:execution-context"))
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.mockito:mockito-core:5.17.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testFixturesImplementation(testFixtures(project(":apps:backend:catering-business-server:modules:asset")))
}
