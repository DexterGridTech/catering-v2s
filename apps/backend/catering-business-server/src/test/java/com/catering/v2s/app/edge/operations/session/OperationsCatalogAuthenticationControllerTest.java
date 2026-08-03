package com.catering.v2s.app.edge.operations.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordLoginRequest;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsCatalogAuthenticationControllerTest {
    private static final String KEY = "operations-auth-test";
    private static final String TOKEN = "opaque-session-token";

    @Test
    void passwordLoginUsesOwnerReturnedEntryWithoutSecondOwnerRead() {
        Fixture fixture = fixture();
        when(fixture.sessions.loginWithSessionEntry(KEY, "operator", "valid-password".toCharArray(), "test-rate-limit-fingerprint"))
            .thenReturn(new WorkspaceAuthenticationService.LoginEntryResult(TOKEN, fixture.entry));

        var response = fixture.controller.login(fixture.request, KEY, new WorkspacePasswordLoginRequest("operator", "valid-password"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals(KEY, response.getBody().groupWorkspaceKey());
        assertEquals(7L, response.getBody().contextVersion());
        assertEquals("EMPTY_WORKBENCH", response.getBody().outcome());
        assertEquals(TOKEN, cookieValue(response.getHeaders().getFirst("Set-Cookie")));
        verify(fixture.sessions).loginWithSessionEntry(KEY, "operator", "valid-password".toCharArray(), "test-rate-limit-fingerprint");
        verify(fixture.sessions, never()).sessionEntry(anyString());
    }

    @Test
    void otpVerifyUsesOwnerReturnedEntryWithoutSecondOwnerRead() {
        Fixture fixture = fixture();
        when(fixture.sessions.verifyLoginOtpWithSessionEntry(KEY, "13800000000", "654321"))
            .thenReturn(new WorkspaceAuthenticationService.LoginEntryResult(TOKEN, fixture.entry));

        var response = fixture.controller.verifyOtp(KEY, "operations-auth-idempotency-key", new WorkspaceOtpVerifyRequest("13800000000", "654321"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals(KEY, response.getBody().groupWorkspaceKey());
        assertEquals(TOKEN, cookieValue(response.getHeaders().getFirst("Set-Cookie")));
        verify(fixture.sessions).verifyLoginOtpWithSessionEntry(KEY, "13800000000", "654321");
        verify(fixture.sessions, never()).sessionEntry(anyString());
    }

    @Test
    void sessionEntryDelegatesTokenAndWorkspaceGuardToTheOwnerOnce() {
        Fixture fixture = fixture();
        when(fixture.sessions.sessionEntry(TOKEN, KEY)).thenReturn(fixture.entry);

        var response = fixture.controller.entry(fixture.request, KEY);

        assertEquals(KEY, response.groupWorkspaceKey());
        assertEquals(7L, response.contextVersion());
        verify(fixture.sessions).sessionEntry(TOKEN, KEY);
        verify(fixture.sessions, never()).session(TOKEN);
        verify(fixture.sessions, never()).sessionEntry(TOKEN);
    }

    private static Fixture fixture() {
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        WorkspaceSessionEntryReadback entry = new WorkspaceSessionEntryReadback(
            KEY, UUID.randomUUID(), "Operations tester", "Operations workspace", "Operations title", null,
            7L, WorkspaceSessionEntryReadback.Mode.EMPTY, WorkspaceSessionEntryReadback.Outcome.EMPTY_WORKBENCH,
            List.of(), Set.of(), List.of(), null, null
        );
        EdgeRequestContext request = new EdgeRequestContext("test-rate-limit-fingerprint", "test-correlation", null, OperationsSessionCookie.fromCookie(TOKEN), null, null, null);
        OperationsCatalogAuthenticationController controller = new OperationsCatalogAuthenticationController(
            sessions, new OperationsSessionResolver(sessions), new EdgeSessionCookieWriter(), mock(PlatformAssetService.class)
        );
        return new Fixture(controller, sessions, request, entry);
    }

    private static String cookieValue(String setCookie) { return setCookie.substring(setCookie.indexOf('=') + 1, setCookie.indexOf(';')); }

    private record Fixture(OperationsCatalogAuthenticationController controller, WorkspaceAuthenticationService sessions, EdgeRequestContext request, WorkspaceSessionEntryReadback entry) { }
}
