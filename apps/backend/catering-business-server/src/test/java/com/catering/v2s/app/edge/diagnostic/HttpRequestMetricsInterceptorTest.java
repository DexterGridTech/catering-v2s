package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.persistence.CountingDataSource;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Base64;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

class HttpRequestMetricsInterceptorTest {
    @TempDir Path tempDirectory;

    @Test
    void observationIsDefaultOffOutsideTheManagedNonProductionProfiles() throws Exception {
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "production", "rm1-http-diagnostic", "run-test-1234", "012345678901234567890123", "v2s-http-diagnostic-test", tempDirectory.resolve("events.jsonl").toString());
        MockHttpServletRequest request = request("X-Http-Diagnostic", "getPlatformAdminPage");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(request, response, new Object()));
        assertNull(response.getHeader("X-Correlation-Id"));
    }

    @Test
    void validSeedActivationPreservesItsCanonicalServerMetadata() throws Exception {
        Path events = tempDirectory.resolve("seed-events.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123", "v2s-dev-test", events.toString());
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        request.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(request, response, new Object()));
        interceptor.afterCompletion(request, response, new Object(), null);
        String event = Files.readString(events);
        assertTrue(event.contains("\"operationId\":\"getPlatformAdminPage\""));
        assertTrue(event.contains("\"routeTemplate\":\"/api/platform/admin-users\""));
        assertTrue(event.contains("\"consumerFace\":\"platform-admin\""));
        assertTrue(event.contains("\"measurementSchemaVersion\":2"));
        assertTrue(event.contains("\"measurementBasis\":\"JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH\""));
        assertTrue(event.contains("\"logicalSectionCounts\""));
        assertTrue(event.contains("\"kindCounts\""));
    }

    @Test
    void managedCompletionEventCarriesEdgeLifecycleCheckpoints() throws Exception {
        Path events = tempDirectory.resolve("phase-events.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123", "v2s-dev-test", events.toString());
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        request.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);

        var phaseCheckpoints = new ObjectMapper().readTree(Files.readString(events)).path("phaseCheckpoints");
        assertTrue(phaseCheckpoints.isArray());
        assertTrue(phaseCheckpoints.findValuesAsText("phase").contains("EDGE_IN"));
        assertTrue(phaseCheckpoints.findValuesAsText("phase").contains("EDGE_OUT"));
    }

    @Test
    void invalidOperationMetadataKeepsTheScopeAndWritesAFailedManagedEvent() throws Exception {
        Path events = tempDirectory.resolve("diagnostic-events.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "non-production", "rm1-http-diagnostic", "run-test-1234", "012345678901234567890123", "v2s-http-diagnostic-test", events.toString());
        MockHttpServletRequest request = request("X-Http-Diagnostic", "wrongOperation");
        request.addHeader("X-Http-Diagnostic-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(request, response, new Object()));
        assertTrue(HttpRequestMetricsInterceptor.isManagedEventRequest(request));
        assertTrue(DatabaseOperationTracker.isActive());
        interceptor.afterCompletion(request, response, new Object(), null);
        String event = Files.readString(events);
        assertTrue(event.contains("\"outcome\":\"FAILED\""));
        assertTrue(event.contains("HTTP_DIAGNOSTIC_OPERATION_METADATA_MISMATCH"));
        assertFalse(DatabaseOperationTracker.isActive());
    }

    @Test
    void finalPerformanceModeWritesOnlyValidatedFixtureMetadata() throws Exception {
        Path events = tempDirectory.resolve("final-performance-events.jsonl");
        String hmacKey = Base64.getUrlEncoder().withoutPadding().encodeToString("0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "backend-performance-final-acceptance", "run-test-1234", "012345678901234567890123",
                "v2s-backend-performance-test", events.toString(), tempDirectory.resolve("final-performance-db.jsonl").toString(), hmacKey, tempDirectory.resolve("final-performance-dictionary.json").toString());
        MockHttpServletRequest request = request("X-Backend-Performance", "getPlatformAdminPage");
        request.addHeader("X-Backend-Performance-Secret", "012345678901234567890123");
        request.addHeader("X-Backend-Performance-Fixture-Id", "BP-U05-TASK:getPlatformAdminPage");
        request.addHeader("X-Backend-Performance-Area", "U05_TASK_READ");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);

        String event = Files.readString(events);
        assertTrue(event.contains("\"performanceFixtureId\":\"BP-U05-TASK:getPlatformAdminPage\""));
        assertTrue(event.contains("\"performanceArea\":\"U05_TASK_READ\""));
        assertTrue(event.contains("\"serverEvidenceHmac\":"));
        assertTrue(event.contains("\"outcome\":\"SUCCEEDED\""));
    }

    @Test
    void finalPerformanceModeRejectsInvalidFixtureMetadataWithoutRecordingIt() throws Exception {
        Path events = tempDirectory.resolve("invalid-final-performance-events.jsonl");
        String hmacKey = Base64.getUrlEncoder().withoutPadding().encodeToString("0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "backend-performance-final-acceptance", "run-test-1234", "012345678901234567890123",
                "v2s-backend-performance-test", events.toString(), tempDirectory.resolve("invalid-final-performance-db.jsonl").toString(), hmacKey, tempDirectory.resolve("invalid-final-performance-dictionary.json").toString());
        MockHttpServletRequest request = request("X-Backend-Performance", "getPlatformAdminPage");
        request.addHeader("X-Backend-Performance-Secret", "012345678901234567890123");
        request.addHeader("X-Backend-Performance-Fixture-Id", "raw payload forbidden");
        request.addHeader("X-Backend-Performance-Area", "U05_TASK_READ");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);

        String event = Files.readString(events);
        assertFalse(event.contains("performanceFixtureId"));
        assertTrue(event.contains("BACKEND_PERFORMANCE_FINAL_FIXTURE_METADATA_INVALID"));
        assertTrue(event.contains("\"outcome\":\"FAILED\""));
    }

    @Test
    void activeScopeDoesNotRequireManagedDiagnosticHeaders() throws Exception {
        Path events = tempDirectory.resolve("unmanaged-events.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123", "v2s-dev-test", events.toString());
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        request.removeHeader("X-Seed-Run-Id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());

        assertTrue(DatabaseOperationTracker.isActive());
        assertFalse(HttpRequestMetricsInterceptor.isManagedEventRequest(request));
        assertTrue(response.getHeader("X-Correlation-Id").startsWith("corr-"));
        assertTrue(response.getHeader("X-Request-Id").startsWith("req-"));
        interceptor.afterCompletion(request, response, new Object(), null);
        assertFalse(DatabaseOperationTracker.isActive());
        assertFalse(Files.exists(events));
    }

    @Test
    void activeScopeDoesNotRequireAConfiguredRunOrEventFile() throws Exception {
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "r5-full", null, null, "v2s-dev-test", null);
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());

        assertTrue(DatabaseOperationTracker.isActive());
        assertFalse(HttpRequestMetricsInterceptor.isManagedEventRequest(request));
        interceptor.afterCompletion(request, response, new Object(), null);
        assertFalse(DatabaseOperationTracker.isActive());
    }

    @Test
    void configuredDatabaseEvidenceFailsClosedWhenHmacKeyIsMissing() throws Exception {
        Path events = tempDirectory.resolve("hmac-missing-events.jsonl");
        Path databaseOperations = tempDirectory.resolve("hmac-missing-db.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123",
                "v2s-dev-test", events.toString(), databaseOperations.toString(), null, null);
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        request.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);

        String event = Files.readString(events);
        assertTrue(event.contains("DISABLED_HMAC_KEY_MISSING"));
        assertTrue(event.contains("DB_OPERATION_HMAC_KEY_MISSING"));
        assertFalse(Files.exists(databaseOperations));
    }

    @Test
    void databaseEvidenceIsWrittenOnlyForCredentialAuthorizedRequestTuple() throws Exception {
        Path events = tempDirectory.resolve("tuple-events.jsonl");
        Path databaseOperations = tempDirectory.resolve("tuple-db.jsonl");
        Path dictionary = tempDirectory.resolve("tuple-dictionary.json");
        String hmacKey = Base64.getUrlEncoder().withoutPadding().encodeToString("0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123",
                "v2s-dev-test", events.toString(), databaseOperations.toString(), hmacKey, dictionary.toString());

        MockHttpServletRequest unmanaged = request("X-Seed", "getPlatformAdminPage");
        MockHttpServletResponse unmanagedResponse = new MockHttpServletResponse();
        interceptor.preHandle(unmanaged, unmanagedResponse, new Object());
        executeObservedStatement();
        interceptor.afterCompletion(unmanaged, unmanagedResponse, new Object(), null);

        assertFalse(Files.exists(events));
        assertFalse(Files.exists(databaseOperations));
        assertFalse(Files.exists(dictionary));

        MockHttpServletRequest managed = request("X-Seed", "getPlatformAdminPage");
        managed.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        MockHttpServletResponse managedResponse = new MockHttpServletResponse();
        interceptor.preHandle(managed, managedResponse, new Object());
        executeObservedStatement();
        interceptor.afterCompletion(managed, managedResponse, new Object(), null);

        var mapper = new ObjectMapper();
        var event = mapper.readTree(Files.readString(events));
        var dbOperation = mapper.readTree(Files.readString(databaseOperations).lines().findFirst().orElseThrow());
        assertEquals(event.path("runId").asText(), dbOperation.path("runId").asText());
        assertEquals(event.path("correlationId").asText(), dbOperation.path("correlationId").asText());
        assertEquals(event.path("requestId").asText(), dbOperation.path("requestId").asText());
        assertTrue(Files.exists(dictionary));
    }

    @Test
    void databaseEvidenceIsNotPublishedWhenItsManagedCompletionEventCannotBeWritten() throws Exception {
        Path blockedParent = tempDirectory.resolve("not-a-directory");
        Files.writeString(blockedParent, "block event parent");
        Path databaseOperations = tempDirectory.resolve("event-write-failed-db.jsonl");
        Path dictionary = tempDirectory.resolve("event-write-failed-dictionary.json");
        String hmacKey = Base64.getUrlEncoder().withoutPadding().encodeToString("0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(
                new ObjectMapper(), "non-production", "r5-full", "run-test-1234", "012345678901234567890123",
                "v2s-dev-test", blockedParent.resolve("events.jsonl").toString(), databaseOperations.toString(), hmacKey, dictionary.toString());
        MockHttpServletRequest request = request("X-Seed", "getPlatformAdminPage");
        request.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        interceptor.preHandle(request, response, new Object());
        executeObservedStatement();
        interceptor.afterCompletion(request, response, new Object(), null);

        assertFalse(Files.exists(databaseOperations));
        assertFalse(Files.exists(dictionary));
    }

    private static void executeObservedStatement() throws Exception {
        DataSource delegate = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        when(delegate.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.execute("select 1")).thenReturn(true);
        try (Connection observed = new CountingDataSource(delegate).getConnection(); Statement observedStatement = observed.createStatement()) {
            observedStatement.execute("select 1");
        }
    }

    private static MockHttpServletRequest request(String prefix, String operationId) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/platform/admin-users");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/platform/admin-users");
        request.addHeader(prefix + "-Operation-Id", operationId);
        request.addHeader(prefix + "-Route-Template", "/api/platform/admin-users");
        request.addHeader(prefix + "-Run-Id", "run-test-1234");
        return request;
    }
}
