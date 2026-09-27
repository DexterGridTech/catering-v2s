package architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.operations.contract.CrossCapabilityController;
import com.catering.v2s.app.edge.operations.contract.JdbcTouchingController;
import com.catering.v2s.app.edge.operations.contract.ServletReadingController;
import com.catering.v2s.app.edge.operations.contract.SessionDependencyController;
import com.catering.v2s.app.edge.operations.organization.OperationsBusinessEntityController;
import com.catering.v2s.app.edge.operations.session.OperationsDependsOnPlatformSessionFixture;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.platform.session.PlatformDependsOnOperationsSessionFixture;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Production architecture boundary: the business deployable owns no TDP source tree. */
@AnalyzeClasses(
        packages = "com.catering.v2s",
        importOptions = {ImportOption.DoNotIncludeTests.class, BusinessProductionOutputImportOption.class})
class BackendModuleBoundariesTest {
    @ArchTest
    static final ArchRule DOMAIN_MODULES_ARE_FRAMEWORK_FREE = noClasses()
            .that()
            .resideInAnyPackage("..platform.workspace.domain..", "..organization.domain..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta.persistence..");

    @ArchTest
    static final ArchRule ORGANIZATION_DOES_NOT_REACH_WORKSPACE_INTERNALS = noClasses()
            .that()
            .resideInAPackage("com.catering.v2s.organization..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("..platform.workspace.application..", "..platform.workspace.adapter..");

    @ArchTest
    static final ArchRule NO_MODULE_REFERENCES_TERMINAL_DATA_RUNTIME =
            noClasses().should().dependOnClassesThat().resideInAnyPackage("..terminaldataserver..", "..tdp..");

    @ArchTest
    static final ArchRule EDGE_CONTROLLERS_DO_NOT_TOUCH_SERVLET_API = noClasses()
            .that()
            .haveSimpleNameEndingWith("Controller")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("jakarta.servlet..");

    @ArchTest
    static final ArchRule EDGE_DOES_NOT_TOUCH_PERSISTENCE = noClasses()
            .that()
            .resideInAPackage("..app.edge..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage(
                    "org.springframework.jdbc..", "org.springframework.data.repository..", "java.sql..", "javax.sql..");

    @ArchTest
    static final ArchRule EDGE_CAPABILITIES_DO_NOT_DEPEND_ON_PEERS = classes()
            .that()
            .resideInAnyPackage(
                    "..app.edge.platform..",
                    "..app.edge.operations..",
                    "..app.edge.publicentry..",
                    "..app.edge.terminal..")
            .should(new ArchCondition<>("not depend on a peer edge capability except its face session capability") {
                @Override
                public void check(JavaClass item, ConditionEvents events) {
                    Optional<EdgeCapability> source = EdgeCapability.from(item.getPackageName());
                    if (source.isEmpty()) return;
                    for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                        Optional<EdgeCapability> target =
                                EdgeCapability.from(dependency.getTargetClass().getPackageName());
                        if (target.isPresent() && source.get().dependsOnPeer(target.get())) {
                            events.add(SimpleConditionEvent.violated(
                                    item,
                                    item.getFullName() + " depends on peer edge capability "
                                            + dependency.getTargetClass().getFullName()));
                        }
                    }
                }
            });

    @ArchTest
    static final ArchRule PLATFORM_EDGE_DOES_NOT_DEPEND_ON_OPERATIONS_SESSION = noClasses()
            .that()
            .resideInAPackage("..app.edge.platform..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..app.edge.operations.session..");

    @ArchTest
    static final ArchRule OPERATIONS_EDGE_DOES_NOT_DEPEND_ON_PLATFORM_SESSION = noClasses()
            .that()
            .resideInAPackage("..app.edge.operations..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..app.edge.platform.session..");

    @ArchTest
    static final ArchRule EDGE_CONTROLLERS_USE_TYPED_REQUEST_PROBLEMS = noClasses()
            .that()
            .haveSimpleNameEndingWith("Controller")
            .should()
            .dependOnClassesThat()
            .areAssignableTo(IllegalArgumentException.class);

    @ArchTest
    static final ArchRule COLLECTION_BOUNDARY_PARSERS_DELEGATE_TO_FOUNDATION = classes()
            .that()
            .resideInAnyPackage("..application..")
            .should(new ArchCondition<>("delegate collection parsing to CollectionRequestSupport") {
                @Override
                public void check(JavaClass item, ConditionEvents events) {
                    for (JavaCodeUnit codeUnit : item.getCodeUnits()) {
                        if (Set.of("parsePageSize", "parseCursor").contains(codeUnit.getName())) {
                            // always inspect these parser entry points
                        } else if ("optional".equals(codeUnit.getName())
                                && codeUnit.getRawParameterTypes().stream()
                                        .noneMatch(type ->
                                                Set.of("ObjectNode", "JsonNode").contains(type.getSimpleName()))) {
                            continue;
                        } else if (!"optional".equals(codeUnit.getName())) {
                            continue;
                        }
                        boolean delegates = codeUnit.getMethodCallsFromSelf().stream()
                                .anyMatch(call -> call.getTargetOwner()
                                        .getFullName()
                                        .equals(("com.catering.v2s.platform.foundation.collection.Coll"
                                                + "ectionRequestSupport")));
                        if (!delegates) {
                            events.add(SimpleConditionEvent.violated(
                                    codeUnit, codeUnit.getFullName() + " must delegate to CollectionRequestSupport"));
                        }
                    }
                }
            });

    @Test
    void backendModuleBoundaries() throws Exception {
        Path root = repositoryRoot();
        assertTrue(Files.exists(root.resolve("contracts/policy/module-dependency-registry.json")));
        assertTrue(Files.exists(
                root.resolve("apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver")));
        assertTrue(Files.exists(root.resolve("apps/backend/catering-business-server/modules/workspace")));
        assertTrue(Files.exists(root.resolve("apps/backend/catering-business-server/modules/organization")));
    }

    @Test
    void businessArchunitImportScopeIncludesOnlyBusinessProductionOutputs() {
        Path root = repositoryRoot();
        var foundationJar =
                root.resolve("apps/backend/catering-business-server/modules/foundation/build/libs/foundation-main.jar");
        assertTrue(BusinessProductionOutputImportOption.includesProductionOutput(
                java.net.URI.create("jar:" + foundationJar.toUri() + "!/com/catering/v2s/platform/foundation")));
        assertFalse(BusinessProductionOutputImportOption.includesProductionOutput(
                root.resolve("apps/backend/terminal-data-server/build/classes/java/main")
                        .toUri()));
        assertFalse(BusinessProductionOutputImportOption.includesProductionOutput(
                root.resolve("apps/backend/catering-business-server/build/classes/java/test")
                        .toUri()));
    }

    @Test
    void edgeServletBoundaryRejectsProductionShape() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> EDGE_CONTROLLERS_DO_NOT_TOUCH_SERVLET_API.check(
                        new ClassFileImporter().importClasses(ServletReadingController.class)));
        assertTrue(failure.getMessage().contains("ServletReadingController"));
    }

    @Test
    void edgePersistenceBoundaryRejectsProductionShape() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> EDGE_DOES_NOT_TOUCH_PERSISTENCE.check(
                        new ClassFileImporter().importClasses(JdbcTouchingController.class)));
        assertTrue(failure.getMessage().contains("JdbcTouchingController"));
    }

    @Test
    void edgeCapabilityBoundaryRejectsPeerAndAllowsSessionDependency() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> EDGE_CAPABILITIES_DO_NOT_DEPEND_ON_PEERS.check(new ClassFileImporter()
                        .importClasses(CrossCapabilityController.class, OperationsBusinessEntityController.class)));
        assertTrue(failure.getMessage().contains("CrossCapabilityController"));
        assertDoesNotThrow(() -> EDGE_CAPABILITIES_DO_NOT_DEPEND_ON_PEERS.check(new ClassFileImporter()
                .importClasses(SessionDependencyController.class, OperationsSessionResolver.class)));
    }

    @Test
    void terminalEdgeCapabilityBoundaryRejectsPeerCapabilityDependency() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> EDGE_CAPABILITIES_DO_NOT_DEPEND_ON_PEERS.check(new ClassFileImporter()
                        .importClasses(
                                com.catering.v2s.app.edge.terminal.activation.TerminalActivationCapabilityFixture.class,
                                com.catering.v2s.app.edge.terminal.cancellation.TerminalCancellationCapabilityFixture
                                        .class)));
        assertTrue(failure.getMessage().contains("TerminalActivationCapabilityFixture"));
    }

    @Test
    void terminalDataServerPackageBoundaryRejectsAProductionDependencyShape() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> NO_MODULE_REFERENCES_TERMINAL_DATA_RUNTIME.check(new ClassFileImporter()
                        .importClasses(
                                architecture.fixture.TerminalDataServerDependencyFixture.class,
                                com.catering.v2s.terminaldataserver.fixture.TerminalDataServerRuntimeFixture.class)));
        assertTrue(failure.getMessage().contains("TerminalDataServerDependencyFixture"));
    }

    @Test
    void faceLocalSessionBoundaryRejectsBothCrossFaceDependencies() {
        AssertionError platformFailure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> PLATFORM_EDGE_DOES_NOT_DEPEND_ON_OPERATIONS_SESSION.check(new ClassFileImporter()
                        .importClasses(
                                PlatformDependsOnOperationsSessionFixture.class, OperationsSessionResolver.class)));
        assertTrue(platformFailure.getMessage().contains("PlatformDependsOnOperationsSessionFixture"));
        AssertionError operationsFailure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> OPERATIONS_EDGE_DOES_NOT_DEPEND_ON_PLATFORM_SESSION.check(new ClassFileImporter()
                        .importClasses(
                                OperationsDependsOnPlatformSessionFixture.class,
                                com.catering.v2s.app.edge.platform.session.PlatformSessionResolver.class)));
        assertTrue(operationsFailure.getMessage().contains("OperationsDependsOnPlatformSessionFixture"));
    }

    @Test
    void edgeTypedProblemBoundaryRejectsFrameworkDefaultShape() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> EDGE_CONTROLLERS_USE_TYPED_REQUEST_PROBLEMS.check(
                        new ClassFileImporter().importClasses(architecture.fixture.IllegalArgumentController.class)));
        assertTrue(failure.getMessage().contains("IllegalArgumentController"));
    }

    @Test
    void collectionParserBoundaryRejectsAFunctionallyEquivalentLocalParser() {
        AssertionError failure = org.junit.jupiter.api.Assertions.assertThrows(
                AssertionError.class,
                () -> COLLECTION_BOUNDARY_PARSERS_DELEGATE_TO_FOUNDATION.check(new ClassFileImporter()
                        .importClasses(architecture.fixture.application.LocalCollectionParserFixture.class)));
        assertTrue(failure.getMessage().contains("LocalCollectionParserFixture"));
    }

    private Path repositoryRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (current != null && !Files.exists(current.resolve("settings.gradle.kts"))) {
            current = current.getParent();
        }
        if (current == null) {
            throw new IllegalStateException("repository root with settings.gradle.kts was not found");
        }
        return current;
    }

    private record EdgeCapability(String face, String capability) {
        static Optional<EdgeCapability> from(String packageName) {
            String prefix = "com.catering.v2s.app.edge.";
            if (!packageName.startsWith(prefix)) return Optional.empty();
            String[] segments = packageName.substring(prefix.length()).split("\\.");
            if (segments.length < 2) return Optional.empty();
            return Optional.of(new EdgeCapability(segments[0], segments[1]));
        }

        boolean dependsOnPeer(EdgeCapability other) {
            return face.equals(other.face)
                    && !capability.equals(other.capability)
                    && !"session".equals(other.capability);
        }
    }
}
