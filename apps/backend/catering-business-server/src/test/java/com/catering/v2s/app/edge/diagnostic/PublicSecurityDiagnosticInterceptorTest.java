package com.catering.v2s.app.edge.diagnostic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.app.edge.operations.session.OperationsCatalogAuthenticationController;
import com.catering.v2s.app.edge.operations.session.OperationsWorkspaceLoginEntryController;
import com.catering.v2s.app.edge.platform.session.PlatformAuthenticationController;
import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.publicentry.invitation.PublicInvitationController;
import com.catering.v2s.app.edge.publicentry.passwordrecovery.OperationsPasswordRecoveryController;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

class PublicSecurityDiagnosticInterceptorTest {
    private final PublicSecurityOperationRegistry registry = new PublicSecurityOperationRegistry();

    @Test
    void fixedRegistryRequiresTheCompleteTwentyTwoOperationAnnotationSet() {
        List<Method> methods = new ArrayList<>();
        for (Class<?> type : List.of(
                PlatformAuthenticationController.class,
                OperationsCatalogAuthenticationController.class,
                OperationsWorkspaceLoginEntryController.class,
                OperationsPasswordRecoveryController.class,
                PublicInvitationController.class)) {
            methods.addAll(Arrays.asList(type.getDeclaredMethods()));
        }

        registry.validateAnnotatedMethods(methods);
        assertEquals(22, registry.operationIds().size());
        assertThrows(IllegalStateException.class, () -> registry.resolve(InvalidOperation.class.getDeclaredMethod("unregistered").getAnnotation(PublicSecurityOperation.class)));
    }

    @Test
    void everyActualPublicSecurityHandlerEmitsExactlyOneSuccessTerminal() {
        List<SecurityDiagnosticEvent> events = new ArrayList<>();
        PublicSecurityDiagnosticInterceptor interceptor = new PublicSecurityDiagnosticInterceptor(registry, events::add);
        Map<Class<?>, Object> controllers = Map.of(
                PlatformAuthenticationController.class, new PlatformAuthenticationController(null, null, new com.catering.v2s.app.edge.session.EdgeSessionCookieWriter()),
                OperationsCatalogAuthenticationController.class, new OperationsCatalogAuthenticationController(null, null, new com.catering.v2s.app.edge.session.EdgeSessionCookieWriter(), null),
                OperationsWorkspaceLoginEntryController.class, new OperationsWorkspaceLoginEntryController(null, null, null, null),
                OperationsPasswordRecoveryController.class, new OperationsPasswordRecoveryController(null, null, null, new com.catering.v2s.app.edge.session.EdgeSessionCookieWriter()),
                PublicInvitationController.class, new PublicInvitationController(null, null, null));

        controllers.forEach((type, controller) -> Arrays.stream(type.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(PublicSecurityOperation.class))
                .forEach(method -> {
                    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/irrelevant");
                    MockHttpServletResponse response = new MockHttpServletResponse();
                    try {
                        interceptor.preHandle(request, response, new HandlerMethod(controller, method));
                        interceptor.afterCompletion(request, response, new HandlerMethod(controller, method), null);
                    } catch (Exception failure) {
                        throw new AssertionError(failure);
                    }
                    assertEquals(2, events.size());
                    assertEquals(method.getAnnotation(PublicSecurityOperation.class).id(), events.get(0).context().operationId());
                    assertEquals("REQUEST_SUCCEEDED", events.get(1).event());
                    events.clear();
                }));
    }

    @Test
    void writesOneStartAndOneTerminalAcrossRepeatedErrorDispatchCallbacks() throws Exception {
        List<SecurityDiagnosticEvent> events = new ArrayList<>();
        PublicSecurityDiagnosticInterceptor interceptor = new PublicSecurityDiagnosticInterceptor(registry, events::add);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/not-used-for-diagnostics");
        request.addHeader("X-Correlation-Id", "unsafe value");
        MockHttpServletResponse response = new MockHttpServletResponse();
        HandlerMethod handler = new HandlerMethod(new ValidOperation(), ValidOperation.class.getDeclaredMethod("login"));

        interceptor.preHandle(request, response, handler);
        interceptor.preHandle(request, response, handler);
        response.setStatus(401);
        PublicSecurityDiagnosticRequestState.freezeFailure(request, 401, "PLATFORM_IAM_INVALID_CREDENTIALS");
        interceptor.afterCompletion(request, response, handler, null);
        interceptor.afterCompletion(request, response, handler, null);

        assertEquals(2, events.size());
        assertEquals("REQUEST_STARTED", events.get(0).event());
        assertEquals("REQUEST_FAILED", events.get(1).event());
        assertEquals("PLATFORM_IAM_INVALID_CREDENTIALS", events.get(1).errorCode());
        assertEquals("/api/platform/auth/password-login", events.get(1).context().routeTemplate());
        assertNotEquals("unsafe value", events.get(0).context().correlationId());
    }

    @Test
    void unhandledFailureUsesFixedErrorCodeAndNeverLeaksExceptionText() throws Exception {
        List<SecurityDiagnosticEvent> events = new ArrayList<>();
        PublicSecurityDiagnosticInterceptor interceptor = new PublicSecurityDiagnosticInterceptor(registry, events::add);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(500);
        HandlerMethod handler = new HandlerMethod(new ValidOperation(), ValidOperation.class.getDeclaredMethod("login"));

        interceptor.preHandle(request, response, handler);
        interceptor.afterCompletion(request, response, handler, new IllegalStateException("password=not-for-diagnostics"));

        assertEquals("PLATFORM_COMMON_RESULT_UNKNOWN", events.get(1).errorCode());
        assertNotEquals("password=not-for-diagnostics", events.get(1).errorCode());
    }

    @Test
    void recorderFailureDoesNotChangeInterceptorOrHttpControlFlow() throws Exception {
        PublicSecurityDiagnosticInterceptor interceptor = new PublicSecurityDiagnosticInterceptor(registry, event -> {
            throw new IllegalStateException("diagnostic sink unavailable");
        });
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/platform/auth/password-login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        HandlerMethod handler = new HandlerMethod(new ValidOperation(), ValidOperation.class.getDeclaredMethod("login"));

        assertDoesNotThrow(() -> interceptor.preHandle(request, response, handler));
        assertDoesNotThrow(() -> interceptor.afterCompletion(request, response, handler, null));
        assertEquals(200, response.getStatus());
    }

    @Test
    void globalAndControllerLocalProblemAdaptersFreezeTheExistingRequestState() throws Exception {
        List<SecurityDiagnosticEvent> events = new ArrayList<>();
        PublicSecurityDiagnosticInterceptor interceptor = new PublicSecurityDiagnosticInterceptor(registry, events::add);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/platform/auth/login-otp/send");
        MockHttpServletResponse response = new MockHttpServletResponse();
        HandlerMethod handler = new HandlerMethod(new ValidOperation(), ValidOperation.class.getDeclaredMethod("login"));

        interceptor.preHandle(request, response, handler);
        var global = ContractProblemAdvice.problem(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                "WORKSPACE_IAM_OTP_INVALID", "验证码不可用或已失效", request);
        response.setStatus(global.getStatusCode().value());
        interceptor.afterCompletion(request, response, handler, null);
        assertEquals("WORKSPACE_IAM_OTP_INVALID", events.get(1).errorCode());

        events.clear();
        MockHttpServletRequest localRequest = new MockHttpServletRequest("POST", "/api/platform/auth/login-otp/send");
        MockHttpServletResponse localResponse = new MockHttpServletResponse();
        interceptor.preHandle(localRequest, localResponse, handler);
        var local = ContractProblemAdvice.problem(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                "PLATFORM_IAM_RATE_LIMITED", "验证码请求次数过多，请稍后再试", localRequest);
        localResponse.setStatus(local.getStatusCode().value());
        interceptor.afterCompletion(localRequest, localResponse, handler, null);
        assertEquals("PLATFORM_IAM_RATE_LIMITED", events.get(1).errorCode());
    }

    private static final class ValidOperation {
        @PublicSecurityOperation(id = "platformPasswordLogin", owner = "platform-iam")
        void login() { }
    }

    private static final class InvalidOperation {
        @PublicSecurityOperation(id = "pageKey", owner = "platform-iam")
        void unregistered() { }
    }
}
