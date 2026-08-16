package com.catering.v2s.app.edge.platform.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.PlatformAdminSortKey;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformAdminGovernanceControllerTest {
    @Test
    void platformAdministratorGetsUseTypedOwnerTaskReadBoundaries() {
        PlatformAuthenticationService service = mock(PlatformAuthenticationService.class);
        when(service.requireActiveSession("platform-session"))
                .thenReturn(new PlatformSessionReadback(
                        UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform", Long.MAX_VALUE));
        UUID administratorId = UUID.randomUUID();
        PlatformAuthenticationService.PlatformAdminReadback administrator =
                new PlatformAuthenticationService.PlatformAdminReadback(
                        administratorId,
                        "root",
                        "Root",
                        null,
                        "ENABLED",
                        true,
                        1L,
                        1L,
                        2L,
                        null,
                        "NO_ADMIN_AUDIT_EVENT");
        when(service.platformAdministratorPage(null, null, null, 1, 50, "USER_NAME", "ASC"))
                .thenReturn(new PlatformAuthenticationService.PlatformAdminPage(
                        List.of(administrator), 1, 50, 1L, "USER_NAME", "ASC"));
        when(service.platformAdministratorDetail(administratorId)).thenReturn(administrator);
        PlatformAdminGovernanceController controller =
                new PlatformAdminGovernanceController(service, new PlatformSessionResolver(service));
        EdgeRequestContext request = new EdgeRequestContext(
                "fingerprint",
                "correlation",
                PlatformSessionCookie.fromCookie("platform-session"),
                null,
                null,
                null,
                null);

        assertEquals(
                1L,
                controller
                        .list(request, null, null, null, 1, 50, PlatformAdminSortKey.USER_NAME, SortDirection.ASC)
                        .total());
        assertEquals("Root", controller.detail(request, administratorId).userName());

        verify(service).platformAdministratorPage(null, null, null, 1, 50, "USER_NAME", "ASC");
        verify(service).platformAdministratorDetail(eq(administratorId));
    }
}
