package com.catering.v2s.app.edge.diagnostic;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;

/** Closed operation inventory for public authentication and recovery diagnostics. */
public final class PublicSecurityOperationRegistry {
    private static final Map<String, Definition> DEFINITIONS = Map.ofEntries(
            entry("platformPasswordLogin", "platform-iam", RequestMethod.POST, "/api/platform/auth/password-login"),
            entry("sendPlatformLoginOtp", "platform-iam", RequestMethod.POST, "/api/platform/auth/login-otp/send"),
            entry("verifyPlatformLoginOtp", "platform-iam", RequestMethod.POST, "/api/platform/auth/login-otp/verify"),
            entry(
                    "startPlatformPasswordRecovery",
                    "platform-iam",
                    RequestMethod.POST,
                    "/api/platform/auth/password-recovery/start"),
            entry(
                    "sendPlatformPasswordRecoveryOtp",
                    "platform-iam",
                    RequestMethod.POST,
                    "/api/platform/auth/password-recovery/otp/send"),
            entry(
                    "verifyPlatformPasswordRecoveryOtp",
                    "platform-iam",
                    RequestMethod.POST,
                    "/api/platform/auth/password-recovery/otp/verify"),
            entry(
                    "completePlatformPasswordRecovery",
                    "platform-iam",
                    RequestMethod.POST,
                    "/api/platform/auth/password-recovery/complete"),
            entry(
                    "operationsWorkspacePasswordLogin",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/password-login"),
            entry(
                    "sendOperationsWorkspaceOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/send"),
            entry(
                    "verifyOperationsWorkspaceOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/otp/verify"),
            entry(
                    "getOperationsWorkspaceLoginEntry",
                    "workspace-iam",
                    RequestMethod.GET,
                    "/api/operations/group-workspaces/{groupWorkspaceKey}/login-entry"),
            entry(
                    "startOperationsPasswordRecovery",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start"),
            entry(
                    "sendOperationsPasswordRecoveryOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send"),
            entry(
                    "verifyOperationsPasswordRecoveryOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify"),
            entry(
                    "completeOperationsPasswordRecovery",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete"),
            entry(
                    "getPublicInvitationView",
                    "workspace-iam",
                    RequestMethod.GET,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}"),
            entry(
                    "acceptPublicInvitation",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}"),
            entry(
                    "sendPublicInvitationOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/send"),
            entry(
                    "verifyPublicInvitationOtp",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/otp/verify"),
            entry(
                    "savePublicInvitationCredentials",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/credentials"),
            entry(
                    "completePublicInvitation",
                    "workspace-iam",
                    RequestMethod.POST,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/complete"),
            entry(
                    "getPublicInvitationCompletion",
                    "workspace-iam",
                    RequestMethod.GET,
                    "/api/public/invitations/{groupWorkspaceKey}/{invitationToken}/completion"));

    public Definition resolve(PublicSecurityOperation operation) {
        Definition definition = DEFINITIONS.get(operation.id());
        if (definition == null || !definition.owner().equals(operation.owner())) {
            throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_REGISTRY_MISMATCH");
        }
        return definition;
    }

    public Set<String> operationIds() {
        return DEFINITIONS.keySet();
    }

    public void validateAnnotatedMethods(Collection<Method> methods) {
        Map<String, Method> actual = new LinkedHashMap<>();
        for (Method method : methods) {
            PublicSecurityOperation operation = method.getAnnotation(PublicSecurityOperation.class);
            if (operation == null) continue;
            Definition definition = resolve(operation);
            if (actual.putIfAbsent(definition.operationId(), method) != null) {
                throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_DUPLICATE");
            }
        }
        if (!actual.keySet().equals(DEFINITIONS.keySet())) {
            throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_EXACT_SET_MISMATCH");
        }
    }

    public void validateMappings(Map<RequestMappingInfo, HandlerMethod> mappings) {
        Map<String, HandlerMethod> actual = new LinkedHashMap<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : mappings.entrySet()) {
            PublicSecurityOperation operation = entry.getValue().getMethodAnnotation(PublicSecurityOperation.class);
            if (operation == null) continue;
            Definition definition = resolve(operation);
            if (!entry.getKey().getPatternValues().equals(Set.of(definition.routeTemplate()))
                    || !entry.getKey().getMethodsCondition().getMethods().equals(Set.of(definition.method()))) {
                throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_ROUTE_MISMATCH");
            }
            if (actual.putIfAbsent(definition.operationId(), entry.getValue()) != null) {
                throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_DUPLICATE");
            }
        }
        if (!actual.keySet().equals(DEFINITIONS.keySet())) {
            throw new IllegalStateException("PUBLIC_SECURITY_OPERATION_EXACT_SET_MISMATCH");
        }
    }

    private static Map.Entry<String, Definition> entry(
            String operationId, String owner, RequestMethod method, String routeTemplate) {
        return Map.entry(operationId, new Definition(operationId, owner, method, routeTemplate));
    }

    public record Definition(String operationId, String owner, RequestMethod method, String routeTemplate) {}
}
