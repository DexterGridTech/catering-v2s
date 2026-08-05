package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class WorkspaceAuthenticationServiceNodeTypeTest {
    @Test
    void onlyTheContractServiceNodeVocabularyIsEnterable() {
        for (String type : new String[]{"GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE"}) {
            assertTrue(WorkspaceAuthenticationService.isSupportedServiceNodeType(type), type);
        }
        for (String type : new String[]{null, "BRAND", "TENANT", "UNKNOWN"}) {
            assertFalse(WorkspaceAuthenticationService.isSupportedServiceNodeType(type), type);
        }
    }
}
