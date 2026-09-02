package com.catering.v2s.app.edge.session;

import com.catering.v2s.app.edge.diagnostic.PublicSecurityDiagnosticRequestState;
import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.platform.session.PlatformSessionCookie;
import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService.PasswordRecoveryFlowCredential;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService.RecoveryFlowCredential;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService.RecoveryGrantCredential;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** The only adapter that turns servlet request data into controller-visible request facts. */
@Component
public final class EdgeRequestContextArgumentResolver implements HandlerMethodArgumentResolver {
    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.getParameterType().equals(EdgeRequestContext.class);
    }

    @Override
    public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer container,
            NativeWebRequest request,
            WebDataBinderFactory binderFactory) {
        HttpServletRequest servlet = request.getNativeRequest(HttpServletRequest.class);
        if (servlet == null) throw new IllegalStateException("servlet request is unavailable");
        RequestCompletionDiagnosticState completion = RequestCompletionDiagnosticState.find(servlet);
        String correlationId = completion == null
                ? PublicSecurityDiagnosticRequestState.correlationId(servlet)
                : completion.correlationId();
        Object trustedBrand = servlet.getAttribute("v2s.trusted.brandRef");
        return new EdgeRequestContext(
                rateLimitSourceFingerprint(servlet.getRemoteAddr()),
                correlationId,
                PlatformSessionCookie.fromCookie(cookie(servlet, RuntimeEnvironmentKeys.V2S_PLATFORM_SESSION)),
                OperationsSessionCookie.fromCookie(cookie(servlet, RuntimeEnvironmentKeys.V2S_OPERATIONS_SESSION)),
                PasswordRecoveryFlowCredential.fromEdgeCookie(cookie(servlet, "V2S_PLATFORM_PASSWORD_RECOVERY")),
                RecoveryFlowCredential.fromEdgeCookie(cookie(servlet, "V2S_OPERATIONS_RECOVERY_FLOW")),
                RecoveryGrantCredential.fromEdgeCookie(cookie(servlet, "V2S_OPERATIONS_RECOVERY_GRANT")),
                servlet.getHeader("X-Request-Id"),
                trustedBrand == null ? servlet.getHeader("X-Workspace-Brand-Ref") : trustedBrand.toString(),
                servlet.getHeader("X-Catalog-Test-Failure-Point"),
                servlet.getHeader("X-Catalog-Asset-Bind-Grants"),
                servlet.getHeader("X-Sales-Menu-Asset-Bind-Grants"));
    }

    private static String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private static String rateLimitSourceFingerprint(String sourceAddress) {
        return Sha256Hex.digest(sourceAddress == null ? "unavailable" : sourceAddress);
    }
}
