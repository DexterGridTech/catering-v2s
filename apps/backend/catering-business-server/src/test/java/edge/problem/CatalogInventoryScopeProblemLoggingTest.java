package edge.problem;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import com.catering.v2s.app.edge.operations.cataloginventory.OperationsCatalogInventoryController;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class CatalogInventoryScopeProblemLoggingTest {
    private static final UUID WORKSPACE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final String GROUP_WORKSPACE = "group-workspace";
    private static final String BRAND_REF = "brand-reference-that-must-not-be-logged";

    @Test
    void inventoryReadScopeFailureKeeps403ContractAndLogsOriginalStackFromLiveControllerPath() {
        IllegalStateException failure = new IllegalStateException("brand lookup infrastructure failure");
        CatalogScopeLookup scopes = mock(CatalogScopeLookup.class);
        when(scopes.requireCatalogBrand(WORKSPACE, GROUP_WORKSPACE, "STORE", STORE, BRAND_REF)).thenThrow(failure);

        Outcome outcome = exerciseInventoryTargets(controller(scopes));

        assertEquals("SCOPE_FORBIDDEN", outcome.ownerProblem.code());
        assertEquals(403, outcome.ownerProblem.status());
        assertEquals("当前会话没有已授权品牌", outcome.ownerProblem.getMessage());
        assertEquals(403, outcome.response.getStatusCode().value());
        assertEquals("SCOPE_FORBIDDEN", outcome.response.getBody().errorCode());
        assertEquals("商品、生产标签或库存操作不满足 owner 约束", outcome.response.getBody().detail());
        assertOriginalStackIsLogged(outcome.events, failure);
    }

    @Test
    void brandCopyCandidateScopeFailureKeeps403ContractAndLogsOriginalStackFromLiveControllerPath() {
        IllegalStateException failure = new IllegalStateException("copy source lookup infrastructure failure");
        CatalogScopeLookup scopes = mock(CatalogScopeLookup.class);
        when(scopes.requireCatalogBrand(WORKSPACE, GROUP_WORKSPACE, "STORE", STORE, BRAND_REF)).thenReturn("brand-1");
        when(scopes.resolveCatalogCopySource(WORKSPACE, GROUP_WORKSPACE, "STORE", STORE, "brand-1")).thenThrow(failure);

        Outcome outcome = exerciseBrandCopyCandidates(controller(scopes));

        assertEquals("SCOPE_FORBIDDEN", outcome.ownerProblem.code());
        assertEquals(403, outcome.ownerProblem.status());
        assertEquals("当前门店没有可用的品牌商品复制来源", outcome.ownerProblem.getMessage());
        assertEquals(403, outcome.response.getStatusCode().value());
        assertEquals("SCOPE_FORBIDDEN", outcome.response.getBody().errorCode());
        assertEquals("商品、生产标签或库存操作不满足 owner 约束", outcome.response.getBody().detail());
        assertOriginalStackIsLogged(outcome.events, failure);
    }

    @Test
    void directTypedOwnerProblemWithoutNestedCauseStillLogsItsOwnStack() {
        CatalogOwnerApi.Problem ownerProblem = new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "fixture is invalid");
        Logger logger = (Logger) LoggerFactory.getLogger(ContractProblemAdvice.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            ResponseEntity<ContractProblemAdvice.Problem> response = mapThroughAdvice(ownerProblem,
                new MockHttpServletRequest("PATCH", "/api/operations/catalog-inventory/items/item"));
            assertEquals(422, response.getStatusCode().value());
            assertOriginalStackIsLogged(List.copyOf(appender.list), ownerProblem);
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    private static OperationsCatalogInventoryController controller(CatalogScopeLookup scopes) {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        EdgeRequestContext context = context();
        when(sessions.requireRead(any(EdgeRequestContext.class))).thenReturn(session());
        return new OperationsCatalogInventoryController(null, sessions, scopes, new ObjectMapper(), null);
    }

    private static Outcome exerciseInventoryTargets(OperationsCatalogInventoryController controller) {
        return exercise(() -> controller.inventoryTargets(context(), Map.of(), Map.of()));
    }

    private static Outcome exerciseBrandCopyCandidates(OperationsCatalogInventoryController controller) {
        return exercise(() -> controller.brandCopyCandidates(context(), Map.of(), Map.of()));
    }

    private static Outcome exercise(ThrowingOperation operation) {
        Logger logger = (Logger) LoggerFactory.getLogger(ContractProblemAdvice.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            CatalogOwnerApi.Problem ownerProblem = assertThrows(CatalogOwnerApi.Problem.class, operation::run);
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/operations/catalog-inventory");
            ResponseEntity<ContractProblemAdvice.Problem> response = mapThroughAdvice(ownerProblem, request);
            return new Outcome(ownerProblem, response, List.copyOf(appender.list));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @SuppressWarnings("unchecked")
    private static ResponseEntity<ContractProblemAdvice.Problem> mapThroughAdvice(
        CatalogOwnerApi.Problem ownerProblem, HttpServletRequest request
    ) {
        try {
            Method handler = ContractProblemAdvice.class.getDeclaredMethod(
                "catalogInventory", RuntimeException.class, HttpServletRequest.class);
            handler.setAccessible(true);
            return (ResponseEntity<ContractProblemAdvice.Problem>) handler.invoke(new ContractProblemAdvice(), ownerProblem, request);
        } catch (InvocationTargetException failure) {
            throw new AssertionError(failure.getCause());
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError(failure);
        }
    }

    private static void assertOriginalStackIsLogged(List<ILoggingEvent> events, Throwable original) {
        ILoggingEvent event = events.stream()
            .filter(candidate -> candidate.getFormattedMessage().contains("catalog-inventory owner problem"))
            .findFirst()
            .orElseThrow();
        assertNotNull(event.getThrowableProxy());
        String renderedThrowable = ThrowableProxyUtil.asString(event.getThrowableProxy());
        assertTrue(renderedThrowable.contains(original.getClass().getName()));
        assertTrue(renderedThrowable.contains(original.getMessage()));
        assertTrue(renderedThrowable.contains("\tat "));
        assertFalse(event.getFormattedMessage().contains(BRAND_REF));
        assertFalse(renderedThrowable.contains(BRAND_REF));
        assertFalse(event.getFormattedMessage().contains("Authorization"));
    }

    private static EdgeRequestContext context() {
        return new EdgeRequestContext("source", "correlation", null, null, null, null, null,
            "request-1", BRAND_REF, null, null);
    }

    private static WorkspaceSessionReadback session() {
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate store = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
            "STORE", STORE, "Store", "STORE-1", List.of(), null, null, STORE, null);
        return new WorkspaceSessionReadback(
            UUID.fromString("33333333-3333-3333-3333-333333333333"), WORKSPACE, GROUP_WORKSPACE,
            UUID.fromString("44444444-4444-4444-4444-444444444444"),
            UUID.fromString("55555555-5555-5555-5555-555555555555"),
            new WorkspaceSessionEntryReadback.ScopeContext(null, null, store, null),
            1L, 1L, Set.of(), Set.of(), "operator", "STORE", STORE);
    }

    private record Outcome(
        CatalogOwnerApi.Problem ownerProblem,
        ResponseEntity<ContractProblemAdvice.Problem> response,
        List<ILoggingEvent> events
    ) { }

    @FunctionalInterface
    private interface ThrowingOperation {
        void run();
    }
}
