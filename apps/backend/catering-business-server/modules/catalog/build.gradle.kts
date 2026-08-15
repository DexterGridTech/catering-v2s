plugins {
    `java-library`
}

sourceSets {
    main {
        java.srcDir("../../../../../contracts")
    }
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:execution-context"))
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:asset"))
    implementation(project(":apps:backend:catering-business-server:modules:inventory"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation(project(":apps:backend:catering-business-server:modules:fulfillment-production"))
    implementation(project(":apps:backend:catering-business-server:modules:workspace-iam"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
    // Catalog maps one PostgreSQL partial-unique constraint to the owner-level
    // conflict contract, so the driver exception type is a production dependency.
    implementation("org.postgresql:postgresql:42.7.7")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.mockito:mockito-core:5.17.0")
    testImplementation("org.testcontainers:junit-jupiter:1.21.4")
    testImplementation("org.testcontainers:postgresql:1.21.4")
    testImplementation("org.flywaydb:flyway-core:11.11.2")
    testImplementation("org.flywaydb:flyway-database-postgresql:11.11.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
