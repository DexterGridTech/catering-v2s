package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

final class CommercialContractAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    CommercialContractAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(id = "contract.lifecycle-preserves-fields", module = "CONTRACT", operation = "commercialContractLifecycle")
    void commercialContractLifecyclePreservesFields(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-EDIT", "BC-CONTRACT-INVALIDATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(OPERATIONS_CONTRACT_CREATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts", session.cookie(), Map.of(
                "storeId", fixture.storeId().toString(),
                "phaseName", "Opening",
                "contractNo", "ACCEPT-CONTRACT-001",
                "effectiveFrom", "2026-01-01",
                "effectiveTo", "2026-12-31",
                "note", "created-by-http",
                "items", List.of(Map.of("code", "LATTE", "name", "Latte")),
                "extensionValues", List.of()), Set.of(201));
        String contractId = created.json().path("id").asText();
        assertEquals("VALID", created.json().path("status").asText(), "BUSINESS: active owner status maps to wire VALID");
        assertEquals("ACCEPT-CONTRACT-001", created.json().path("contractNo").asText(), "BUSINESS: contract number is written");
        assertEquals(fixture.storeId().toString(), created.json().path("store").path("id").asText(), "BUSINESS: contract remains bound to the selected store");
        assertEquals("LATTE", created.json().path("items").get(0).path("code").asText(), "BUSINESS: contract item code is written");
        assertEquals(1, created.json().path("revision").asInt(), "BUSINESS: contract starts at revision one");
        BackendAcceptanceTest.Response updated = context.patch(OPERATIONS_CONTRACT_UPDATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId, session.cookie(), Map.of(
                "phaseName", "Opening",
                "effectiveFrom", "2026-01-01",
                "effectiveTo", "2026-12-31",
                "note", "updated-by-http",
                "items", List.of(Map.of("code", "LATTE", "name", "Latte Updated")),
                "extensionValues", List.of(),
                "expectedVersion", 1), Set.of(200));
        assertEquals("updated-by-http", updated.json().path("note").asText(), "BUSINESS: update writes the note");
        assertEquals("Latte Updated", updated.json().path("items").get(0).path("name").asText(), "BUSINESS: update writes item labels");
        assertEquals(2, updated.json().path("revision").asInt(), "BUSINESS: update uses CAS revision two");
        BackendAcceptanceTest.Response invalidated = context.post(OPERATIONS_CONTRACT_INVALIDATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId + "/invalidate", session.cookie(), Map.of("expectedVersion", 2), Set.of(200));
        assertEquals("INVALID", invalidated.json().path("status").asText(), "BUSINESS: invalidation maps to wire INVALID");
        assertEquals(3, invalidated.json().path("revision").asInt(), "BUSINESS: invalidation is versioned");
        BackendAcceptanceTest.Response detail = context.get(OPERATIONS_CONTRACT, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId + "?expectedContextVersion=" + session.contextVersion(), session.cookie(), Set.of(200));
        assertEquals("INVALID", detail.json().path("status").asText(), "BUSINESS: invalid contract remains readable as history");
        assertEquals("Latte Updated", detail.json().path("items").get(0).path("name").asText(), "BUSINESS: invalidation preserves contract items");
    }

    @AcceptanceScenario(id = "contract.stale-edit-preserves-fixed-bindings", module = "CONTRACT", operation = "staleContractEditPreservesBindings")
    void staleContractEditPreservesFixedBindings(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(OPERATIONS_CONTRACT_CREATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts", session.cookie(), Map.of(
                "storeId", fixture.storeId().toString(), "phaseName", "Opening", "contractNo", "ACCEPT-CONTRACT-STALE", "effectiveFrom", "2026-01-01", "effectiveTo", "2026-12-31", "note", "initial", "items", List.of(Map.of("code", "LATTE", "name", "Latte")), "extensionValues", List.of()), Set.of(201));
        String contractId = created.json().path("id").asText();
        BackendAcceptanceTest.Response updated = context.patch(OPERATIONS_CONTRACT_UPDATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId, session.cookie(), Map.of(
                "phaseName", "Opening", "effectiveFrom", "2026-01-01", "effectiveTo", "2026-12-31", "note", "first-writer", "items", List.of(Map.of("code", "LATTE", "name", "Latte")), "extensionValues", List.of(), "expectedVersion", 1), Set.of(200));
        assertEquals(2, updated.json().path("revision").asInt(), "BUSINESS: first contract edit advances the owner revision");
        BackendAcceptanceTest.Response stale = context.patch(OPERATIONS_CONTRACT_UPDATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId, session.cookie(), Map.of(
                "phaseName", "Opening", "effectiveFrom", "2026-01-01", "effectiveTo", "2026-12-31", "note", "stale-writer", "items", List.of(Map.of("code", "LATTE", "name", "Latte")), "extensionValues", List.of(), "expectedVersion", 1), Set.of(409));
        assertEquals("CONTRACT_VERSION_CONFLICT", stale.problemCode(), "BUSINESS: stale contract edit is rejected by the contract owner");
        BackendAcceptanceTest.Response detail = context.get(OPERATIONS_CONTRACT, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId + "?expectedContextVersion=" + session.contextVersion(), session.cookie(), Set.of(200));
        assertEquals("first-writer", detail.json().path("note").asText(), "BUSINESS: stale edit cannot overwrite the accepted note");
        assertEquals("ACCEPT-CONTRACT-STALE", detail.json().path("contractNo").asText(), "BUSINESS: contract number remains fixed after a stale edit");
        assertEquals(fixture.storeId().toString(), detail.json().path("store").path("id").asText(), "BUSINESS: stale edit cannot change the fixed store binding");
    }

    @AcceptanceScenario(id = "contract.invalidation-updates-store-derived-status", module = "CONTRACT", operation = "contractInvalidationUpdatesStoreStatus")
    void contractInvalidationUpdatesStoreDerivedStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE", "BC-CONTRACT-INVALIDATE"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        BackendAcceptanceTest.Response created = context.post(OPERATIONS_CONTRACT_CREATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts", session.cookie(), Map.of(
                "storeId", fixture.storeId().toString(), "phaseName", "Opening", "contractNo", "ACCEPT-CONTRACT-DERIVED", "effectiveFrom", "2026-01-01", "effectiveTo", "2026-12-31", "note", "derived-status", "items", List.of(Map.of("code", "LATTE", "name", "Latte")), "extensionValues", List.of()), Set.of(201));
        String contractId = created.json().path("id").asText();
        BackendAcceptanceTest.Response operating = context.get(OPERATIONS_ORGANIZATION_STORE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/" + fixture.storeId() + "?expectedContextVersion=" + session.contextVersion(), session.cookie(), Set.of(200));
        assertEquals("ENABLED", operating.json().path("status").asText(), "BUSINESS: contract state does not change store master status");
        assertEquals("OPERATING", operating.json().path("contractDerivedStatus").asText(), "BUSINESS: an effective valid contract makes the store derived status operating");
        BackendAcceptanceTest.Response invalidated = context.post(OPERATIONS_CONTRACT_INVALIDATE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/contracts/" + contractId + "/invalidate", session.cookie(), Map.of("expectedVersion", 1), Set.of(200));
        assertEquals("INVALID", invalidated.json().path("status").asText(), "BUSINESS: contract invalidation is persisted");
        BackendAcceptanceTest.Response notOperating = context.get(OPERATIONS_ORGANIZATION_STORE, "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/organization/stores/" + fixture.storeId() + "?expectedContextVersion=" + session.contextVersion(), session.cookie(), Set.of(200));
        assertEquals("ENABLED", notOperating.json().path("status").asText(), "BUSINESS: invalidating a contract does not disable store master data");
        assertEquals("NOT_OPERATING", notOperating.json().path("contractDerivedStatus").asText(), "BUSINESS: invalidating the only effective contract recomputes derived status");
    }
}

