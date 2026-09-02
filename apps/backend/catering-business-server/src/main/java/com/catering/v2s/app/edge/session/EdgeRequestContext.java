package com.catering.v2s.app.edge.session;

import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService.PasswordRecoveryFlowCredential;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService.RecoveryFlowCredential;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService.RecoveryGrantCredential;
import java.util.UUID;

/**
 * Controller-visible request facts. Browser credentials are opaque values: raw session cookie extraction is face-local,
 * and raw recovery values are readable only by their owning service.
 */
public final class EdgeRequestContext {
    private final String rateLimitSourceFingerprint;
    private final String correlationId;
    private final PlatformSessionCookie platformSessionCookie;
    private final OperationsSessionCookie operationsSessionCookie;
    private final PasswordRecoveryFlowCredential platformRecoveryFlow;
    private final RecoveryFlowCredential operationsRecoveryFlow;
    private final RecoveryGrantCredential operationsRecoveryGrant;
    private final String requestId;
    private final String requestedBrandRef;
    private final String catalogTestFailurePoint;
    private final String catalogAssetBindGrants;
    private final String salesMenuAssetBindGrants;

    public EdgeRequestContext(
            String rateLimitSourceFingerprint,
            String correlationId,
            PlatformSessionCookie platformSessionCookie,
            OperationsSessionCookie operationsSessionCookie,
            PasswordRecoveryFlowCredential platformRecoveryFlow,
            RecoveryFlowCredential operationsRecoveryFlow,
            RecoveryGrantCredential operationsRecoveryGrant) {
        this(
                rateLimitSourceFingerprint,
                correlationId,
                platformSessionCookie,
                operationsSessionCookie,
                platformRecoveryFlow,
                operationsRecoveryFlow,
                operationsRecoveryGrant,
                null,
                null,
                null,
                null,
                null);
    }

    public EdgeRequestContext(
            String rateLimitSourceFingerprint,
            String correlationId,
            PlatformSessionCookie platformSessionCookie,
            OperationsSessionCookie operationsSessionCookie,
            PasswordRecoveryFlowCredential platformRecoveryFlow,
            RecoveryFlowCredential operationsRecoveryFlow,
            RecoveryGrantCredential operationsRecoveryGrant,
            String requestId,
            String requestedBrandRef,
            String catalogTestFailurePoint,
            String catalogAssetBindGrants) {
        this(
                rateLimitSourceFingerprint,
                correlationId,
                platformSessionCookie,
                operationsSessionCookie,
                platformRecoveryFlow,
                operationsRecoveryFlow,
                operationsRecoveryGrant,
                requestId,
                requestedBrandRef,
                catalogTestFailurePoint,
                catalogAssetBindGrants,
                null);
    }

    public EdgeRequestContext(
            String rateLimitSourceFingerprint,
            String correlationId,
            PlatformSessionCookie platformSessionCookie,
            OperationsSessionCookie operationsSessionCookie,
            PasswordRecoveryFlowCredential platformRecoveryFlow,
            RecoveryFlowCredential operationsRecoveryFlow,
            RecoveryGrantCredential operationsRecoveryGrant,
            String requestId,
            String requestedBrandRef,
            String catalogTestFailurePoint,
            String catalogAssetBindGrants,
            String salesMenuAssetBindGrants) {
        this.rateLimitSourceFingerprint = rateLimitSourceFingerprint;
        this.correlationId = correlationId;
        this.platformSessionCookie = platformSessionCookie;
        this.operationsSessionCookie = operationsSessionCookie;
        this.platformRecoveryFlow = platformRecoveryFlow;
        this.operationsRecoveryFlow = operationsRecoveryFlow;
        this.operationsRecoveryGrant = operationsRecoveryGrant;
        this.requestId =
                requestId == null || requestId.isBlank() ? UUID.randomUUID().toString() : requestId;
        this.requestedBrandRef = requestedBrandRef;
        this.catalogTestFailurePoint = catalogTestFailurePoint;
        this.catalogAssetBindGrants = catalogAssetBindGrants;
        this.salesMenuAssetBindGrants = salesMenuAssetBindGrants;
    }

    public String rateLimitSourceFingerprint() {
        return rateLimitSourceFingerprint;
    }

    public String correlationId() {
        return correlationId;
    }

    public PlatformSessionCookie platformSessionCookie() {
        return platformSessionCookie;
    }

    public OperationsSessionCookie operationsSessionCookie() {
        return operationsSessionCookie;
    }

    public PasswordRecoveryFlowCredential platformRecoveryFlow() {
        return platformRecoveryFlow;
    }

    public RecoveryFlowCredential operationsRecoveryFlow() {
        return operationsRecoveryFlow;
    }

    public RecoveryGrantCredential operationsRecoveryGrant() {
        return operationsRecoveryGrant;
    }

    public String requestId() {
        return requestId;
    }

    public String requestedBrandRef() {
        return requestedBrandRef;
    }

    public String catalogTestFailurePoint() {
        return catalogTestFailurePoint;
    }

    public String catalogAssetBindGrants() {
        return catalogAssetBindGrants;
    }

    public String salesMenuAssetBindGrants() {
        return salesMenuAssetBindGrants;
    }
}
