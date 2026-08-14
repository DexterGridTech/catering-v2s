package edge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.bootstrap.CateringV2sApplication;
import com.catering.v2s.app.edge.diagnostic.EdgeRouteFaceRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Proves that every generated R5 edge operation resolves to a real Spring handler.
 * This deliberately starts the production application against disposable PostgreSQL;
 * it is not a controller-source or generated-catalog text check.
 */
@SpringBootTest(classes = CateringV2sApplication.class, webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EdgeRouteRegistryCoverageTest {
    private static final Set<String> RUNTIME_ROUTE_PREFIX_ALLOWLIST = Set.of("/error", "/actuator");
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("platform.iam.rate-limit-hmac-secret", () -> UUID.randomUUID().toString());
        registry.add("workspace-iam.rate-limit-hmac-secret", () -> UUID.randomUUID().toString());
        registry.add("catering.asset.object-storage.endpoint", () -> "http://127.0.0.1:9000");
        registry.add("catering.asset.object-storage.access-key", () -> UUID.randomUUID().toString());
        registry.add("catering.asset.object-storage.secret-key", () -> UUID.randomUUID().toString());
        registry.add("catering.asset.object-storage.bucket", () -> "edge-route-test-assets");
        registry.add("catering.asset.public-base-url", () -> "https://assets.test");
        registry.add("catering.asset.object-storage.object-prefix", () -> "edge-route-test/");
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Autowired
    private RequestMappingHandlerMapping mappings;

    @Test
    void everyGeneratedR5OperationHasExactlyOneRuntimeRouteAndMethod() throws Exception {
        Set<String> runtime = new HashSet<>();
        mappings.getHandlerMethods().forEach((mapping, handler) -> {
            for (String path : mapping.getPatternValues()) {
                for (RequestMethod method : mapping.getMethodsCondition().getMethods()) {
                    runtime.add(method.name() + " " + path);
                }
            }
        });

        Set<String> expected = new HashSet<>(EdgeRouteFaceRegistry.loadExtended(new ObjectMapper()).keySet());
        Set<String> r24 = expected.stream()
            .filter(route -> route.contains("/head-companies/{headCompanyId}/brand-authorizations"))
            .collect(Collectors.toSet());
        assertEquals(Set.of(
            "POST /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations",
            "DELETE /api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}"
        ), r24, "R-24 must be generated as single-action POST/DELETE routes without the retired PUT");
        Set<String> missing = new HashSet<>(expected);
        missing.removeAll(runtime);
        assertTrue(missing.isEmpty(), () -> "R5 runtime route missing: " + String.join(", ", missing));

        Set<String> unexpected = new HashSet<>(runtime);
        unexpected.removeIf(this::isFrameworkRoute);
        unexpected.removeAll(expected);
        assertTrue(unexpected.isEmpty(), () -> "R5 runtime route outside generated registry: " + String.join(", ", unexpected));
    }

    private boolean isFrameworkRoute(String route) {
        int separator = route.indexOf(' ');
        String path = separator < 0 ? route : route.substring(separator + 1);
        return RUNTIME_ROUTE_PREFIX_ALLOWLIST.stream().anyMatch(path::startsWith);
    }
}
