package com.catering.v2s.platform.asset.acceptance;

/**
 * Test-fixture-only contract consumed by the backend acceptance app suite.
 * Implementations stay in their owning module; this type contains no runtime endpoint or owner logic.
 */
public interface BackendAcceptanceScenarioProvider {
    Scenario scenario();

    interface Scenario {
        String operationId();
        String namespaceOwnership();
        String requestBuilder();
        String businessOracle();
        String performanceCriterion();
        String cleanup();
    }
}
