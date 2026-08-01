package com.catering.v2s.app.edge.platform.workspace;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.catering.v2s.app.edge.problem.ContractProblemAdvice.Problem;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationProblem;
import com.catering.v2s.organization.application.OrganizationCommandService.OrganizationCommandException;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

class PlatformCommercialGroupControllerProblemTest {
    @Test
    void expiredPlatformSessionUsesCanonicalTypedProblemThroughEdgeRequestContext() {
        var response = new PlatformCommercialGroupController(null, null, ignored -> { }).sessionExpired(request());
        Problem problem = response.getBody();

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals(MediaType.valueOf("application/problem+json"), response.getHeaders().getContentType());
        assertNotNull(problem);
        assertEquals("PLATFORM_IAM_SESSION_EXPIRED", problem.errorCode());
        assertEquals(401, problem.status());
        assertEquals("", problem.instance());
        assertEquals("correlation-platform-session", problem.correlationId());
    }

    @Test
    void ownerProblemWithoutLegacyWireEnumStillMapsToCanonicalValidationProblem() {
        var response = new PlatformCommercialGroupController(null, null, ignored -> { })
            .validation(new OrganizationCommandException(OrganizationProblem.COMMERCIAL_GROUP_REQUIRED, "missing root"), request());
        Problem problem = response.getBody();

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, response.getStatusCode());
        assertEquals(MediaType.valueOf("application/problem+json"), response.getHeaders().getContentType());
        assertNotNull(problem);
        assertEquals("VALIDATION_FAILED", problem.errorCode());
        assertEquals(422, problem.status());
    }

    @Test
    void ownerCommandDiagnosticIsCorrelatedStructuredAndSecretFree() {
        List<SecurityDiagnosticEvent> events = new ArrayList<>();
        PlatformCommercialGroupController.recordDiagnostic(events::add,
            new EdgeRequestContext("not-for-log", "unsafe correlation password=not-for-log", null, null, null, null, null),
            System.nanoTime(), 500, "PLATFORM_COMMON_RESULT_UNKNOWN");

        assertEquals(1, events.size());
        SecurityDiagnosticEvent event = events.getFirst();
        assertEquals("INITIALIZE_COMMERCIAL_GROUP", event.context().operationId());
        assertEquals("/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group", event.context().routeTemplate());
        assertEquals("OWNER_COMMAND", event.phase());
        assertEquals("FAILED", event.outcome());
        assertEquals(500, event.status());
        assertEquals("PLATFORM_COMMON_RESULT_UNKNOWN", event.errorCode());
        assertNotEquals("unsafe correlation password=not-for-log", event.context().correlationId());
    }

    private static EdgeRequestContext request() {
        return new EdgeRequestContext("test-rate-limit-fingerprint", "correlation-platform-session", null, null, null, null, null);
    }
}
