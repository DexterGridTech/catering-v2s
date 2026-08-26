package com.catering.v2s.platform.foundation.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Set;
import org.junit.jupiter.api.Test;

class RuntimeEnvironmentKeysTest {
    @Test
    void exposesTheClosedCrossLayerSetFromThePolicyResource() {
        assertEquals(
                Set.of(
                        RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_OPERATION,
                        RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RESULT,
                        RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_RUN_ID,
                        RuntimeEnvironmentKeys.V2S_BACKEND_ACCEPTANCE_SECRET,
                        RuntimeEnvironmentKeys.V2S_CATALOG_TEST_FAULTS,
                        RuntimeEnvironmentKeys.V2S_DB_OPERATIONS_EVENTS,
                        RuntimeEnvironmentKeys.V2S_DB_OPERATIONS_HMAC_KEY,
                        RuntimeEnvironmentKeys.V2S_DB_STATEMENT_DICTIONARY,
                        RuntimeEnvironmentKeys.V2S_DEV_NAMESPACE,
                        RuntimeEnvironmentKeys.V2S_DEV_PROFILE,
                        RuntimeEnvironmentKeys.V2S_L2_EVENTS,
                        RuntimeEnvironmentKeys.V2S_L2_RUN_ID,
                        RuntimeEnvironmentKeys.V2S_L2_SECRET,
                        RuntimeEnvironmentKeys.V2S_OPERATIONS_SESSION,
                        RuntimeEnvironmentKeys.V2S_PLATFORM_SESSION,
                        RuntimeEnvironmentKeys.V2S_RUNTIME_DIR,
                        RuntimeEnvironmentKeys.V2S_RUNTIME_ENVIRONMENT,
                        RuntimeEnvironmentKeys.V2S_TESTCONTAINERS_EXECUTION_PLANE),
                RuntimeEnvironmentKeys.CROSS_LAYER_KEYS);
    }
}
