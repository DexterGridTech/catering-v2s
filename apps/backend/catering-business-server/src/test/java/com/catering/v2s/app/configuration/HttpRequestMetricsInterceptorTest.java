package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
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
    }

    @Test
    void validHttpDiagnosticActivationUsesItsOwnHeadersAndRecordsMismatchSafely() throws Exception {
        Path events = tempDirectory.resolve("diagnostic-events.jsonl");
        HttpRequestMetricsInterceptor interceptor = new HttpRequestMetricsInterceptor(new ObjectMapper(), "non-production", "rm1-http-diagnostic", "run-test-1234", "012345678901234567890123", "v2s-http-diagnostic-test", events.toString());
        MockHttpServletRequest request = request("X-Http-Diagnostic", "wrongOperation");
        request.addHeader("X-Http-Diagnostic-Secret", "012345678901234567890123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(request, response, new Object()));
        interceptor.afterCompletion(request, response, new Object(), null);
        String event = Files.readString(events);
        assertTrue(event.contains("HTTP_DIAGNOSTIC_OPERATION_METADATA_MISMATCH"));
        assertTrue(!event.contains("012345678901234567890123"));
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
