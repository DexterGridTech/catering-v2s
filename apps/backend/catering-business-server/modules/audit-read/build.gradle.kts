plugins {
    `java-library`
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:platform-admin-iam"))
    implementation(project(":apps:backend:catering-business-server:modules:workspace"))
    implementation(project(":apps:backend:catering-business-server:modules:workspace-iam"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation(project(":apps:backend:catering-business-server:modules:extension"))
    implementation(project(":apps:backend:catering-business-server:modules:store-contract"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testImplementation("org.mockito:mockito-core:5.17.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
