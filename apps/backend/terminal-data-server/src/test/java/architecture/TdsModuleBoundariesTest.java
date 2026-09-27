package architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApiConfiguration;
import com.catering.v2s.terminalbinding.application.TerminalCredentialVerificationService;
import com.catering.v2s.terminaldataserver.architecture.fixture.TdsApiDependencyFixture;
import com.catering.v2s.terminaldataserver.architecture.fixture.TdsImplementationDependencyFixture;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** TDS source may consume the owner API but must not import terminal-binding implementation packages. */
class TdsModuleBoundariesTest {
    private static final String TDS_PACKAGE = "com.catering.v2s.terminaldataserver";
    private static final String BINDING_API_PACKAGE = "com.catering.v2s.terminalbinding.api";

    static final ArchRule TDS_USES_ONLY_TERMINAL_BINDING_API = classes()
            .that()
            .resideInAnyPackage(TDS_PACKAGE, TDS_PACKAGE + "..")
            .should(new ArchCondition<>("depend on terminal-binding API packages only") {
                @Override
                public void check(JavaClass item, ConditionEvents events) {
                    for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
                        String targetPackage = dependency.getTargetClass().getPackageName();
                        if (targetPackage.startsWith("com.catering.v2s.terminalbinding.")
                                && !targetPackage.equals(BINDING_API_PACKAGE)
                                && !targetPackage.startsWith(BINDING_API_PACKAGE + ".")) {
                            events.add(SimpleConditionEvent.violated(
                                    item,
                                    item.getFullName() + " depends on terminal-binding implementation "
                                            + dependency.getTargetClass().getFullName()));
                        }
                    }
                }
            });

    static final ArchRule SPRING_STEREOTYPES_WITH_MULTIPLE_CONSTRUCTORS_SELECT_ONE = classes()
            .should(new ArchCondition<>("select one @Autowired constructor for multi-constructor Spring components") {
                @Override
                public void check(JavaClass item, ConditionEvents events) {
                    if (!item.isMetaAnnotatedWith(Component.class)
                            || item.getConstructors().size() <= 1) return;

                    long selectedConstructors = item.getConstructors().stream()
                            .filter(constructor -> constructor.isAnnotatedWith(Autowired.class))
                            .count();
                    if (selectedConstructors != 1) {
                        events.add(SimpleConditionEvent.violated(
                                item,
                                "SPRING_MULTIPLE_CONSTRUCTORS_REQUIRE_EXPLICIT_INJECTION_CONSTRUCTOR: "
                                        + item.getName()));
                    }
                }
            });

    @Test
    void productionPackageRespectsArchitectureRules() {
        var productionClasses = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages(TDS_PACKAGE);
        TDS_USES_ONLY_TERMINAL_BINDING_API.check(productionClasses);
        SPRING_STEREOTYPES_WITH_MULTIPLE_CONSTRUCTORS_SELECT_ONE.check(productionClasses);
    }

    @Test
    void allowsThePublishedVerificationApi() {
        assertDoesNotThrow(() -> TDS_USES_ONLY_TERMINAL_BINDING_API.check(new ClassFileImporter()
                .importClasses(TdsApiDependencyFixture.class, TerminalCredentialVerificationApi.class)));
    }

    @Test
    void rejectsTerminalBindingImplementationImports() {
        var failure = assertThrows(
                AssertionError.class,
                () -> TDS_USES_ONLY_TERMINAL_BINDING_API.check(new ClassFileImporter()
                        .importClasses(
                                TdsImplementationDependencyFixture.class,
                                TerminalCredentialVerificationService.class)));
        assertTrue(failure.getMessage().contains("TdsImplementationDependencyFixture"));
    }

    @Test
    void acceptsMultipleConstructorsWhenOneSpringInjectionConstructorIsSelected() {
        assertDoesNotThrow(() -> SPRING_STEREOTYPES_WITH_MULTIPLE_CONSTRUCTORS_SELECT_ONE.check(
                new ClassFileImporter().importClasses(SelectedInjectionConstructorFixture.class)));
    }

    @Test
    void rejectsMultipleConstructorsWithoutAnExplicitSpringInjectionConstructor() {
        var failure = assertThrows(
                AssertionError.class,
                () -> SPRING_STEREOTYPES_WITH_MULTIPLE_CONSTRUCTORS_SELECT_ONE.check(
                        new ClassFileImporter().importClasses(UnselectedInjectionConstructorFixture.class)));
        assertTrue(
                failure.getMessage().contains("SPRING_MULTIPLE_CONSTRUCTORS_REQUIRE_EXPLICIT_INJECTION_CONSTRUCTOR"));
    }

    @Test
    void ownerApiAssemblyProvidesTheVerifierBeanToTds() {
        new ApplicationContextRunner()
                .withUserConfiguration(TerminalCredentialVerificationApiConfiguration.class)
                .withBean(JdbcTemplate.class, () -> new JdbcTemplate(Mockito.mock(DataSource.class)))
                .run(context -> {
                    assertTrue(context.getStartupFailure() == null, "TDS_VERIFICATION_API_ASSEMBLY_FAILED");
                    assertTrue(context.getBean(TerminalCredentialVerificationApi.class) != null);
                });
    }

    @Component
    static final class SelectedInjectionConstructorFixture {
        SelectedInjectionConstructorFixture(String ignored) {}

        @Autowired
        SelectedInjectionConstructorFixture() {}
    }

    @Component
    static final class UnselectedInjectionConstructorFixture {
        UnselectedInjectionConstructorFixture(String ignored) {}

        UnselectedInjectionConstructorFixture() {}
    }
}
