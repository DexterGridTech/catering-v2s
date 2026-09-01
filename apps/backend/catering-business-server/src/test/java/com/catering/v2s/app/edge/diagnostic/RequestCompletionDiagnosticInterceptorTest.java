package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.session.EdgeRequestContextArgumentResolver;
import com.catering.v2s.platform.foundation.diagnostic.RequestCompletionEvent;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticRecorder;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.servlet.HandlerMapping;

class RequestCompletionDiagnosticInterceptorTest {
    @Test
    void generatedRouteFaceRegistryRetainsCompleteRouteDenominator() {
        assertEquals(180, EdgeRouteFaceRegistry.load(new ObjectMapper()).size());
        assertNotNull(EdgeRouteFaceRegistry.loadExtended(new ObjectMapper())
                .get("GET /api/operations/catalog-inventory/items/{itemCode}"));
    }

    @Test
    void recordsKnownRouteCompletionWithStableCorrelationAndFailureCode() throws Exception {
        List<RequestCompletionEvent> events = new ArrayList<>();
        RequestCompletionDiagnosticInterceptor interceptor =
                new RequestCompletionDiagnosticInterceptor(new ObjectMapper(), new RecordingRecorder(events));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/platform/admin-users");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/platform/admin-users");
        request.addHeader("X-Correlation-Id", "corr-s2");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(409);

        interceptor.preHandle(request, response, new Object());
        RequestCompletionDiagnosticState.freezeFailure(request, "PLATFORM_COMMON_VERSION_CONFLICT");
        interceptor.afterCompletion(request, response, new Object(), null);

        RequestCompletionEvent event = events.getFirst();
        assertEquals("corr-s2", event.fields().correlationId());
        assertEquals("getPlatformAdminPage", event.fields().operationId());
        assertEquals("platform-admin", event.fields().consumerFace());
        assertEquals("FAILED", event.fields().outcome());
        assertEquals("PLATFORM_COMMON_VERSION_CONFLICT", event.fields().errorCode());
        assertNotNull(response.getHeader("X-Request-Id"));
    }

    @Test
    void managedDiagnosticEventDoesNotProduceDuplicateCompletion() throws Exception {
        List<RequestCompletionEvent> events = new ArrayList<>();
        RequestCompletionDiagnosticInterceptor interceptor =
                new RequestCompletionDiagnosticInterceptor(new ObjectMapper(), new RecordingRecorder(events));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/platform/admin-users");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/platform/admin-users");
        request.addHeader("X-Seed-Run-Id", "run-test-1234");
        request.addHeader("X-Seed-Report-Secret", "012345678901234567890123");
        request.addHeader("X-Seed-Operation-Id", "getPlatformAdminPage");
        request.addHeader("X-Seed-Route-Template", "/api/platform/admin-users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Path eventsPath = Files.createTempFile("managed-request", ".jsonl");
        Files.deleteIfExists(eventsPath);
        HttpRequestMetricsInterceptor metrics = new HttpRequestMetricsInterceptor(
                new ObjectMapper(),
                "non-production",
                "r5-full",
                "run-test-1234",
                "012345678901234567890123",
                "v2s-dev-test",
                eventsPath.toString());

        metrics.preHandle(request, response, new Object());
        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);
        metrics.afterCompletion(request, response, new Object(), null);

        assertEquals(0, events.size());
        assertTrue(
                Files.readString(eventsPath).contains("\"requestId\":\"" + response.getHeader("X-Request-Id") + "\""));
        Files.deleteIfExists(eventsPath);
    }

    @Test
    void problemResponseReusesCompletionCorrelationId() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/platform/admin-users");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/platform/admin-users");
        request.addHeader("X-Correlation-Id", "corr-problem");
        MockHttpServletResponse response = new MockHttpServletResponse();
        RequestCompletionDiagnosticInterceptor interceptor = new RequestCompletionDiagnosticInterceptor(
                new ObjectMapper(), new RecordingRecorder(new ArrayList<>()));

        interceptor.preHandle(request, response, new Object());
        ContractProblemAdvice.Problem problem = ContractProblemAdvice.problem(
                        HttpStatus.CONFLICT, "PLATFORM_COMMON_VERSION_CONFLICT", "conflict", request)
                .getBody();

        assertNotNull(problem);
        assertEquals("corr-problem", problem.correlationId());
    }

    @Test
    void edgeRequestContextResolverUsesCanonicalCorrelationForAbsentAndInvalidHeaders() throws Exception {
        Method method = ResolverFixture.class.getDeclaredMethod("handle", EdgeRequestContext.class);
        MethodParameter parameter = new MethodParameter(method, 0);
        for (String header : java.util.Arrays.asList(null, "invalid correlation")) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/platform/admin-users");
            request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/platform/admin-users");
            if (header != null) request.addHeader("X-Correlation-Id", header);
            MockHttpServletResponse response = new MockHttpServletResponse();
            RequestCompletionDiagnosticInterceptor interceptor = new RequestCompletionDiagnosticInterceptor(
                    new ObjectMapper(), new RecordingRecorder(new ArrayList<>()));
            interceptor.preHandle(request, response, new Object());

            EdgeRequestContext resolved = (EdgeRequestContext) new EdgeRequestContextArgumentResolver()
                    .resolveArgument(parameter, null, new ServletWebRequest(request), null);

            assertEquals(RequestCompletionDiagnosticState.find(request).correlationId(), resolved.correlationId());
        }
    }

    private static final class ResolverFixture {
        @SuppressWarnings("unused")
        private void handle(EdgeRequestContext context) {}
    }

    private static final class RecordingRecorder implements SecurityDiagnosticRecorder {
        private final List<RequestCompletionEvent> events;

        private RecordingRecorder(List<RequestCompletionEvent> events) {
            this.events = events;
        }

        @Override
        public void record(SecurityDiagnosticEvent event) {}

        @Override
        public void recordCompletion(RequestCompletionEvent event) {
            events.add(event);
        }
    }
}
