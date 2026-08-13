package com.catering.v2s.app.acceptance;

/**
 * Provider SPI consumed by the acceptance suite. Implementations remain in the owning module's
 * test-fixtures source set; this type carries only capability metadata and no owner logic.
 */
public interface BackendAcceptanceScenarioProvider
        extends com.catering.v2s.platform.asset.acceptance.BackendAcceptanceScenarioProvider {
}
