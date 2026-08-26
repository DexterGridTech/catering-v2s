package com.catering.v2s.platform.foundation.runtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.Set;

/** Cross-layer runtime names whose spelling is shared by Java and managed scripts. */
public final class RuntimeEnvironmentKeys {
    public static final String V2S_BACKEND_ACCEPTANCE_OPERATION = "V2S_BACKEND_ACCEPTANCE_OPERATION";
    public static final String V2S_BACKEND_ACCEPTANCE_RESULT = "V2S_BACKEND_ACCEPTANCE_RESULT";
    public static final String V2S_BACKEND_ACCEPTANCE_RUN_ID = "V2S_BACKEND_ACCEPTANCE_RUN_ID";
    public static final String V2S_BACKEND_ACCEPTANCE_SECRET = "V2S_BACKEND_ACCEPTANCE_SECRET";
    public static final String V2S_CATALOG_TEST_FAULTS = "V2S_CATALOG_TEST_FAULTS";
    public static final String V2S_DB_OPERATIONS_EVENTS = "V2S_DB_OPERATIONS_EVENTS";
    public static final String V2S_DB_OPERATIONS_HMAC_KEY = "V2S_DB_OPERATIONS_HMAC_KEY";
    public static final String V2S_DB_STATEMENT_DICTIONARY = "V2S_DB_STATEMENT_DICTIONARY";
    public static final String V2S_DEV_NAMESPACE = "V2S_DEV_NAMESPACE";
    public static final String V2S_DEV_PROFILE = "V2S_DEV_PROFILE";
    public static final String V2S_L2_EVENTS = "V2S_L2_EVENTS";
    public static final String V2S_L2_RUN_ID = "V2S_L2_RUN_ID";
    public static final String V2S_L2_SECRET = "V2S_L2_SECRET";
    public static final String V2S_OPERATIONS_SESSION = "V2S_OPERATIONS_SESSION";
    public static final String V2S_PLATFORM_SESSION = "V2S_PLATFORM_SESSION";
    public static final String V2S_RUNTIME_DIR = "V2S_RUNTIME_DIR";
    public static final String V2S_RUNTIME_ENVIRONMENT = "V2S_RUNTIME_ENVIRONMENT";
    public static final String V2S_TESTCONTAINERS_EXECUTION_PLANE = "V2S_TESTCONTAINERS_EXECUTION_PLANE";

    public static final Set<String> CROSS_LAYER_KEYS = Set.of(
            V2S_BACKEND_ACCEPTANCE_OPERATION,
            V2S_BACKEND_ACCEPTANCE_RESULT,
            V2S_BACKEND_ACCEPTANCE_RUN_ID,
            V2S_BACKEND_ACCEPTANCE_SECRET,
            V2S_CATALOG_TEST_FAULTS,
            V2S_DB_OPERATIONS_EVENTS,
            V2S_DB_OPERATIONS_HMAC_KEY,
            V2S_DB_STATEMENT_DICTIONARY,
            V2S_DEV_NAMESPACE,
            V2S_DEV_PROFILE,
            V2S_L2_EVENTS,
            V2S_L2_RUN_ID,
            V2S_L2_SECRET,
            V2S_OPERATIONS_SESSION,
            V2S_PLATFORM_SESSION,
            V2S_RUNTIME_DIR,
            V2S_RUNTIME_ENVIRONMENT,
            V2S_TESTCONTAINERS_EXECUTION_PLANE);

    static {
        verifyPolicyResource();
    }

    private RuntimeEnvironmentKeys() {}

    private static void verifyPolicyResource() {
        try (InputStream stream =
                RuntimeEnvironmentKeys.class.getClassLoader().getResourceAsStream("runtime-environment-keys.json")) {
            if (stream == null) throw new IllegalStateException("runtime environment key policy resource missing");
            JsonNode policy = new ObjectMapper().readTree(stream);
            if (policy.path("schemaVersion").asInt() != 1
                    || !"runtime-environment-keys".equals(policy.path("kind").asText())) {
                throw new IllegalStateException("runtime environment key policy header invalid");
            }
            var values = new LinkedHashSet<String>();
            policy.path("crossLayerKeys").forEach(value -> {
                if (value.isTextual() && !value.asText().isBlank()) values.add(value.asText());
            });
            if (!CROSS_LAYER_KEYS.equals(values)) {
                throw new IllegalStateException("runtime environment key policy drift");
            }
        } catch (Exception failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }
}
