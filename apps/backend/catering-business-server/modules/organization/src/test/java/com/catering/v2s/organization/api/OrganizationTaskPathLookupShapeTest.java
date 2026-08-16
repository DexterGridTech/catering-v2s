package com.catering.v2s.organization.api;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.lang.reflect.Method;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationTaskPathLookupShapeTest {
    @Test
    void taskPathOperationsAreRequiredOwnerMethods() {
        Set<String> names = Set.of(
                "requireStatusTransitionTaskPath",
                "requireTaskPaths",
                "describePersistedTaskPaths",
                "availableTaskTargets",
                "describeTaskTargetLabels");

        for (Method method : OrganizationTaskPathLookup.class.getDeclaredMethods()) {
            if (names.contains(method.getName())) assertFalse(method.isDefault(), method.getName());
        }
    }
}
