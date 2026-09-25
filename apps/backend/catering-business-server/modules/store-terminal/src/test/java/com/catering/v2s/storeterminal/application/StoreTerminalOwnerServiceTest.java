package com.catering.v2s.storeterminal.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.audit.contract.AuditChange;
import com.catering.v2s.audit.contract.AuditEvent;
import com.catering.v2s.audit.contract.AuditEventWriter;
import com.catering.v2s.catalog.api.CatalogProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreContractLookup;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.CreateCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.ReplaceCommand;
import com.catering.v2s.storeterminal.api.StoreTerminalOwnerApi.StatusCommand;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService.ActivationCodeConflictException;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService.ActivationCodeExhaustedException;
import com.catering.v2s.storeterminal.application.StoreTerminalOwnerService.IdempotencyConflictException;
import com.catering.v2s.storeterminal.domain.ActivationCode;
import com.catering.v2s.storeterminal.persistence.StoreTerminalOwnerPersistence;
import com.catering.v2s.storeterminal.persistence.StoreTerminalOwnerPersistence.TerminalRow;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class StoreTerminalOwnerServiceTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID STORE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID TERMINAL = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID FUNCTION = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID AREA = UUID.fromString("00000000-0000-0000-0000-000000000005");
    private static final String GROUP_KEY = "terminal-test";
    private static final long NOW = 1_785_000_000_001L;
    private static final String MINIMAL_CONFIGURATION =
            """
            {
              "printers": [],
              "functions": [{
                "clientKey": "cashier",
                "functionKey": "ORDERING_CASHIER",
                "ranges": [],
                "scenes": []
              }]
            }
            """;
    private static final String REPLACE_CONFIGURATION =
            """
            {
              "printers": [],
              "functions": [{
                "ref": "00000000-0000-0000-0000-000000000004",
                "functionKey": "ORDERING_CASHIER",
                "ranges": [],
                "scenes": []
              }]
            }
            """;
    private static final String CONFIGURATION =
            """
            {
              "printers": [],
              "functions": [{
                "ref": "00000000-0000-0000-0000-000000000004",
                "functionKey": "ORDERING_CASHIER",
                "ranges": [{
                  "key": "TABLE_AREA",
                  "all": false,
                  "refs": ["00000000-0000-0000-0000-000000000005"]
                }],
                "scenes": []
              }]
            }
            """;

    @Test
    void manualCreateWritesOneAuditAndAReceiptWithoutActivationCode() throws Exception {
        OwnerHarness harness = ownerHarness(() -> {
            throw new AssertionError("manual activation code must not call the generator");
        });
        String code = "00123456";
        String key = "terminal-create-manual-0001";
        when(harness.persistence()
                        .insert(
                                any(UUID.class),
                                eq(WORKSPACE),
                                eq(GROUP_KEY),
                                eq(STORE),
                                eq("新终端"),
                                eq("新终端"),
                                eq("laptop"),
                                eq(code),
                                anyString(),
                                anyLong()))
                .thenReturn(true);

        var result = harness.service().createTerminal(createCommand(harness.json(), ActivationCode.of(code), key));

        assertEquals("ENABLED", result.status());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(harness.auditEvents(), times(1)).write(audit.capture());
        assertEquals("TERMINAL_CREATED", audit.getValue().action());
        AuditChange activationChange = audit.getValue().changes().stream()
                .filter(change -> change.fieldKey().equals("activationCode"))
                .findFirst()
                .orElseThrow();
        assertEquals("已签发", activationChange.afterValue());
        assertFalse(audit.getValue().toString().contains(code));

        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(harness.persistence())
                .insertReceipt(
                        eq(WORKSPACE), eq(GROUP_KEY), eq(key), requestHash.capture(), responseJson.capture(), eq(NOW));
        assertFalse(requestHash.getValue().contains(code));
        assertFalse(responseJson.getValue().contains(code));
        JsonNode response = harness.json().readTree(responseJson.getValue());
        Set<String> receiptFields = new java.util.HashSet<>();
        response.fieldNames().forEachRemaining(receiptFields::add);
        assertEquals(Set.of("terminalRef", "version", "status"), receiptFields);
    }

    @Test
    void auditConfigurationSummaryUsesReferenceNamesAndGeneratedLabels() throws Exception {
        OwnerHarness harness = ownerHarness(() -> "87654321");
        when(harness.persistence()
                        .insert(
                                any(UUID.class),
                                eq(WORKSPACE),
                                eq(GROUP_KEY),
                                eq(STORE),
                                eq("带范围终端"),
                                eq("带范围终端"),
                                eq("laptop"),
                                eq("00123456"),
                                anyString(),
                                anyLong()))
                .thenReturn(true);
        when(harness.servicePoints().readAreasByRefs(WORKSPACE, GROUP_KEY, STORE, List.of(AREA)))
                .thenReturn(List.of(new StoreServicePointOwnerApi.AreaReference(
                        AREA, STORE, "大厅桌台区", "TABLE-MAIN", "TABLE_AREA", "ENABLED")));
        JsonNode configuration = harness.json()
                .readTree(
                        """
                {
                  "printers": [],
                  "functions": [{
                    "clientKey": "cashier",
                    "functionKey": "ORDERING_CASHIER",
                    "ranges": [{
                      "key": "TABLE_AREA",
                      "all": false,
                      "refs": ["00000000-0000-0000-0000-000000000005"]
                    }],
                    "scenes": []
                  }]
                }
                """);

        harness.service()
                .createTerminal(new CreateCommand(
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "带范围终端",
                        "laptop",
                        ActivationCode.of("00123456"),
                        configuration,
                        "terminal-audit-summary-0001",
                        AuditActor.system(),
                        grant()));

        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(harness.auditEvents()).write(audit.capture());
        String summary = audit.getValue().changes().stream()
                .filter(change -> change.fieldKey().equals("ranges"))
                .map(AuditChange::afterValue)
                .findFirst()
                .orElseThrow();
        assertTrue(summary.contains("大厅桌台区（TABLE-MAIN）"));
        assertTrue(summary.contains("桌台区"));
        assertFalse(summary.contains(AREA.toString()));
        assertFalse(summary.contains("TABLE_AREA"));
    }

    @Test
    void manualActivationCodeReplayRejectsDifferentCodeWithoutRepeatingWrites() throws Exception {
        OwnerHarness harness = ownerHarness(() -> {
            throw new AssertionError("manual activation code replay must not call the generator");
        });
        String key = "terminal-create-manual-replay-0001";
        String originalCode = "00654321";
        String conflictingCode = "00654322";
        AtomicInteger insertCalls = new AtomicInteger();
        AtomicReference<String> persistedCode = new AtomicReference<>();
        doAnswer(invocation -> {
                    insertCalls.incrementAndGet();
                    persistedCode.set(invocation.getArgument(7));
                    return true;
                })
                .when(harness.persistence())
                .insert(
                        any(UUID.class),
                        any(UUID.class),
                        anyString(),
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong());

        var initialMutation =
                harness.service().createTerminal(createCommand(harness.json(), ActivationCode.of(originalCode), key));
        assertTrue(originalCode.equals(persistedCode.get()), "initial manual code should be persisted");

        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(harness.persistence())
                .insertReceipt(
                        eq(WORKSPACE), eq(GROUP_KEY), eq(key), requestHash.capture(), responseJson.capture(), eq(NOW));
        when(harness.persistence().findReceipt(WORKSPACE, GROUP_KEY, key))
                .thenReturn(new StoreTerminalOwnerPersistence.Receipt(requestHash.getValue(), responseJson.getValue()));
        when(harness.persistence().find(WORKSPACE, GROUP_KEY, STORE, initialMutation.terminalRef()))
                .thenReturn(new TerminalRow(
                        initialMutation.terminalRef(),
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "新终端",
                        "新终端",
                        "laptop",
                        "ENABLED",
                        1,
                        originalCode,
                        MINIMAL_CONFIGURATION,
                        NOW,
                        NOW));

        assertThrows(IdempotencyConflictException.class, () -> harness.service()
                .createTerminal(createCommand(harness.json(), ActivationCode.of(conflictingCode), key)));

        assertEquals(1, insertCalls.get());
        verify(harness.persistence(), times(1))
                .insertReceipt(eq(WORKSPACE), eq(GROUP_KEY), eq(key), anyString(), anyString(), eq(NOW));
        verify(harness.persistence()).find(WORKSPACE, GROUP_KEY, STORE, initialMutation.terminalRef());
        verify(harness.auditEvents(), times(1)).write(any(AuditEvent.class));
    }

    @Test
    void manualActivationCodeConflictDoesNotFallBackToGeneratedCode() throws Exception {
        AtomicInteger generatedCandidates = new AtomicInteger();
        OwnerHarness harness = ownerHarness(() -> {
            generatedCandidates.incrementAndGet();
            return "87654321";
        });
        when(harness.persistence()
                        .insert(
                                any(UUID.class),
                                eq(WORKSPACE),
                                eq(GROUP_KEY),
                                eq(STORE),
                                anyString(),
                                anyString(),
                                eq("laptop"),
                                eq("00000000"),
                                anyString(),
                                anyLong()))
                .thenReturn(false);

        assertThrows(ActivationCodeConflictException.class, () -> harness.service()
                .createTerminal(createCommand(
                        harness.json(), ActivationCode.of("00000000"), "terminal-create-manual-conflict")));

        assertEquals(0, generatedCandidates.get());
        verify(harness.persistence(), never())
                .insertReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString(), anyLong());
        verifyNoInteractions(harness.auditEvents());
    }

    @Test
    void automaticActivationCodeRetriesCollisionAndPersistsOnlyTheWinningCode() throws Exception {
        AtomicInteger generatedCandidates = new AtomicInteger();
        OwnerHarness harness = ownerHarness(() -> generatedCandidates.getAndIncrement() == 0 ? "10000001" : "10000002");
        String key = "terminal-create-automatic-0001";
        when(harness.persistence()
                        .insert(
                                any(UUID.class),
                                eq(WORKSPACE),
                                eq(GROUP_KEY),
                                eq(STORE),
                                eq("新终端"),
                                eq("新终端"),
                                eq("laptop"),
                                anyString(),
                                anyString(),
                                anyLong()))
                .thenReturn(false, true);

        var result = harness.service().createTerminal(createCommand(harness.json(), null, key));

        assertEquals(2, generatedCandidates.get());
        ArgumentCaptor<String> insertedCodes = ArgumentCaptor.forClass(String.class);
        verify(harness.persistence(), times(2))
                .insert(
                        any(UUID.class),
                        eq(WORKSPACE),
                        eq(GROUP_KEY),
                        eq(STORE),
                        eq("新终端"),
                        eq("新终端"),
                        eq("laptop"),
                        insertedCodes.capture(),
                        anyString(),
                        anyLong());
        assertEquals(List.of("10000001", "10000002"), insertedCodes.getAllValues());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(harness.auditEvents(), times(1)).write(audit.capture());
        assertEquals(
                "已签发",
                audit.getValue().changes().stream()
                        .filter(change -> change.fieldKey().equals("activationCode"))
                        .findFirst()
                        .orElseThrow()
                        .afterValue());
        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(harness.persistence())
                .insertReceipt(
                        eq(WORKSPACE), eq(GROUP_KEY), eq(key), requestHash.capture(), responseJson.capture(), eq(NOW));
        assertFalse(requestHash.getValue().contains("10000001"));
        assertFalse(requestHash.getValue().contains("10000002"));
        assertFalse(responseJson.getValue().contains("10000001"));
        assertFalse(responseJson.getValue().contains("10000002"));
        assertEquals("ENABLED", result.status());
    }

    @Test
    void automaticActivationCodeExhaustionWritesNoAuditOrReceipt() throws Exception {
        AtomicInteger generatedCandidates = new AtomicInteger();
        OwnerHarness harness = ownerHarness(
                () -> String.format(Locale.ROOT, "%08d", 10_000_000 + generatedCandidates.incrementAndGet()));
        when(harness.persistence()
                        .insert(
                                any(UUID.class),
                                eq(WORKSPACE),
                                eq(GROUP_KEY),
                                eq(STORE),
                                anyString(),
                                anyString(),
                                eq("laptop"),
                                anyString(),
                                anyString(),
                                anyLong()))
                .thenReturn(false);

        assertThrows(ActivationCodeExhaustedException.class, () -> harness.service()
                .createTerminal(createCommand(harness.json(), null, "terminal-create-auto-exhaust")));

        assertEquals(16, generatedCandidates.get());
        verify(harness.persistence(), never())
                .insertReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString(), anyLong());
        verifyNoInteractions(harness.auditEvents());
    }

    @Test
    void invalidConfigurationIsMappedToTypedOwnerFailureBeforeWrite() throws Exception {
        OwnerHarness harness = ownerHarness(() -> "87654321");
        JsonNode invalidConfiguration = harness.json()
                .readTree(
                        """
                {
                  "printers": [],
                  "functions": []
                }
                """);

        assertThrows(StoreTerminalOwnerService.InvalidTerminalRequestException.class, () -> harness.service()
                .createTerminal(new CreateCommand(
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "无效配置终端",
                        "laptop",
                        ActivationCode.of("00112233"),
                        invalidConfiguration,
                        "terminal-invalid-configuration-0001",
                        AuditActor.system(),
                        grant())));

        verify(harness.persistence(), never())
                .insert(
                        any(UUID.class),
                        any(UUID.class),
                        anyString(),
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong());
        verify(harness.persistence(), never())
                .insertReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString(), anyLong());
        verifyNoInteractions(harness.auditEvents());
    }

    @Test
    void invalidPrinterRuleIsMappedToTypedOwnerFailureBeforeWrite() throws Exception {
        OwnerHarness harness = ownerHarness(() -> "87654321");
        JsonNode invalidConfiguration = harness.json()
                .readTree(
                        """
                {
                  "printers": [{
                    "clientKey": "printer-1",
                    "name": "USB 打印机",
                    "brandKey": "EPSON",
                    "modelKey": "EPSON_TM_T88VII",
                    "paperSpecKey": "THERMAL_58",
                    "connectionMethodKey": "USB"
                  }],
                  "functions": [{
                    "clientKey": "cashier",
                    "functionKey": "ORDERING_CASHIER",
                    "ranges": [],
                    "scenes": []
                  }]
                }
                """);

        assertThrows(StoreTerminalOwnerService.InvalidTerminalRequestException.class, () -> harness.service()
                .createTerminal(new CreateCommand(
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "无效打印机终端",
                        "laptop",
                        ActivationCode.of("00112233"),
                        invalidConfiguration,
                        "terminal-invalid-printer-rule-0001",
                        AuditActor.system(),
                        grant())));

        verify(harness.persistence(), never())
                .insert(
                        any(UUID.class),
                        any(UUID.class),
                        anyString(),
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong());
        verify(harness.persistence(), never())
                .insertReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString(), anyLong());
        verifyNoInteractions(harness.auditEvents());
    }

    @Test
    void statusCommandWritesExactlyOneAuditAndSafeReceipt() throws Exception {
        OwnerHarness harness = ownerHarness(() -> "87654321");
        String key = "terminal-status-disable-0001";
        when(harness.persistence().lock(WORKSPACE, GROUP_KEY, STORE, TERMINAL))
                .thenReturn(new TerminalRow(
                        TERMINAL,
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "收银台",
                        "收银台",
                        "laptop",
                        "ENABLED",
                        1,
                        "01234567",
                        REPLACE_CONFIGURATION,
                        NOW - 1,
                        NOW - 1));
        when(harness.persistence().transition(WORKSPACE, GROUP_KEY, STORE, TERMINAL, "DISABLED", 1, NOW))
                .thenReturn(1);

        var result = harness.service()
                .transitionTerminalStatus(new StatusCommand(
                        WORKSPACE, GROUP_KEY, STORE, TERMINAL, "DISABLED", 1, key, AuditActor.system(), grant()));

        assertEquals("DISABLED", result.status());
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(harness.auditEvents(), times(1)).write(audit.capture());
        assertEquals("TERMINAL_STATUS_CHANGED", audit.getValue().action());
        assertEquals("ENABLED", audit.getValue().changes().getFirst().beforeValue());
        assertEquals("DISABLED", audit.getValue().changes().getFirst().afterValue());
        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(harness.persistence())
                .insertReceipt(
                        eq(WORKSPACE), eq(GROUP_KEY), eq(key), requestHash.capture(), responseJson.capture(), eq(NOW));
        assertFalse(responseJson.getValue().contains("01234567"));
        assertFalse(requestHash.getValue().contains("01234567"));
    }

    @Test
    void preservesPreviouslySelectedAreaWhenItsTypeChanges() throws Exception {
        StoreTerminalOwnerPersistence persistence = mock(StoreTerminalOwnerPersistence.class);
        StoreContractLookup stores = mock(StoreContractLookup.class);
        StoreServicePointOwnerApi servicePoints = mock(StoreServicePointOwnerApi.class);
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        CatalogProductionTagOwnerApi productionTags = mock(CatalogProductionTagOwnerApi.class);
        AuditEventWriter auditEvents = mock(AuditEventWriter.class);
        ObjectMapper json = new ObjectMapper();
        OperationsOwnerScopeGrant grant = new OperationsOwnerScopeGrant(
                WORKSPACE,
                GROUP_KEY,
                "replace-store-terminal",
                "EDIT_STORE_TERMINAL",
                "STORE",
                STORE,
                "GROUP",
                UUID.randomUUID(),
                List.of(),
                1L);
        when(stores.requireStoreContractContext(WORKSPACE, GROUP_KEY, STORE))
                .thenReturn(new StoreContractLookup.StoreContractContext(
                        STORE, UUID.randomUUID(), UUID.randomUUID(), "ENABLED", "ENABLED", List.of()));
        when(persistence.findReceipt(WORKSPACE, GROUP_KEY, "terminal-replace-0001"))
                .thenReturn(null);
        when(persistence.lock(WORKSPACE, GROUP_KEY, STORE, TERMINAL))
                .thenReturn(new TerminalRow(
                        TERMINAL,
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "收银台",
                        "收银台",
                        "laptop",
                        "ENABLED",
                        1,
                        "01234567",
                        CONFIGURATION,
                        1_785_000_000_000L,
                        1_785_000_000_000L));
        when(servicePoints.readAreasByRefs(WORKSPACE, GROUP_KEY, STORE, List.of(AREA)))
                .thenReturn(List.of(new StoreServicePointOwnerApi.AreaReference(
                        AREA, STORE, "入口扫码区", "SCAN-MAIN", "SCAN_AREA", "ENABLED")));
        when(persistence.replace(
                        eq(WORKSPACE),
                        eq(GROUP_KEY),
                        eq(STORE),
                        eq(TERMINAL),
                        eq("收银台更新"),
                        eq("收银台更新"),
                        eq("laptop"),
                        anyString(),
                        eq(1L),
                        eq(NOW)))
                .thenReturn(1);

        StoreTerminalOwnerService service = new StoreTerminalOwnerService(
                persistence,
                stores,
                servicePoints,
                catalogScopes,
                productionTags,
                (TimeProvider) () -> NOW,
                () -> "87654321",
                json,
                auditEvents);
        JsonNode configuration = json.readTree(CONFIGURATION);

        var result = service.replaceTerminal(new ReplaceCommand(
                WORKSPACE,
                GROUP_KEY,
                STORE,
                TERMINAL,
                "收银台更新",
                "laptop",
                configuration,
                1,
                "terminal-replace-0001",
                AuditActor.system(),
                grant));

        assertEquals(2, result.version());
        var savedConfiguration = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(persistence)
                .replace(
                        eq(WORKSPACE),
                        eq(GROUP_KEY),
                        eq(STORE),
                        eq(TERMINAL),
                        eq("收银台更新"),
                        eq("收银台更新"),
                        eq("laptop"),
                        savedConfiguration.capture(),
                        eq(1L),
                        eq(NOW));
        assertTrue(savedConfiguration.getValue().contains(AREA.toString()));
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditEvents, times(1)).write(audit.capture());
        assertEquals("TERMINAL_REPLACED", audit.getValue().action());
        ArgumentCaptor<String> requestHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> responseJson = ArgumentCaptor.forClass(String.class);
        verify(persistence)
                .insertReceipt(
                        eq(WORKSPACE),
                        eq(GROUP_KEY),
                        eq("terminal-replace-0001"),
                        requestHash.capture(),
                        responseJson.capture(),
                        eq(NOW));
        assertFalse(responseJson.getValue().contains("01234567"));
        assertFalse(requestHash.getValue().contains("01234567"));
        verifyNoInteractions(catalogScopes);
    }

    @Test
    void existingFunctionRefCannotChangeTypeAndDoesNotWrite() throws Exception {
        OwnerHarness harness = ownerHarness(() -> "87654321");
        when(harness.persistence().findReceipt(WORKSPACE, GROUP_KEY, "terminal-function-type-change-0001"))
                .thenReturn(null);
        when(harness.persistence().lock(WORKSPACE, GROUP_KEY, STORE, TERMINAL))
                .thenReturn(new TerminalRow(
                        TERMINAL,
                        WORKSPACE,
                        GROUP_KEY,
                        STORE,
                        "收银台",
                        "收银台",
                        "laptop",
                        "ENABLED",
                        1,
                        "01234567",
                        REPLACE_CONFIGURATION,
                        NOW - 1,
                        NOW - 1));

        JsonNode changed = harness.json().readTree(REPLACE_CONFIGURATION);
        ((ObjectNode) changed.path("functions").get(0)).put("functionKey", "KDS");

        assertThrows(
                StoreTerminalOwnerService.InvalidTerminalRequestException.class,
                () -> harness.service()
                        .replaceTerminal(new ReplaceCommand(
                                WORKSPACE,
                                GROUP_KEY,
                                STORE,
                                TERMINAL,
                                "收银台",
                                "laptop",
                                changed,
                                1,
                                "terminal-function-type-change-0001",
                                AuditActor.system(),
                                grant())));

        verify(harness.persistence(), never())
                .replace(
                        any(UUID.class),
                        anyString(),
                        any(UUID.class),
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyLong(),
                        anyLong());
        verify(harness.persistence(), never())
                .insertReceipt(any(UUID.class), anyString(), anyString(), anyString(), anyString(), anyLong());
        verifyNoInteractions(harness.auditEvents());
    }

    private static OwnerHarness ownerHarness(ActivationCodeCandidateSource candidateSource) {
        StoreTerminalOwnerPersistence persistence = mock(StoreTerminalOwnerPersistence.class);
        StoreContractLookup stores = mock(StoreContractLookup.class);
        StoreServicePointOwnerApi servicePoints = mock(StoreServicePointOwnerApi.class);
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        CatalogProductionTagOwnerApi productionTags = mock(CatalogProductionTagOwnerApi.class);
        AuditEventWriter auditEvents = mock(AuditEventWriter.class);
        ObjectMapper json = new ObjectMapper();
        when(stores.requireStoreContractContext(WORKSPACE, GROUP_KEY, STORE))
                .thenReturn(new StoreContractLookup.StoreContractContext(
                        STORE, UUID.randomUUID(), UUID.randomUUID(), "ENABLED", "ENABLED", List.of()));
        return new OwnerHarness(
                persistence,
                stores,
                servicePoints,
                catalogScopes,
                productionTags,
                auditEvents,
                json,
                new StoreTerminalOwnerService(
                        persistence,
                        stores,
                        servicePoints,
                        catalogScopes,
                        productionTags,
                        (TimeProvider) () -> NOW,
                        candidateSource,
                        json,
                        auditEvents));
    }

    private static CreateCommand createCommand(ObjectMapper json, ActivationCode activationCode, String key)
            throws Exception {
        return new CreateCommand(
                WORKSPACE,
                GROUP_KEY,
                STORE,
                "新终端",
                "laptop",
                activationCode,
                json.readTree(MINIMAL_CONFIGURATION),
                key,
                AuditActor.system(),
                grant());
    }

    private static OperationsOwnerScopeGrant grant() {
        return new OperationsOwnerScopeGrant(
                WORKSPACE,
                GROUP_KEY,
                "store-terminal-focused-test",
                "EDIT_STORE_TERMINAL",
                "STORE",
                STORE,
                "GROUP",
                UUID.randomUUID(),
                List.of(),
                1L);
    }

    private record OwnerHarness(
            StoreTerminalOwnerPersistence persistence,
            StoreContractLookup stores,
            StoreServicePointOwnerApi servicePoints,
            CatalogScopeLookup catalogScopes,
            CatalogProductionTagOwnerApi productionTags,
            AuditEventWriter auditEvents,
            ObjectMapper json,
            StoreTerminalOwnerService service) {}
}
