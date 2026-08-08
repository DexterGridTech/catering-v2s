pluginManagement {
    repositories {
        maven { url = uri("https://repo.maven.apache.org/maven2") }
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri("https://repo.maven.apache.org/maven2") }
        mavenCentral()
    }
}

rootProject.name = "catering-v2s"
include(":apps:backend:catering-business-server")
include(":apps:backend:terminal-data-server")
include(":apps:backend:catering-business-server:modules:execution-context")
include(":apps:backend:catering-business-server:modules:foundation")
include(":apps:backend:catering-business-server:modules:platform-admin-iam")
include(":apps:backend:catering-business-server:modules:workspace")
include(":apps:backend:catering-business-server:modules:asset")
include(":apps:backend:catering-business-server:modules:organization")
include(":apps:backend:catering-business-server:modules:extension")
include(":apps:backend:catering-business-server:modules:workspace-iam")
include(":apps:backend:catering-business-server:modules:store-contract")
include(":apps:backend:catering-business-server:modules:audit-model")
include(":apps:backend:catering-business-server:modules:catalog")
include(":apps:backend:catering-business-server:modules:inventory")
include(":apps:backend:catering-business-server:modules:fulfillment-production")
