package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class WorkspaceTaskReadServiceTest {
    @Test
    void exposesOnlyNamedWorkspaceReadShapesAndNoOperationSelectedDispatcher() {
        Set<String> publicMethods = Arrays.stream(WorkspaceTaskReadService.class.getDeclaredMethods())
            .filter(method -> java.lang.reflect.Modifier.isPublic(method.getModifiers()))
            .map(Method::getName)
            .collect(Collectors.toSet());

        assertEquals(Set.of("userPage", "userDetail", "invitationCandidates", "invitations", "sessionEntry"), publicMethods);
        assertFalse(Arrays.stream(WorkspaceTaskReadService.class.getDeclaredMethods())
            .flatMap(method -> Arrays.stream(method.getParameterTypes()))
            .anyMatch(parameter -> parameter.getSimpleName().equals("OperationDescriptor") || parameter.getSimpleName().equals("OperationId")));
    }
}
