plugins {
    `java-library`
}

/** Value-only audit API. It deliberately owns neither schema nor persistence adapter. */

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind:2.19.1")
}
