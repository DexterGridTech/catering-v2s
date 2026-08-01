plugins {
    `java-library`
}

dependencies {
    api(project(":apps:backend:catering-business-server:modules:audit-model"))
    api(project(":apps:backend:catering-business-server:modules:execution-context"))
    implementation(project(":apps:backend:catering-business-server:modules:foundation"))
    implementation(project(":apps:backend:catering-business-server:modules:asset"))
    implementation(project(":apps:backend:catering-business-server:modules:organization"))
    implementation("org.springframework.boot:spring-boot-starter-jdbc:4.1.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
