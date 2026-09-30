package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;

/** Real HTTP business oracles for the store-terminal aggregate. */
final class StoreTerminalAcceptanceScenarios {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<Integer> OK = Set.of(200);
    private static final Set<Integer> CREATED = Set.of(201);
    private static final Set<Integer> CLIENT_FAILURE = Set.of(400, 403, 404, 409, 422);
    private static final String EDIT = "EDIT_STORE_TERMINAL";

    private final BackendAcceptanceTest host;

    enum ConnectionRevocationAction {
        DEVICE_CANCEL,
        OPERATIONS_CANCEL,
        TERMINAL_VOID,
        SAME_DEVICE_REACTIVATION
    }

    enum ConnectionStatusOnlyChange {
        TERMINAL_DISABLED,
        GROUP_WORKSPACE_DISABLED,
        STORE_DISABLED,
        STORE_VOIDED
    }

    record ConnectionFixture(
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session,
            UUID terminalRef,
            String activationCode,
            String deviceId,
            String credentialSecret,
            long generation) {}

    StoreTerminalAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    ConnectionFixture createConnectionContractFixture(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "TDS connection contract", null);
        String activationCode =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "tds-acceptance-device-" + UUID.randomUUID();
        String credentialSecret = newCredentialSecret();
        BackendAcceptanceTest.Response activated = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, credentialSecret),
                Map.of(),
                OK);
        assertEquals(
                terminalRef.toString(), activated.json().path("terminalRef").asText());
        assertEquals(1, activated.json().path("bindingGeneration").asLong());
        assertFalse(activated.raw().contains(credentialSecret), "CONTRACT SETUP: activation never returns its secret");
        return new ConnectionFixture(
                store.fixture(), store.session(), terminalRef, activationCode, deviceId, credentialSecret, 1);
    }

    ConnectionFixture reactivateConnectionContractFixture(
            BackendAcceptanceTest.ScenarioContext context, ConnectionFixture fixture) throws Exception {
        String nextSecret = newCredentialSecret();
        BackendAcceptanceTest.Response reactivated = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(fixture.fixture()),
                null,
                activationBody(fixture.activationCode(), fixture.deviceId(), nextSecret),
                Map.of(),
                OK);
        assertEquals(
                fixture.terminalRef().toString(),
                reactivated.json().path("terminalRef").asText());
        assertEquals(
                fixture.generation() + 1,
                reactivated.json().path("bindingGeneration").asLong());
        assertFalse(reactivated.raw().contains(nextSecret), "CONTRACT SETUP: reactivation never returns its secret");
        return new ConnectionFixture(
                fixture.fixture(),
                fixture.session(),
                fixture.terminalRef(),
                fixture.activationCode(),
                fixture.deviceId(),
                nextSecret,
                fixture.generation() + 1);
    }

    void performConnectionRevocation(
            BackendAcceptanceTest.ScenarioContext context, ConnectionFixture fixture, ConnectionRevocationAction action)
            throws Exception {
        switch (action) {
            case DEVICE_CANCEL -> {
                BackendAcceptanceTest.Response cancelled = context.post(
                        BackendAcceptanceTest.TERMINAL_DEVICE_ACTIVATION_CANCEL,
                        terminalActivationCancelPath(fixture.fixture(), fixture.terminalRef()),
                        null,
                        Map.of("deviceId", fixture.deviceId()),
                        Map.of("Authorization", terminalCredential(fixture.generation(), fixture.credentialSecret())),
                        OK);
                assertEquals("CANCELLED", cancelled.json().path("outcome").asText());
            }
            case OPERATIONS_CANCEL -> {
                BackendAcceptanceTest.Response cancelled = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                        operationsTerminalActivationCancelPath(fixture.fixture(), fixture.terminalRef()),
                        fixture.session().cookie(),
                        Map.of("expectedBindingGeneration", fixture.generation()),
                        Map.of("Idempotency-Key", "tds-acceptance-cancel-" + UUID.randomUUID()),
                        OK);
                assertEquals("CANCELLED", cancelled.json().path("outcome").asText());
            }
            case TERMINAL_VOID -> {
                StoreContext store = new StoreContext(fixture.fixture(), fixture.session());
                transitionTerminalStatus(context, store, fixture.terminalRef(), "DISABLED");
                transitionTerminalStatus(context, store, fixture.terminalRef(), "VOIDED");
            }
            case SAME_DEVICE_REACTIVATION -> reactivateConnectionContractFixture(context, fixture);
        }
    }

    void performConnectionStatusOnlyChange(
            BackendAcceptanceTest.ScenarioContext context, ConnectionFixture fixture, ConnectionStatusOnlyChange change)
            throws Exception {
        switch (change) {
            case TERMINAL_DISABLED -> transitionTerminalStatus(
                    context, new StoreContext(fixture.fixture(), fixture.session()), fixture.terminalRef(), "DISABLED");
            case GROUP_WORKSPACE_DISABLED -> {
                host.ensurePlatformAdministrator();
                BackendAcceptanceTest.Session platform = host.platformLogin(context);
                String path =
                        "/api/platform/group-workspaces/" + fixture.fixture().groupWorkspaceKey();
                long version = context.get(
                                BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_DETAIL, path, platform.cookie(), OK)
                        .json()
                        .path("version")
                        .asLong();
                String idempotencyKey = "tds-acceptance-group-disable-" + UUID.randomUUID();
                BackendAcceptanceTest.Response disabled = context.post(
                        BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_STATUS,
                        path + "/status",
                        platform.cookie(),
                        Map.of(
                                "targetStatus", "DISABLED",
                                "expectedVersion", version,
                                "idempotencyKey", idempotencyKey),
                        Map.of("Idempotency-Key", idempotencyKey),
                        OK);
                assertEquals("DISABLED", disabled.json().path("status").asText());
            }
            case STORE_DISABLED -> transitionStoreStatus(context, fixture, "DISABLED");
            case STORE_VOIDED -> transitionStoreStatus(context, fixture, "VOIDED");
        }
    }

    private void transitionStoreStatus(
            BackendAcceptanceTest.ScenarioContext context, ConnectionFixture fixture, String targetStatus)
            throws Exception {
        BackendAcceptanceTest.Fixture statusActor =
                host.projectUserFixture(fixture.fixture(), Set.of("BC-ORG-STORE-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, statusActor);
        BackendAcceptanceTest.Session statusSession =
                selectStore(context, statusActor, host.login(context, statusActor));
        String path = "/api/operations/group-workspaces/" + fixture.fixture().groupWorkspaceKey()
                + "/organization/stores/" + fixture.fixture().storeId() + "/status";
        BackendAcceptanceTest.Response changed = context.post(
                BackendAcceptanceTest.OPERATIONS_ORGANIZATION_STORE_STATUS,
                path,
                statusSession.cookie(),
                Map.of(
                        "targetStatus",
                        targetStatus,
                        "expectedVersion",
                        host.organizationStoreVersion(fixture.fixture().storeId())),
                idempotency(),
                OK);
        assertEquals(targetStatus, changed.json().path("status").asText());
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationInputs",
            module = "ORG",
            operation = "storeTerminalActivationInputs")
    void storeTerminalActivationInputs(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Response created = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("Manual terminal", "01234567"),
                idempotency(),
                CREATED);
        UUID terminalRef = UUID.fromString(created.json().path("terminalRef").asText());
        JsonNode detail = readDetail(context, store, terminalRef);
        assertEquals(
                "01234567",
                detail.path("activationCode").asText(),
                "BUSINESS: manually supplied activation code is preserved exactly");
        assertEquals("Manual terminal", detail.path("name").asText());

        BackendAcceptanceTest.Response automatic = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("Automatic terminal", null),
                idempotency(),
                CREATED);
        UUID automaticRef = UUID.fromString(automatic.json().path("terminalRef").asText());
        String automaticCode =
                readDetail(context, store, automaticRef).path("activationCode").asText();
        assertTrue(automaticCode.matches("[0-9]{8}"), "BUSINESS: omitted code is generated as eight digits");

        JsonNode page = context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                        terminalsPath(store.fixture()) + "?pageSize=20",
                        store.session().cookie(),
                        OK)
                .json();
        assertFalse(page.toString().contains("01234567"), "BUSINESS: list response never exposes activation codes");
        assertFalse(page.toString().contains(automaticCode), "BUSINESS: list response never exposes generated codes");

        for (Object explicit : new Object[] {null, ""}) {
            BackendAcceptanceTest.Response generated = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBodyWithActivationField(
                            "显式自动生成 " + (explicit == null ? "null" : "empty"), explicit, configuration()),
                    idempotency(),
                    CREATED);
            UUID generatedRef =
                    UUID.fromString(generated.json().path("terminalRef").asText());
            assertTrue(readDetail(context, store, generatedRef)
                    .path("activationCode")
                    .asText()
                    .matches("[0-9]{8}"));
        }
        for (String invalidCode : List.of("1234567", "123456789", "12A45678")) {
            BackendAcceptanceTest.Response invalid = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBody("非法激活码 " + invalidCode, invalidCode, configuration()),
                    idempotency(),
                    CLIENT_FAILURE);
            assertProblem(invalid, "PLATFORM_COMMON_VALIDATION_FAILED");
            assertFalse(context.get(
                            BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                            terminalsPath(store.fixture()),
                            store.session().cookie(),
                            OK)
                    .json()
                    .toString()
                    .contains("非法激活码"));
        }
    }

    @AcceptanceScenario(
            id = "storeTerminalDeviceActivationProtocols",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalDeviceActivationProtocols")
    void storeTerminalDeviceActivationProtocols(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "匿名激活终端", "59000001");
        String activationCode =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "terminal-device-" + UUID.randomUUID();
        String firstSecret = newCredentialSecret();

        BackendAcceptanceTest.Response activated = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, firstSecret),
                Map.of(),
                OK);
        assertEquals(
                terminalRef.toString(), activated.json().path("terminalRef").asText());
        assertEquals(
                store.fixture().storeId().toString(),
                activated.json().path("storeRef").asText());
        assertEquals(
                store.fixture().groupWorkspaceKey(),
                activated.json().path("groupWorkspaceKey").asText());
        assertEquals(1, activated.json().path("bindingGeneration").asLong());
        assertTrue(activated.http().request().headers().firstValue("Cookie").isEmpty());
        assertTrue(
                activated.http().request().headers().firstValue("Authorization").isEmpty());
        assertTrue(activated
                .http()
                .request()
                .headers()
                .firstValue("Idempotency-Key")
                .isEmpty());
        assertFalse(activated.raw().contains(firstSecret), "BUSINESS: anonymous activation never returns the secret");
        assertTrue(activated.http().headers().allValues("set-cookie").isEmpty());
        JsonNode activeDetail = readDetail(context, store, terminalRef);
        assertEquals("ACTIVE", activeDetail.path("binding").path("status").asText());
        assertEquals(1, activeDetail.path("binding").path("generation").asLong());

        String invalidCredentialMarker = "INVALID_TERMINAL_CREDENTIAL_" + UUID.randomUUID();
        BackendAcceptanceTest.Response invalidCredential = context.post(
                BackendAcceptanceTest.TERMINAL_DEVICE_ACTIVATION_CANCEL,
                terminalActivationCancelPath(store.fixture(), terminalRef),
                null,
                Map.of("deviceId", deviceId),
                Map.of("Authorization", terminalCredential(1, invalidCredentialMarker)),
                CLIENT_FAILURE);
        assertProblem(invalidCredential, "TERMINAL_BINDING_CREDENTIAL_INVALID");
        assertFalse(invalidCredential.raw().contains(invalidCredentialMarker));
        assertEquals(
                "ACTIVE",
                readDetail(context, store, terminalRef)
                        .path("binding")
                        .path("status")
                        .asText());

        BackendAcceptanceTest.Response deviceCancelled = context.post(
                BackendAcceptanceTest.TERMINAL_DEVICE_ACTIVATION_CANCEL,
                terminalActivationCancelPath(store.fixture(), terminalRef),
                null,
                Map.of("deviceId", deviceId),
                Map.of("Authorization", terminalCredential(1, firstSecret)),
                OK);
        assertEquals("CANCELLED", deviceCancelled.json().path("outcome").asText());
        BackendAcceptanceTest.Response repeatDeviceCancel = context.post(
                BackendAcceptanceTest.TERMINAL_DEVICE_ACTIVATION_CANCEL,
                terminalActivationCancelPath(store.fixture(), terminalRef),
                null,
                Map.of("deviceId", deviceId),
                Map.of("Authorization", terminalCredential(1, firstSecret)),
                OK);
        assertEquals(
                "ALREADY_CANCELLED", repeatDeviceCancel.json().path("outcome").asText());

        String nextSecret = newCredentialSecret();
        BackendAcceptanceTest.Response reactivated = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, nextSecret),
                Map.of(),
                OK);
        assertEquals(2, reactivated.json().path("bindingGeneration").asLong());
        assertFalse(reactivated.raw().contains(nextSecret), "BUSINESS: reactivation never returns the secret");

        String idempotencyKey = "acceptance-terminal-cancel-" + UUID.randomUUID();
        Map<String, String> headers = Map.of("Idempotency-Key", idempotencyKey);
        String operationsPath = operationsTerminalActivationCancelPath(store.fixture(), terminalRef);
        long auditBeforeRejectedOperationsCancel = terminalBindingAuditTotal(context, store, terminalRef);
        BackendAcceptanceTest.Response changedGeneration = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                operationsPath,
                store.session().cookie(),
                Map.of("expectedBindingGeneration", 1),
                Map.of("Idempotency-Key", "old-generation-cancel-" + UUID.randomUUID()),
                CLIENT_FAILURE);
        assertEquals(409, changedGeneration.status());
        assertProblem(changedGeneration, "TERMINAL_BINDING_CHANGED");
        assertEquals(auditBeforeRejectedOperationsCancel, terminalBindingAuditTotal(context, store, terminalRef));
        BackendAcceptanceTest.Response operationsCancelled = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                operationsPath,
                store.session().cookie(),
                Map.of("expectedBindingGeneration", 2),
                headers,
                OK);
        assertEquals("CANCELLED", operationsCancelled.json().path("outcome").asText());
        long auditAfterOperationsCancel = terminalBindingAuditTotal(context, store, terminalRef);
        assertEquals(auditBeforeRejectedOperationsCancel + 1, auditAfterOperationsCancel);
        JsonNode auditHistory = terminalBindingAuditHistory(context, store, terminalRef);
        assertTrue(
                hasTerminalBindingAuditReason(auditHistory, "终端设备", "DEVICE_CANCELLED"),
                "BUSINESS: device cancellation audit records its actor and reason");
        assertTrue(
                hasTerminalBindingAuditReason(auditHistory, "Acceptance Operator", "OPERATIONS_CANCELLED"),
                "BUSINESS: operations cancellation audit records the authenticated operator and its reason");
        BackendAcceptanceTest.Response noLongerActive = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                operationsPath,
                store.session().cookie(),
                Map.of("expectedBindingGeneration", 2),
                Map.of("Idempotency-Key", "inactive-terminal-cancel-" + UUID.randomUUID()),
                CLIENT_FAILURE);
        assertEquals(404, noLongerActive.status());
        assertProblem(noLongerActive, "TERMINAL_BINDING_NOT_ACTIVE");
        assertEquals(auditAfterOperationsCancel, terminalBindingAuditTotal(context, store, terminalRef));
        BackendAcceptanceTest.Response replayed = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                operationsPath,
                store.session().cookie(),
                Map.of("expectedBindingGeneration", 2),
                headers,
                OK);
        assertEquals("CANCELLED", replayed.json().path("outcome").asText());
        JsonNode inactiveDetail = readDetail(context, store, terminalRef);
        assertEquals("INACTIVE", inactiveDetail.path("binding").path("status").asText());
        assertTrue(inactiveDetail.path("binding").path("generation").isMissingNode());
        BackendAcceptanceTest.Fixture readOnlyFixture = host.storeUserFixture(store.fixture(), Set.of());
        host.completeInvitation(context, readOnlyFixture);
        BackendAcceptanceTest.Session readOnlySession =
                selectStore(context, readOnlyFixture, host.login(context, readOnlyFixture));
        BackendAcceptanceTest.Response permissionDenied = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_ACTIVATION_CANCEL,
                operationsPath,
                readOnlySession.cookie(),
                Map.of("expectedBindingGeneration", 2),
                idempotency(),
                CLIENT_FAILURE);
        assertEquals(403, permissionDenied.status());
        assertProblem(permissionDenied, "PLATFORM_COMMON_ACCESS_DENIED");
        assertEquals(4, terminalBindingAuditTotal(context, store, terminalRef));
    }

    @AcceptanceScenario(
            id = "storeTerminalConcurrentDeviceActivation",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalConcurrentDeviceActivation")
    void storeTerminalConcurrentDeviceActivation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "双实例并发激活终端", "59000007");
        String activationCode =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        BackendAcceptanceTest.ScenarioContext secondContext =
                host.new ScenarioContext(null, "performance.normal-path", host.secondBusinessPort());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService callers = Executors.newFixedThreadPool(2);
        String firstDevice = "concurrent-device-a-" + UUID.randomUUID();
        String secondDevice = "concurrent-device-b-" + UUID.randomUUID();

        try {
            Future<BackendAcceptanceTest.Response> first = callers.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("ACTIVATION_RACE_START_TIMEOUT");
                }
                return context.post(
                        BackendAcceptanceTest.TERMINAL_ACTIVATION,
                        terminalActivationPath(store.fixture()),
                        null,
                        activationBody(activationCode, firstDevice, newCredentialSecret()),
                        Set.of(200, 409));
            });
            Future<BackendAcceptanceTest.Response> second = callers.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("ACTIVATION_RACE_START_TIMEOUT");
                }
                return secondContext.post(
                        BackendAcceptanceTest.TERMINAL_ACTIVATION,
                        terminalActivationPath(store.fixture()),
                        null,
                        activationBody(activationCode, secondDevice, newCredentialSecret()),
                        Set.of(200, 409));
            });
            assertTrue(ready.await(10, TimeUnit.SECONDS), "ACTIVATION_RACE_CALLERS_NOT_READY");
            start.countDown();

            BackendAcceptanceTest.Response firstResult = first.get(30, TimeUnit.SECONDS);
            BackendAcceptanceTest.Response secondResult = second.get(30, TimeUnit.SECONDS);
            assertNotEquals(firstResult.status(), secondResult.status(), "ACTIVATION_RACE_DID_NOT_SELECT_ONE_WINNER");
            BackendAcceptanceTest.Response loser = firstResult.status() == 200 ? secondResult : firstResult;
            assertProblem(loser, "TERMINAL_BINDING_ALREADY_BOUND");
            JsonNode detail = readDetail(context, store, terminalRef);
            assertEquals("ACTIVE", detail.path("binding").path("status").asText());
            assertEquals(1, detail.path("binding").path("generation").asLong());
            assertEquals(1, terminalBindingAuditTotal(context, store, terminalRef));
            System.out.printf(
                    "BACKEND_ACCEPTANCE_TERMINAL_ACTIVATION_RACE status=PASS "
                            + "primaryPort=%d secondaryPort=%d winnerStatus=%d loserProblem=%s%n",
                    host.primaryBusinessPort(),
                    host.secondBusinessPort(),
                    firstResult.status() == 200 ? firstResult.status() : secondResult.status(),
                    loser.problemCode());
        } finally {
            callers.shutdownNow();
            if (!callers.awaitTermination(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("ACTIVATION_RACE_CALLERS_CLEANUP_FAILED");
            }
        }
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationReplayAfterLostResponse",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalActivationReplayAfterLostResponse")
    void storeTerminalActivationReplayAfterLostResponse(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "激活成功应答丢失重试", "59000008");
        String activationCode =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "lost-response-device-" + UUID.randomUUID();
        String secret = newCredentialSecret();
        byte[] sameRequest = JSON.writeValueAsBytes(activationBody(activationCode, deviceId, secret));
        String activationPath = terminalActivationPath(store.fixture());
        long auditBefore = terminalBindingAuditTotal(context, store, terminalRef);

        Socket droppedResponse = context.postWithoutReadingResponse(
                BackendAcceptanceTest.TERMINAL_ACTIVATION, activationPath, sameRequest);
        droppedResponse.close();
        awaitActiveBindingGeneration(store, terminalRef, 1);

        BackendAcceptanceTest.ScenarioContext otherAddress =
                host.new ScenarioContext(null, "performance.normal-path", host.secondBusinessPort());
        try (Connection notifications = openTerminalBindingNotificationConnection()) {
            assertNoReplayNotification(notifications, terminalRef, "V-B13_INITIAL_ACTIVATION_EMITTED_REVOCATION");
            TerminalBindingReplayState activeState = readTerminalBindingReplayState(store, terminalRef);
            long replayAuditCount = auditBefore + 1;
            BackendAcceptanceTest.Response commandRetry = context.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, activationPath, sameRequest, OK);
            assertEquals(1, commandRetry.json().path("bindingGeneration").asLong());
            assertReplayHasNoEffects(
                    notifications, store, terminalRef, replayAuditCount, activeState, "V-B13_SAME_COMMAND_RETRY");
            BackendAcceptanceTest.Response executorRetry = otherAddress.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, activationPath, sameRequest, OK);
            assertEquals(1, executorRetry.json().path("bindingGeneration").asLong());
            assertReplayHasNoEffects(
                    notifications, store, terminalRef, replayAuditCount, activeState, "V-B13_OTHER_ADDRESS_RETRY");

            transitionTerminalStatus(context, store, terminalRef, "DISABLED");
            TerminalBindingReplayState disabledTerminalState = readTerminalBindingReplayState(store, terminalRef);
            BackendAcceptanceTest.Response retryAfterTerminalDisable = context.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, activationPath, sameRequest, OK);
            assertEquals(
                    1,
                    retryAfterTerminalDisable.json().path("bindingGeneration").asLong());
            assertReplayHasNoEffects(
                    notifications,
                    store,
                    terminalRef,
                    replayAuditCount,
                    disabledTerminalState,
                    "V-B13_SAME_COMMAND_RETRY_AFTER_TERMINAL_DISABLE");
            BackendAcceptanceTest.Response addressRetryAfterTerminalDisable = otherAddress.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, activationPath, sameRequest, OK);
            assertEquals(
                    1,
                    addressRetryAfterTerminalDisable
                            .json()
                            .path("bindingGeneration")
                            .asLong());
            assertReplayHasNoEffects(
                    notifications,
                    store,
                    terminalRef,
                    replayAuditCount,
                    disabledTerminalState,
                    "V-B13_OTHER_ADDRESS_RETRY_AFTER_TERMINAL_DISABLE");
        }

        StoreContext workspaceStore = enabledStore(context);
        UUID workspaceTerminalRef = create(context, workspaceStore, "集团停用后激活重试", "59000009");
        String workspaceActivationCode = readDetail(context, workspaceStore, workspaceTerminalRef)
                .path("activationCode")
                .asText();
        String workspaceDeviceId = "lost-response-workspace-device-" + UUID.randomUUID();
        String workspaceSecret = newCredentialSecret();
        byte[] workspaceRequest =
                JSON.writeValueAsBytes(activationBody(workspaceActivationCode, workspaceDeviceId, workspaceSecret));
        String workspacePath = terminalActivationPath(workspaceStore.fixture());
        long workspaceAuditBefore = bindingAuditCount(workspaceStore.fixture(), workspaceTerminalRef);
        Socket droppedWorkspaceResponse = context.postWithoutReadingResponse(
                BackendAcceptanceTest.TERMINAL_ACTIVATION, workspacePath, workspaceRequest);
        droppedWorkspaceResponse.close();
        awaitActiveBindingGeneration(workspaceStore, workspaceTerminalRef, 1);
        try (Connection notifications = openTerminalBindingNotificationConnection()) {
            assertNoReplayNotification(
                    notifications, workspaceTerminalRef, "V-B13_GROUP_INITIAL_ACTIVATION_EMITTED_REVOCATION");
            long replayWorkspaceAuditCount = workspaceAuditBefore + 1;
            performConnectionStatusOnlyChange(
                    context,
                    new ConnectionFixture(
                            workspaceStore.fixture(),
                            workspaceStore.session(),
                            workspaceTerminalRef,
                            workspaceActivationCode,
                            workspaceDeviceId,
                            workspaceSecret,
                            1),
                    ConnectionStatusOnlyChange.GROUP_WORKSPACE_DISABLED);
            TerminalBindingReplayState disabledWorkspaceState =
                    readTerminalBindingReplayState(workspaceStore, workspaceTerminalRef);
            BackendAcceptanceTest.Response retryAfterWorkspaceDisable = context.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, workspacePath, workspaceRequest, OK);
            assertEquals(
                    1,
                    retryAfterWorkspaceDisable.json().path("bindingGeneration").asLong());
            assertReplayHasNoEffects(
                    notifications,
                    workspaceStore,
                    workspaceTerminalRef,
                    replayWorkspaceAuditCount,
                    disabledWorkspaceState,
                    "V-B13_SAME_COMMAND_RETRY_AFTER_GROUP_DISABLE");
            BackendAcceptanceTest.Response addressRetryAfterWorkspaceDisable = otherAddress.postSerializedJson(
                    BackendAcceptanceTest.TERMINAL_ACTIVATION, workspacePath, workspaceRequest, OK);
            assertEquals(
                    1,
                    addressRetryAfterWorkspaceDisable
                            .json()
                            .path("bindingGeneration")
                            .asLong());
            assertReplayHasNoEffects(
                    notifications,
                    workspaceStore,
                    workspaceTerminalRef,
                    replayWorkspaceAuditCount,
                    disabledWorkspaceState,
                    "V-B13_OTHER_ADDRESS_RETRY_AFTER_GROUP_DISABLE");
        }

        System.out.printf(
                "BACKEND_ACCEPTANCE_TERMINAL_ACTIVATION_REPLAY status=PASS "
                        + "retryAddressPort=%d retryForms=SECOND_COMMAND_AND_OTHER_ADDRESS "
                        + "terminalDisable=REPLAY groupDisable=REPLAY notificationChecks=PASS%n",
                host.secondBusinessPort());
    }

    private static Connection openTerminalBindingNotificationConnection() throws SQLException {
        Connection connection = DriverManager.getConnection(
                BackendAcceptanceTest.POSTGRES.getJdbcUrl(),
                BackendAcceptanceTest.POSTGRES.getUsername(),
                BackendAcceptanceTest.POSTGRES.getPassword());
        boolean listening = false;
        try (Statement statement = connection.createStatement()) {
            statement.execute("LISTEN terminal_binding_events");
            listening = true;
            return connection;
        } finally {
            if (!listening) connection.close();
        }
    }

    private void assertReplayHasNoEffects(
            Connection notifications,
            StoreContext store,
            UUID terminalRef,
            long auditBefore,
            TerminalBindingReplayState stateBefore,
            String marker)
            throws SQLException {
        assertEquals(stateBefore, readTerminalBindingReplayState(store, terminalRef), marker + "_BINDING_ROW_CHANGED");
        assertEquals(auditBefore, bindingAuditCount(store.fixture(), terminalRef), marker + "_AUDIT_WRITTEN");
        assertNoReplayNotification(notifications, terminalRef, marker + "_NOTIFICATION_WRITTEN");
    }

    private void assertNoReplayNotification(Connection connection, UUID terminalRef, String marker)
            throws SQLException {
        PGNotification[] notifications = connection.unwrap(PGConnection.class).getNotifications(250);
        if (notifications == null) return;
        String terminalMarker = "\"terminalRef\":\"" + terminalRef + "\"";
        for (PGNotification notification : notifications) {
            if ("terminal_binding_events".equals(notification.getName())
                    && notification.getParameter() != null
                    && notification.getParameter().contains(terminalMarker)) {
                assertFalse(true, marker);
            }
        }
    }

    private TerminalBindingReplayState readTerminalBindingReplayState(StoreContext store, UUID terminalRef) {
        return new TerminalBindingReplayState(host.text(
                "SELECT generation::text || ':' || binding_status || ':' || activated_at_epoch_millis::text "
                        + "|| ':' || xmin::text FROM terminal_binding.latest_binding "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                terminalRef));
    }

    private record TerminalBindingReplayState(String rowStamp) {}

    @AcceptanceScenario(
            id = "storeTerminalActivationLifecycleLockInterleavings",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalActivationLifecycleLockInterleavings")
    void storeTerminalActivationLifecycleLockInterleavings(BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        runActivationDisableInterleaving(context, true);
        runActivationDisableInterleaving(context, false);
        runActivationVoidInterleaving(context, true);
        runActivationVoidInterleaving(context, false);
    }

    private void runActivationDisableInterleaving(
            BackendAcceptanceTest.ScenarioContext context, boolean activationFirst) throws Exception {
        StoreContext store = enabledStore(context);
        String name = "激活与停用行锁交错";
        String externalId = activationFirst ? "59000010" : "59000011";
        UUID terminalRef = create(context, store, name, externalId);
        String code =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "disable-race-device-" + UUID.randomUUID();
        String secret = newCredentialSecret();
        long auditBefore = bindingAuditCount(store.fixture(), terminalRef);
        runActivationStatusWaitQueue(context, store, terminalRef, code, deviceId, secret, "DISABLED", activationFirst);

        long bindingRows = host.count(
                "SELECT count(*) FROM terminal_binding.latest_binding "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                terminalRef);
        if (activationFirst) {
            assertEquals(1L, bindingRows, "V-B6_ACTIVATION_BEFORE_DISABLE_BINDING_MISSING");
            assertEquals(
                    "ACTIVE",
                    host.text(
                            "SELECT binding_status FROM terminal_binding.latest_binding "
                                    + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                            store.fixture().workspaceUuid(),
                            store.fixture().groupWorkspaceKey(),
                            terminalRef),
                    "V-B6_DISABLE_MUST_NOT_END_BINDING");
            assertEquals(auditBefore + 1, bindingAuditCount(store.fixture(), terminalRef));
        } else {
            assertEquals(0L, bindingRows, "V-B6_ACTIVATION_AFTER_DISABLE_MUST_NOT_BIND");
            assertEquals(auditBefore, bindingAuditCount(store.fixture(), terminalRef));
        }
    }

    private void runActivationVoidInterleaving(BackendAcceptanceTest.ScenarioContext context, boolean activationFirst)
            throws Exception {
        StoreContext store = enabledStore(context);
        String name = "激活与作废行锁交错";
        String externalId = activationFirst ? "59000012" : "59000013";
        UUID terminalRef = create(context, store, name, externalId);
        String code =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "void-race-device-" + UUID.randomUUID();
        String initialSecret = newCredentialSecret();
        BackendAcceptanceTest.Response initial = activationAttempt(
                context, store.fixture().groupWorkspaceKey(), code, deviceId, initialSecret, "laptop", OK);
        assertEquals(1, initial.json().path("bindingGeneration").asLong());
        String nextSecret = newCredentialSecret();
        long auditBeforeVoidRace = bindingAuditCount(store.fixture(), terminalRef);
        runActivationStatusWaitQueue(
                context, store, terminalRef, code, deviceId, nextSecret, "VOIDED", activationFirst);

        assertEquals(
                "VOIDED",
                host.text(
                        "SELECT status FROM store_terminal.terminal "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        terminalRef),
                "V-B6_VOID_INTERLEAVING_TERMINAL_STATUS_INVALID");
        assertEquals(
                "ENDED",
                host.text(
                        "SELECT binding_status FROM terminal_binding.latest_binding "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        terminalRef),
                "V-B6_VOID_MUST_END_CURRENT_BINDING");
        assertEquals(
                activationFirst ? 2 : 1,
                host.count(
                        "SELECT generation FROM terminal_binding.latest_binding "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        terminalRef),
                "V-B6_VOID_INTERLEAVING_GENERATION_INVALID");
        assertEquals(
                auditBeforeVoidRace + (activationFirst ? 2 : 1),
                bindingAuditCount(store.fixture(), terminalRef),
                "V-B6_VOID_INTERLEAVING_AUDIT_COUNT_INVALID");
    }

    private void runActivationStatusWaitQueue(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            UUID terminalRef,
            String activationCode,
            String deviceId,
            String secret,
            String targetStatus,
            boolean activationFirst)
            throws Exception {
        BackendAcceptanceTest.ScenarioContext activationContext =
                host.new ScenarioContext(null, "performance.normal-path", host.primaryBusinessPort());
        BackendAcceptanceTest.ScenarioContext statusContext =
                host.new ScenarioContext(null, "performance.normal-path", host.secondBusinessPort());
        ExecutorService callers = Executors.newFixedThreadPool(2);
        try (var lock = host.holdTerminalRowLockForAcceptance(store.fixture(), terminalRef)) {
            Future<BackendAcceptanceTest.Response> activation = null;
            Future<?> status = null;
            if (activationFirst) {
                activation = callers.submit(() -> activationContext.post(
                        BackendAcceptanceTest.TERMINAL_ACTIVATION,
                        terminalActivationPath(store.fixture()),
                        null,
                        activationBody(activationCode, deviceId, secret),
                        Map.of(),
                        Set.of(200, 403, 409, 422)));
                host.awaitTerminalRowLockWaiters(1, java.time.Duration.ofSeconds(10));
                status = callers.submit(() -> {
                    transitionTerminalStatus(statusContext, store, terminalRef, targetStatus);
                    return null;
                });
                host.awaitTerminalRowLockWaiters(2, java.time.Duration.ofSeconds(10));
            } else {
                status = callers.submit(() -> {
                    transitionTerminalStatus(statusContext, store, terminalRef, targetStatus);
                    return null;
                });
                host.awaitTerminalRowLockWaiters(1, java.time.Duration.ofSeconds(10));
                activation = callers.submit(() -> activationContext.post(
                        BackendAcceptanceTest.TERMINAL_ACTIVATION,
                        terminalActivationPath(store.fixture()),
                        null,
                        activationBody(activationCode, deviceId, secret),
                        Map.of(),
                        Set.of(200, 403, 409, 422)));
                host.awaitTerminalRowLockWaiters(2, java.time.Duration.ofSeconds(10));
            }
            lock.commit();
            BackendAcceptanceTest.Response activationResponse = activation.get(30, TimeUnit.SECONDS);
            status.get(30, TimeUnit.SECONDS);
            if (activationFirst) {
                assertEquals(200, activationResponse.status(), "V-B6_ACTIVATION_FIRST_MUST_COMMIT");
            } else if ("VOIDED".equals(targetStatus)) {
                assertProblem(activationResponse, "STORE_TERMINAL_VOIDED_IMMUTABLE");
            } else {
                assertProblem(activationResponse, "STORE_TERMINAL_DISABLED");
            }
        } finally {
            callers.shutdownNow();
            if (!callers.awaitTermination(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("ACTIVATION_STATUS_RACE_CALLERS_CLEANUP_FAILED");
            }
        }
        System.out.printf(
                "BACKEND_ACCEPTANCE_ACTIVATION_STATUS_RACE status=PASS target=%s order=%s terminalRef=%s%n",
                targetStatus, activationFirst ? "ACTIVATION_THEN_STATUS" : "STATUS_THEN_ACTIVATION", terminalRef);
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationBusinessPrecedence",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalActivationBusinessPrecedence")
    void storeTerminalActivationBusinessPrecedence(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        String searchMarker = "SEARCHABLE_SAFE_MARKER_" + UUID.randomUUID();
        UUID terminalRef = create(context, store, searchMarker, null);
        String activationCode =
                readDetail(context, store, terminalRef).path("activationCode").asText();
        String deviceId = "terminal-device-" + UUID.randomUUID();
        String secret = newCredentialSecret();
        String marker = "SECRET_SEARCH_MARKER_" + UUID.randomUUID();
        Map<String, Object> malformedBody = activationBody(activationCode, deviceId, marker);
        assertEquals(marker, malformedBody.get("credentialSecret"));
        BackendAcceptanceTest.Response malformed = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                malformedBody,
                Map.of(),
                CLIENT_FAILURE);
        assertProblem(malformed, "PLATFORM_COMMON_VALIDATION_FAILED");
        assertFalse(malformed.raw().contains(marker), "BUSINESS: malformed secret is not echoed");
        assertEquals(
                "INACTIVE",
                readDetail(context, store, terminalRef)
                        .path("binding")
                        .path("status")
                        .asText());
        assertEquals(0, terminalBindingAuditTotal(context, store, terminalRef));

        BackendAcceptanceTest.Response firstActivation = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, secret),
                Map.of(),
                OK);
        assertEquals(1, firstActivation.json().path("bindingGeneration").asLong());
        assertActivationSecretsNotSearchable(store, terminalRef, searchMarker, activationCode, deviceId, secret);

        BackendAcceptanceTest.Fixture statusActor =
                host.projectUserFixture(store.fixture(), Set.of("BC-ORG-STORE-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, statusActor);
        BackendAcceptanceTest.Session statusSession =
                selectStore(context, statusActor, host.login(context, statusActor));
        long storeVersion = host.organizationStoreVersion(store.fixture().storeId());
        BackendAcceptanceTest.Response disabledStore = context.post(
                BackendAcceptanceTest.OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/organization/stores/"
                        + store.fixture().storeId() + "/status",
                statusSession.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", storeVersion),
                idempotency(),
                OK);
        assertEquals("DISABLED", disabledStore.json().path("status").asText());

        BackendAcceptanceTest.Response differentDevice = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, "another-device-" + UUID.randomUUID(), newCredentialSecret(), "mobile"),
                Map.of(),
                CLIENT_FAILURE);
        assertProblem(differentDevice, "PLATFORM_COMMON_ACCESS_DENIED");
        assertTrue(differentDevice.json().path("detail").asText().contains("门店已停用"));

        BackendAcceptanceTest.Response sameOperationRetry = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, secret),
                Map.of(),
                OK);
        assertEquals(1, sameOperationRetry.json().path("bindingGeneration").asLong());

        String nextSecret = newCredentialSecret();
        BackendAcceptanceTest.Response sameDeviceNewOperation = context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(store.fixture()),
                null,
                activationBody(activationCode, deviceId, nextSecret),
                Map.of(),
                OK);
        assertEquals(2, sameDeviceNewOperation.json().path("bindingGeneration").asLong());

        long disabledStoreVersion =
                host.organizationStoreVersion(store.fixture().storeId());
        BackendAcceptanceTest.Response enabledStore = context.post(
                BackendAcceptanceTest.OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/organization/stores/"
                        + store.fixture().storeId() + "/status",
                statusSession.cookie(),
                Map.of("targetStatus", "ENABLED", "expectedVersion", disabledStoreVersion),
                idempotency(),
                OK);
        assertEquals("ENABLED", enabledStore.json().path("status").asText());
        JsonNode detail = readDetail(context, store, terminalRef);
        assertEquals("ACTIVE", detail.path("binding").path("status").asText());
        assertEquals(2, detail.path("binding").path("generation").asLong());
        assertEquals(2, terminalBindingAuditTotal(context, store, terminalRef));
    }

    private void assertActivationSecretsNotSearchable(
            StoreContext store,
            UUID terminalRef,
            String searchMarker,
            String activationCode,
            String deviceId,
            String credentialSecret)
            throws Exception {
        String runDirectoryValue = System.getenv("V2S_BACKEND_ACCEPTANCE_RUN_DIRECTORY");
        assertTrue(runDirectoryValue != null && !runDirectoryValue.isBlank(), "V-B1_RUN_DIRECTORY_MISSING");
        Path runDirectory = Path.of(runDirectoryValue).toAbsolutePath().normalize();
        assertTrue(Files.isDirectory(runDirectory), "V-B1_RUN_DIRECTORY_INVALID");
        Path markerFile = runDirectory.resolve("secret-search-marker-" + UUID.randomUUID() + ".txt");
        Files.writeString(markerFile, searchMarker + "\n", StandardCharsets.UTF_8);
        try {
            String credential = "1." + credentialSecret;
            List<String> protectedValues = List.of(
                    credentialSecret,
                    credential,
                    Base64.getEncoder().encodeToString(credentialSecret.getBytes(StandardCharsets.UTF_8)),
                    Base64.getEncoder().encodeToString(credential.getBytes(StandardCharsets.UTF_8)),
                    HexFormat.of().formatHex(credentialSecret.getBytes(StandardCharsets.UTF_8)),
                    activationCode,
                    deviceId);
            boolean markerFound = false;
            try (var paths = Files.walk(runDirectory)) {
                for (Path path : paths.filter(Files::isRegularFile).toList()) {
                    String name = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
                    if (!(name.endsWith(".log")
                            || name.endsWith(".txt")
                            || name.endsWith(".json")
                            || name.endsWith(".jsonl")
                            || name.endsWith(".xml")
                            || name.endsWith(".out"))) continue;
                    String contents = Files.readString(path, StandardCharsets.UTF_8);
                    markerFound |= contents.contains(searchMarker);
                    assertNoProtectedValues(contents, protectedValues, "V-B1_SECRET_IN_RUN_OUTPUT");
                }
            }
            assertTrue(markerFound, "V-B1_MARKER_SEARCH_DID_NOT_FIND_SENTINEL");

            String storeAudit = host.text(
                    "SELECT COALESCE(string_agg(changes_json::text, ' '), '') "
                            + "FROM store_terminal.audit_event WHERE entity_ref_text=?",
                    terminalRef.toString());
            String bindingAudit = host.text(
                    "SELECT COALESCE(string_agg(changes_json::text, ' '), '') "
                            + "FROM terminal_binding.audit_event WHERE entity_ref_text=?",
                    terminalRef.toString());
            String storeReceipts = host.text(
                    "SELECT COALESCE(string_agg(COALESCE(response_json::text, ''), ' '), '') "
                            + "FROM store_terminal.command_receipt WHERE workspace_uuid=? AND group_workspace_key=?",
                    store.fixture().workspaceUuid(),
                    store.fixture().groupWorkspaceKey());
            String bindingReceipts = host.text(
                    "SELECT COALESCE(string_agg(response_json::text, ' '), '') "
                            + "FROM terminal_binding.command_receipt WHERE workspace_uuid=? AND group_workspace_key=?",
                    store.fixture().workspaceUuid(),
                    store.fixture().groupWorkspaceKey());
            for (String searchable : List.of(storeAudit, bindingAudit, storeReceipts, bindingReceipts)) {
                assertNoProtectedValues(searchable, protectedValues, "V-B1_SECRET_IN_AUDIT_OR_RECEIPT");
            }

            assertEquals(
                    1L,
                    host.count(
                            "SELECT count(*) FROM store_terminal.terminal "
                                    + "WHERE terminal_ref=? AND activation_code=?",
                            terminalRef,
                            activationCode),
                    "V-B1_ACTIVATION_CODE_NOT_OWNED_BY_TERMINAL_ROW");
            String terminalNonCodeFields = host.text(
                    "SELECT name || '|' || name_normalized || '|' || configuration::text "
                            + "FROM store_terminal.terminal WHERE terminal_ref=?",
                    terminalRef);
            assertFalse(terminalNonCodeFields.contains(activationCode), "V-B1_ACTIVATION_CODE_OUTSIDE_ITS_OWNER_FIELD");
            String digest = host.text(
                    "SELECT encode(credential_digest, 'hex') FROM terminal_binding.latest_binding "
                            + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                    store.fixture().workspaceUuid(),
                    store.fixture().groupWorkspaceKey(),
                    terminalRef);
            byte[] secretBytes = Base64.getUrlDecoder().decode(credentialSecret);
            String expectedDigest;
            try {
                expectedDigest = HexFormat.of()
                        .formatHex(MessageDigest.getInstance("SHA-256").digest(secretBytes));
            } finally {
                Arrays.fill(secretBytes, (byte) 0);
            }
            assertEquals(expectedDigest, digest, "V-B1_STORED_CREDENTIAL_IS_NOT_SHA256_DIGEST");
            assertNoProtectedValues(digest, protectedValues, "V-B1_RAW_CREDENTIAL_IN_BINDING_ROW");
        } finally {
            Files.deleteIfExists(markerFile);
        }
    }

    private static void assertNoProtectedValues(String contents, List<String> protectedValues, String assertion) {
        for (String protectedValue : protectedValues) {
            assertFalse(contents.contains(protectedValue), assertion);
        }
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationRejectionMatrix",
            module = "TERMINAL_BINDING",
            operation = "storeTerminalActivationRejectionMatrix")
    void storeTerminalActivationRejectionMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID disabledTerminal = create(context, store, "激活拒绝终端停用", "59000101");
        UUID voidedTerminal = create(context, store, "激活拒绝终端作废", "59000102");
        UUID mismatchTerminal = create(context, store, "激活拒绝形态不匹配", "59000103");
        UUID boundTerminal = create(context, store, "激活拒绝已绑定", "59000104");
        UUID endedTerminal = create(context, store, "激活拒绝已结束代次", "59000105");
        UUID storeTerminal = create(context, store, "激活拒绝门店作废", "59000106");

        BackendAcceptanceTest.Response unknownCode = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "99999999",
                "matrix-unknown-device",
                newCredentialSecret(),
                "laptop",
                CLIENT_FAILURE);
        assertProblem(unknownCode, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        BackendAcceptanceTest.Response missingWorkspace = activationAttempt(
                context,
                "missing-group-workspace-" + UUID.randomUUID(),
                "59000103",
                "matrix-missing-workspace-device",
                newCredentialSecret(),
                "laptop",
                CLIENT_FAILURE);
        assertProblem(missingWorkspace, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        assertEquals(unknownCode.status(), missingWorkspace.status());
        assertEquals(unknownCode.problemCode(), missingWorkspace.problemCode());
        assertEquals(
                unknownCode.json().path("detail").asText(),
                missingWorkspace.json().path("detail").asText());

        transitionTerminalStatus(context, store, disabledTerminal, "DISABLED");
        assertActivationProblem(context, store, disabledTerminal, "59000101", "laptop", "STORE_TERMINAL_DISABLED");

        transitionTerminalStatus(context, store, voidedTerminal, "DISABLED");
        transitionTerminalStatus(context, store, voidedTerminal, "VOIDED");
        assertActivationProblem(
                context, store, voidedTerminal, "59000102", "laptop", "STORE_TERMINAL_VOIDED_IMMUTABLE");

        assertActivationProblem(
                context, store, mismatchTerminal, "59000103", "mobile", "STORE_TERMINAL_DEVICE_TYPE_MISMATCH");

        String boundSecret = newCredentialSecret();
        BackendAcceptanceTest.Response firstBound = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "59000104",
                "matrix-original-device",
                boundSecret,
                "laptop",
                OK);
        assertEquals(1, firstBound.json().path("bindingGeneration").asLong());
        assertActivationProblem(context, store, boundTerminal, "59000104", "laptop", "TERMINAL_BINDING_ALREADY_BOUND");
        assertEquals(
                1,
                readDetail(context, store, boundTerminal)
                        .path("binding")
                        .path("generation")
                        .asLong());
        long boundAuditTotal = terminalBindingAuditTotal(context, store, boundTerminal);
        BackendAcceptanceTest.Response originalDeviceRetry = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "59000104",
                "matrix-original-device",
                boundSecret,
                "laptop",
                OK);
        assertEquals(1, originalDeviceRetry.json().path("bindingGeneration").asLong());
        assertEquals(boundAuditTotal, terminalBindingAuditTotal(context, store, boundTerminal));

        String endedSecret = newCredentialSecret();
        BackendAcceptanceTest.Response firstEnded = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "59000105",
                "matrix-ended-device",
                endedSecret,
                "laptop",
                OK);
        BackendAcceptanceTest.Response cancelled = context.post(
                BackendAcceptanceTest.TERMINAL_DEVICE_ACTIVATION_CANCEL,
                terminalActivationCancelPath(store.fixture(), endedTerminal),
                null,
                Map.of("deviceId", "matrix-ended-device"),
                Map.of(
                        "Authorization",
                        terminalCredential(
                                firstEnded.json().path("bindingGeneration").asLong(), endedSecret)),
                OK);
        assertEquals("CANCELLED", cancelled.json().path("outcome").asText());
        long endedAuditTotal = terminalBindingAuditTotal(context, store, endedTerminal);
        BackendAcceptanceTest.Response expired = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "59000105",
                "matrix-ended-device",
                endedSecret,
                "laptop",
                CLIENT_FAILURE);
        assertProblem(expired, "TERMINAL_BINDING_ACTIVATION_EXPIRED");
        assertEquals(endedAuditTotal, terminalBindingAuditTotal(context, store, endedTerminal));

        BackendAcceptanceTest.Fixture statusActor =
                host.projectUserFixture(store.fixture(), Set.of("BC-ORG-STORE-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, statusActor);
        BackendAcceptanceTest.Session statusSession =
                selectStore(context, statusActor, host.login(context, statusActor));
        long storeVersion = host.organizationStoreVersion(store.fixture().storeId());
        context.post(
                BackendAcceptanceTest.OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/organization/stores/"
                        + store.fixture().storeId() + "/status",
                statusSession.cookie(),
                Map.of("targetStatus", "VOIDED", "expectedVersion", storeVersion),
                idempotency(),
                OK);
        long voidedStoreBindingsBefore = host.count(
                "SELECT count(*) FROM terminal_binding.latest_binding "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                storeTerminal);
        long voidedStoreAuditsBefore = host.count(
                "SELECT count(*) FROM terminal_binding.audit_event "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? "
                        + "AND entity_type='TERMINAL_BINDING' AND entity_ref_text=?",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                storeTerminal.toString());
        assertEquals(0L, voidedStoreBindingsBefore, "BUSINESS: store-voided activation starts without a binding");
        assertEquals(0L, voidedStoreAuditsBefore, "BUSINESS: store-voided activation starts without binding audit");
        BackendAcceptanceTest.Response voidedStore = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                "59000106",
                "matrix-store-voided-device",
                newCredentialSecret(),
                "mobile",
                CLIENT_FAILURE);
        assertProblem(voidedStore, "STORE_TERMINAL_STORE_VOIDED");
        assertEquals(
                voidedStoreBindingsBefore,
                host.count(
                        "SELECT count(*) FROM terminal_binding.latest_binding "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=?",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        storeTerminal),
                "BUSINESS: rejected activation does not register a credential digest or binding");
        assertEquals(
                voidedStoreAuditsBefore,
                host.count(
                        "SELECT count(*) FROM terminal_binding.audit_event "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? "
                                + "AND entity_type='TERMINAL_BINDING' AND entity_ref_text=?",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        storeTerminal.toString()),
                "BUSINESS: rejected activation does not write binding audit");

        StoreContext disabledWorkspaceStore = enabledStore(context);
        // spotless:off
        UUID disabledWorkspaceTerminal = create(context, disabledWorkspaceStore, "集团停用时拒绝激活",
            "59000201");
        // spotless:on
        String disabledWorkspaceCode = readDetail(context, disabledWorkspaceStore, disabledWorkspaceTerminal)
                .path("activationCode")
                .asText();
        JsonNode workspaceTerminalBefore = readDetail(context, disabledWorkspaceStore, disabledWorkspaceTerminal);
        long workspaceBindingAuditsBefore =
                terminalBindingAuditTotal(context, disabledWorkspaceStore, disabledWorkspaceTerminal);
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String groupWorkspacePath = "/api/platform/group-workspaces/"
                + disabledWorkspaceStore.fixture().groupWorkspaceKey();
        long groupWorkspaceVersion = context.get(
                        BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_DETAIL,
                        groupWorkspacePath,
                        platform.cookie(),
                        OK)
                .json()
                .path("version")
                .asLong();
        String workspaceStatusKey = "activation-disable-group-" + UUID.randomUUID();
        context.post(
                BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_STATUS,
                groupWorkspacePath + "/status",
                platform.cookie(),
                Map.of(
                        "targetStatus",
                        "DISABLED",
                        "expectedVersion",
                        groupWorkspaceVersion,
                        "idempotencyKey",
                        workspaceStatusKey),
                Map.of("Idempotency-Key", workspaceStatusKey),
                OK);
        BackendAcceptanceTest.Response disabledWorkspace = activationAttempt(
                context,
                disabledWorkspaceStore.fixture().groupWorkspaceKey(),
                disabledWorkspaceCode,
                "matrix-disabled-workspace-device",
                newCredentialSecret(),
                "laptop",
                CLIENT_FAILURE);
        assertProblem(disabledWorkspace, "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED");
        long disabledWorkspaceVersion = context.get(
                        BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_DETAIL,
                        groupWorkspacePath,
                        platform.cookie(),
                        OK)
                .json()
                .path("version")
                .asLong();
        String workspaceEnableKey = "activation-enable-group-" + UUID.randomUUID();
        context.post(
                BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_STATUS,
                groupWorkspacePath + "/status",
                platform.cookie(),
                Map.of(
                        "targetStatus",
                        "ENABLED",
                        "expectedVersion",
                        disabledWorkspaceVersion,
                        "idempotencyKey",
                        workspaceEnableKey),
                Map.of("Idempotency-Key", workspaceEnableKey),
                OK);
        BackendAcceptanceTest.Session enabledWorkspaceSession = selectStore(
                context, disabledWorkspaceStore.fixture(), host.login(context, disabledWorkspaceStore.fixture()));
        StoreContext enabledWorkspaceStore =
                new StoreContext(disabledWorkspaceStore.fixture(), enabledWorkspaceSession);
        JsonNode workspaceTerminalAfter = readDetail(context, enabledWorkspaceStore, disabledWorkspaceTerminal);
        assertEquals(
                workspaceTerminalBefore.path("version").asLong(),
                workspaceTerminalAfter.path("version").asLong());
        assertEquals(workspaceTerminalBefore.path("binding"), workspaceTerminalAfter.path("binding"));
        assertEquals(
                workspaceBindingAuditsBefore,
                terminalBindingAuditTotal(context, enabledWorkspaceStore, disabledWorkspaceTerminal));
    }

    @AcceptanceScenario(
            id = "storeTerminalLifecycleAndNames",
            module = "ORG",
            operation = "storeTerminalLifecycleAndNames")
    void storeTerminalLifecycleAndNames(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "Lifecycle terminal", "11223344");
        JsonNode before = readDetail(context, store, terminalRef);
        long version = before.path("version").asLong();

        BackendAcceptanceTest.Response replaced = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminalRef),
                store.session().cookie(),
                replaceBody("Lifecycle terminal renamed", version),
                idempotency(),
                OK);
        assertEquals(terminalRef.toString(), replaced.json().path("terminalRef").asText());
        JsonNode renamed = readDetail(context, store, terminalRef);
        assertEquals("Lifecycle terminal renamed", renamed.path("name").asText());
        assertEquals(
                "11223344",
                renamed.path("activationCode").asText(),
                "BUSINESS: replacement cannot change activation code");

        BackendAcceptanceTest.Response disabled = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminalRef) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        renamed.path("version").asLong()),
                idempotency(),
                OK);
        assertEquals("DISABLED", disabled.json().path("status").asText());

        JsonNode disabledDetail = readDetail(context, store, terminalRef);
        BackendAcceptanceTest.Response voided = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminalRef) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "VOIDED",
                        "expectedVersion",
                        disabledDetail.path("version").asLong()),
                idempotency(),
                OK);
        assertEquals("VOIDED", voided.json().path("status").asText());

        BackendAcceptanceTest.Response rejectedEdit = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminalRef),
                store.session().cookie(),
                replaceBody("Should not write", voided.json().path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(rejectedEdit, "STORE_TERMINAL_VOIDED_IMMUTABLE");
        JsonNode afterRejectedEdit = readDetail(context, store, terminalRef);
        assertEquals(
                "Lifecycle terminal renamed", afterRejectedEdit.path("name").asText());
        assertEquals(
                voided.json().path("version").asLong(),
                afterRejectedEdit.path("version").asLong());
    }

    @AcceptanceScenario(
            id = "storeTerminalRejectsInvalidCursor",
            module = "ORG",
            operation = "storeTerminalRejectsInvalidCursor")
    void storeTerminalRejectsInvalidCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Response response = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                terminalsPath(store.fixture()) + "?pageSize=20&cursor=not-a-valid-cursor",
                store.session().cookie(),
                CLIENT_FAILURE);
        assertProblem(response, "PLATFORM_COMMON_VALIDATION_FAILED");
    }

    @AcceptanceScenario(id = "storeTerminalAuditHistory", module = "AUDIT", operation = "storeTerminalAuditHistory")
    void storeTerminalAuditHistory(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminalRef = create(context, store, "审计终端", "22334455");
        BackendAcceptanceTest.Response history = context.get(
                BackendAcceptanceTest.OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey="
                        + store.fixture().groupWorkspaceKey() + "&entityType=STORE_TERMINAL&entityId=" + terminalRef
                        + "&page=1&pageSize=20",
                store.session().cookie(),
                OK);
        assertTrue(
                history.json().path("total").asLong() >= 1,
                "BUSINESS: terminal creation is available in operations audit history");
        assertTrue(history.json().path("items").isArray(), "BUSINESS: terminal audit readback returns history items");
        assertFalse(
                history.json().toString().contains("22334455"),
                "BUSINESS: audit history never exposes activation code");
        JsonNode beforeRename = readDetail(context, store, terminalRef);
        context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminalRef),
                store.session().cookie(),
                replaceBody("审计终端改名", beforeRename.path("version").asLong()),
                idempotency(),
                OK);
        JsonNode renamed = readDetail(context, store, terminalRef);
        context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminalRef) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        renamed.path("version").asLong()),
                idempotency(),
                OK);
        JsonNode disabled = readDetail(context, store, terminalRef);
        context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminalRef) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "VOIDED",
                        "expectedVersion",
                        disabled.path("version").asLong()),
                idempotency(),
                OK);
        BackendAcceptanceTest.Response historyAfterVoid = context.get(
                BackendAcceptanceTest.OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey="
                        + store.fixture().groupWorkspaceKey() + "&entityType=STORE_TERMINAL&entityId=" + terminalRef
                        + "&page=1&pageSize=20",
                store.session().cookie(),
                OK);
        String historyText = historyAfterVoid.json().toString();
        assertTrue(historyText.contains("TERMINAL_CREATED"), "BUSINESS: create audit action is readable");
        assertTrue(historyText.contains("TERMINAL_REPLACED"), "BUSINESS: replace audit action is readable");
        assertTrue(historyText.contains("TERMINAL_STATUS_CHANGED"), "BUSINESS: lifecycle audit action is readable");
        assertTrue(historyText.contains("审计终端改名"), "BUSINESS: audit contains the new name summary");
        assertTrue(historyText.contains("审计终端"), "BUSINESS: audit contains the old name summary");
        assertFalse(historyText.contains("22334455"), "BUSINESS: voided terminal history remains activation-code safe");

        BackendAcceptanceTest.Response missing = context.get(
                BackendAcceptanceTest.OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey="
                        + store.fixture().groupWorkspaceKey() + "&entityType=STORE_TERMINAL&entityId="
                        + UUID.randomUUID() + "&page=1&pageSize=20",
                store.session().cookie(),
                CLIENT_FAILURE);
        assertEquals(
                404, missing.status(), "BUSINESS: missing terminal audit history is not confused with an empty page");

        BackendAcceptanceTest.Fixture otherFixture = host.siblingStoreFixture(store.fixture(), Set.of(EDIT));
        host.completeInvitation(context, otherFixture);
        BackendAcceptanceTest.Session otherSession =
                selectStore(context, otherFixture, host.login(context, otherFixture));
        BackendAcceptanceTest.Response crossStore = context.get(
                BackendAcceptanceTest.OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey=" + otherFixture.groupWorkspaceKey()
                        + "&entityType=STORE_TERMINAL&entityId=" + terminalRef + "&page=1&pageSize=20",
                otherSession.cookie(),
                CLIENT_FAILURE);
        assertEquals(
                403,
                crossStore.status(),
                "BUSINESS: audit history never crosses store authorization boundary; status="
                        + crossStore.status() + ", problem=" + crossStore.problemCode() + ", raw=" + crossStore.raw()
                        + ", body=" + crossStore.json() + ", workspace=" + otherFixture.workspaceUuid()
                        + ", group=" + otherFixture.groupWorkspaceKey() + ", store=" + otherFixture.storeId());
    }

    @AcceptanceScenario(
            id = "storeTerminalPageAndWriteGrants",
            module = "ORG",
            operation = "storeTerminalPageAndWriteGrants")
    void storeTerminalPageAndWriteGrants(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Response areas = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES,
                terminalsPath(store.fixture()) + "/area-candidates?pageSize=20",
                store.session().cookie(),
                OK);
        assertNotNull(areas.json().path("items"), "BUSINESS: terminal page exposes area candidates as a list");
        BackendAcceptanceTest.Response tags = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES,
                terminalsPath(store.fixture()) + "/tag-candidates?pageSize=20",
                store.session().cookie(),
                OK);
        assertNotNull(tags.json().path("items"), "BUSINESS: terminal page exposes production-tag candidates as a list");

        UUID existingTerminal = create(context, store, "只读详情终端", "40000001", configuration());
        BackendAcceptanceTest.Fixture readOnlyFixture = host.storeUserFixture(store.fixture(), Set.of());
        host.completeInvitation(context, readOnlyFixture);
        BackendAcceptanceTest.Session readOnlySession =
                selectStore(context, readOnlyFixture, host.login(context, readOnlyFixture));
        JsonNode readOnlyPage = context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                        terminalsPath(readOnlyFixture),
                        readOnlySession.cookie(),
                        OK)
                .json();
        assertFalse(
                readOnlyPage.toString().contains("activationCode"),
                "BUSINESS: read-only list has no activation code field");
        JsonNode readOnlyDetail = context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL,
                        terminalPath(readOnlyFixture, existingTerminal),
                        readOnlySession.cookie(),
                        OK)
                .json();
        assertTrue(readOnlyDetail.path("activationCode").asText().matches("[0-9]{8}"));
        BackendAcceptanceTest.Response rejected = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(readOnlyFixture),
                readOnlySession.cookie(),
                createBody("Read only terminal", null),
                idempotency(),
                CLIENT_FAILURE);
        assertEquals(403, rejected.status(), "BUSINESS: missing write capability rejects direct terminal creation");
        BackendAcceptanceTest.Response rejectedEdit = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(readOnlyFixture, existingTerminal),
                readOnlySession.cookie(),
                replaceBody("不应写入", readOnlyDetail.path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertEquals(403, rejectedEdit.status(), "BUSINESS: missing write capability rejects terminal replacement");
        BackendAcceptanceTest.Response rejectedStatus = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(readOnlyFixture, existingTerminal) + "/status",
                readOnlySession.cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        readOnlyDetail.path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertEquals(403, rejectedStatus.status(), "BUSINESS: missing write capability rejects terminal status change");
        JsonNode readOnlyAfterDenial = context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL,
                        terminalPath(readOnlyFixture, existingTerminal),
                        readOnlySession.cookie(),
                        OK)
                .json();
        assertEquals(
                readOnlyDetail.path("name").asText(),
                readOnlyAfterDenial.path("name").asText(),
                "BUSINESS: denied terminal writes do not change name");
        assertEquals(
                readOnlyDetail.path("version").asLong(),
                readOnlyAfterDenial.path("version").asLong(),
                "BUSINESS: denied terminal writes do not change version");
    }

    @AcceptanceScenario(
            id = "storeTerminalDeviceFunctionMatrix",
            module = "ORG",
            operation = "storeTerminalDeviceFunctionMatrix")
    void storeTerminalDeviceFunctionMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        List<String> functions =
                List.of("ORDERING_CASHIER", "ORDER_CONFIRMATION", "KDS", "KITCHEN_PRINT", "DISPATCH", "QUEUE_CALL");
        int index = 0;
        for (String deviceType : List.of("laptop", "mobile")) {
            for (String functionKey : functions) {
                boolean valid = !(deviceType.equals("mobile")
                        && Set.of("KDS", "DISPATCH").contains(functionKey));
                String name = "设备功能矩阵 " + deviceType + " " + functionKey;
                String code = String.format("31%06d", ++index);
                BackendAcceptanceTest.Response response = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                        terminalsPath(store.fixture()),
                        store.session().cookie(),
                        createBody(name, code, configurationFor(deviceType, functionKey), deviceType),
                        idempotency(),
                        valid ? CREATED : CLIENT_FAILURE);
                if (valid) {
                    UUID terminal =
                            UUID.fromString(response.json().path("terminalRef").asText());
                    assertEquals(
                            deviceType,
                            readDetail(context, store, terminal)
                                    .path("deviceType")
                                    .asText());
                    assertEquals(
                            functionKey,
                            readDetail(context, store, terminal)
                                    .at("/configuration/functions/0/functionKey")
                                    .asText());
                } else {
                    assertProblem(response, "STORE_TERMINAL_RULE_INVALID");
                }
            }
        }

        UUID laptopKds = create(context, store, "KDS 设备转换", "31000020", configurationFor("laptop", "KDS"));
        JsonNode before = readDetail(context, store, laptopKds);
        Map<String, Object> attemptedDeviceTypeChange =
                replaceBody("KDS 设备转换", before.path("version").asLong(), configurationFor("laptop", "KDS"));
        attemptedDeviceTypeChange.put("deviceType", "mobile");
        BackendAcceptanceTest.Response rejectedDeviceChange = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), laptopKds),
                store.session().cookie(),
                attemptedDeviceTypeChange,
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(rejectedDeviceChange, "PLATFORM_COMMON_VALIDATION_FAILED");
        JsonNode afterRejectedDeviceChange = readDetail(context, store, laptopKds);
        assertEquals("laptop", afterRejectedDeviceChange.path("deviceType").asText());
        assertEquals(
                before.path("version").asLong(),
                afterRejectedDeviceChange.path("version").asLong());
        assertEquals(before.path("configuration"), afterRejectedDeviceChange.path("configuration"));

        BackendAcceptanceTest.Response removedUnsupportedFunction = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), laptopKds),
                store.session().cookie(),
                replaceBody(
                        // spotless:off
                        "KDS 设备转换", before.path("version").asLong(), configurationFor("laptop",
                            "ORDERING_CASHIER")),
                        // spotless:on
                idempotency(),
                OK);
        assertEquals(
                laptopKds.toString(),
                removedUnsupportedFunction.json().path("terminalRef").asText());
        assertEquals(
                "laptop",
                readDetail(context, store, laptopKds).path("deviceType").asText());
    }

    @AcceptanceScenario(
            id = "storeTerminalFunctionCardinality",
            module = "ORG",
            operation = "storeTerminalFunctionCardinality")
    void storeTerminalFunctionCardinality(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        int singletonIndex = 0;
        for (String singleton : List.of("ORDERING_CASHIER", "ORDER_CONFIRMATION", "KDS", "DISPATCH", "QUEUE_CALL")) {
            BackendAcceptanceTest.Response duplicateResponse = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBody(
                            "重复单例功能 " + singleton,
                            String.format("32%06d", ++singletonIndex),
                            configurationWithFunctions("laptop", List.of(singleton, singleton))),
                    idempotency(),
                    CLIENT_FAILURE);
            assertProblem(duplicateResponse, "STORE_TERMINAL_RULE_INVALID");
        }
        UUID kitchen = create(
                context,
                store,
                "多厨打功能",
                "32000001",
                configurationWithFunctions("laptop", List.of("KITCHEN_PRINT", "KITCHEN_PRINT", "KITCHEN_PRINT")));
        assertEquals(
                3,
                readDetail(context, store, kitchen)
                        .path("configuration")
                        .path("functions")
                        .size());
    }

    @AcceptanceScenario(
            id = "storeTerminalRequiresFunction",
            module = "ORG",
            operation = "storeTerminalRequiresFunction")
    void storeTerminalRequiresFunction(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Response empty = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("无功能终端", "31000005", emptyConfiguration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(empty, "STORE_TERMINAL_RULE_INVALID");

        UUID terminal = create(context, store, "移除最后功能", "32000002", configuration());
        JsonNode before = readDetail(context, store, terminal);
        BackendAcceptanceTest.Response removed = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("移除最后功能", before.path("version").asLong(), emptyConfiguration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(removed, "STORE_TERMINAL_RULE_INVALID");
        JsonNode after = readDetail(context, store, terminal);
        assertEquals(before.path("version").asLong(), after.path("version").asLong());
        assertEquals(before.path("configuration"), after.path("configuration"));
    }

    @AcceptanceScenario(
            id = "storeTerminalFunctionRangeMatrix",
            module = "ORG",
            operation = "storeTerminalFunctionRangeMatrix")
    void storeTerminalFunctionRangeMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        Map<String, Set<String>> allowed = Map.of(
                "ORDERING_CASHIER", Set.of("TABLE_AREA", "NO_TABLE"),
                "ORDER_CONFIRMATION", Set.of("TABLE_AREA", "NO_TABLE", "DELIVERY"),
                "KDS", Set.of("PRODUCTION_TAG"),
                "KITCHEN_PRINT", Set.of("PRODUCTION_TAG"),
                "DISPATCH", Set.of("TABLE_AREA", "NO_TABLE", "DELIVERY"),
                "QUEUE_CALL", Set.of());
        int index = 0;
        for (Map.Entry<String, Set<String>> function : allowed.entrySet()) {
            if (function.getValue().isEmpty()) {
                String name = "功能范围矩阵 " + function.getKey() + " 空范围";
                BackendAcceptanceTest.Response response = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                        terminalsPath(store.fixture()),
                        store.session().cookie(),
                        createBody(
                                name,
                                String.format("33%06d", ++index),
                                configurationWithFunctions("laptop", List.of(function.getKey()))),
                        idempotency(),
                        CREATED);
                UUID terminal =
                        UUID.fromString(response.json().path("terminalRef").asText());
                JsonNode detail = readDetail(context, store, terminal);
                assertTrue(detail.at("/configuration/functions/0/ranges").isArray());
                assertEquals(0, detail.at("/configuration/functions/0/ranges").size());
                continue;
            }
            for (String range : List.of("TABLE_AREA", "NO_TABLE", "DELIVERY", "PRODUCTION_TAG")) {
                boolean valid = function.getValue().contains(range);
                String name = "功能范围矩阵 " + function.getKey() + " " + range;
                Map<String, Object> configuration = configurationWithRange(
                        function.getKey(), range, range.equals("TABLE_AREA") || range.equals("PRODUCTION_TAG"));
                BackendAcceptanceTest.Response response = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                        terminalsPath(store.fixture()),
                        store.session().cookie(),
                        createBody(name, String.format("33%06d", ++index), configuration),
                        idempotency(),
                        valid ? CREATED : CLIENT_FAILURE);
                if (valid) {
                    UUID terminal =
                            UUID.fromString(response.json().path("terminalRef").asText());
                    assertEquals(
                            range,
                            readDetail(context, store, terminal)
                                    .at("/configuration/functions/0/ranges/0/key")
                                    .asText());
                } else {
                    assertProblem(response, "STORE_TERMINAL_RULE_INVALID");
                }
            }
        }
    }

    @AcceptanceScenario(
            id = "storeTerminalRangeSelectionIdentity",
            module = "ORG",
            operation = "storeTerminalRangeSelectionIdentity")
    void storeTerminalRangeSelectionIdentity(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        StoreContext setup = referenceSetupStore(context, store);
        AreaRef first = createArea(context, setup, "TABLE_AREA", "终端桌台区一", "TERMINAL-TABLE-1");
        AreaRef second = createArea(context, setup, "TABLE_AREA", "终端桌台区二", "TERMINAL-TABLE-2");
        AreaRef scan = createArea(context, setup, "SCAN_AREA", "终端扫码区", "TERMINAL-SCAN-1");
        TagRef tag = createTag(context, setup, "TERMINAL-TAG-1", "终端生产标签");

        BackendAcceptanceTest.Response candidates = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES,
                terminalsPath(store.fixture()) + "/area-candidates?pageSize=20",
                store.session().cookie(),
                OK);
        assertTrue(
                candidates.json().path("items").toString().contains(first.ref().toString()));
        assertTrue(
                candidates.json().path("items").toString().contains(second.ref().toString()));
        assertFalse(
                candidates.json().path("items").toString().contains(scan.ref().toString()),
                "BUSINESS: scan area is not a table-area candidate");

        UUID selected = create(
                context,
                store,
                "指定桌台区",
                "34000001",
                configurationWithRangeRefs(
                        "ORDERING_CASHIER",
                        "TABLE_AREA",
                        false,
                        List.of(first.ref().toString(), second.ref().toString())));
        JsonNode selectedDetail = readDetail(context, store, selected);
        assertEquals(
                List.of(first.ref().toString(), second.ref().toString()),
                textArray(selectedDetail.at("/configuration/functions/0/ranges/0/refs")));

        UUID all = create(
                context,
                store,
                "全部桌台区",
                "34000002",
                configurationWithRangeRefs("ORDERING_CASHIER", "TABLE_AREA", true, List.of()));
        assertTrue(readDetail(context, store, all)
                .at("/configuration/functions/0/ranges/0/all")
                .asBoolean(false));

        UUID tagged = create(
                context,
                store,
                "指定生产标签",
                "34000003",
                configurationWithRangeRefs(
                        "KITCHEN_PRINT",
                        "PRODUCTION_TAG",
                        false,
                        List.of(tag.ref().toString())));
        assertEquals(
                tag.ref().toString(),
                readDetail(context, store, tagged)
                        .at("/configuration/functions/0/ranges/0/refs/0")
                        .asText());

        BackendAcceptanceTest.Response scanAsTable = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "扫码区伪装桌台区",
                        "34000004",
                        configurationWithRangeRefs(
                                "ORDERING_CASHIER",
                                "TABLE_AREA",
                                false,
                                List.of(scan.ref().toString()))),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(scanAsTable, "STORE_TERMINAL_REFERENCE_INVALID");
    }

    @AcceptanceScenario(
            id = "storeTerminalNewReferenceEligibility",
            module = "ORG",
            operation = "storeTerminalNewReferenceEligibility")
    void storeTerminalNewReferenceEligibility(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        StoreContext setup = referenceSetupStore(context, store);
        AreaRef area = createArea(context, setup, "TABLE_AREA", "新引用桌台区", "TERMINAL-NEW-AREA");
        TagRef tag = createTag(context, setup, "TERMINAL-NEW-TAG", "新引用标签");
        BackendAcceptanceTest.Response areas = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES,
                terminalsPath(store.fixture()) + "/area-candidates?pageSize=20",
                store.session().cookie(),
                OK);
        assertTrue(
                areas.json().path("items").toString().contains(area.ref().toString()),
                "BUSINESS: newly enabled area is a typed candidate");
        BackendAcceptanceTest.Response tags = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES,
                terminalsPath(store.fixture()) + "/tag-candidates?pageSize=20",
                store.session().cookie(),
                OK);
        assertTrue(
                tags.json().path("items").toString().contains(tag.ref().toString()),
                "BUSINESS: newly enabled production tag is a typed candidate");
        UUID terminal = create(
                context,
                store,
                "新引用终端",
                "34000005",
                configurationWithRangeRefs(
                        "ORDERING_CASHIER",
                        "TABLE_AREA",
                        false,
                        List.of(area.ref().toString())));
        assertEquals(
                area.ref().toString(),
                readDetail(context, store, terminal)
                        .at("/configuration/functions/0/ranges/0/refs/0")
                        .asText());
    }

    @AcceptanceScenario(
            id = "storeTerminalHistoricalReferences",
            module = "ORG",
            operation = "storeTerminalHistoricalReferences")
    void storeTerminalHistoricalReferences(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        StoreContext setup = referenceSetupStore(context, store);
        AreaRef area = createArea(context, setup, "TABLE_AREA", "历史引用桌台区", "TERMINAL-HISTORY-AREA");
        TagRef tag = createTag(context, setup, "TERMINAL-HISTORY-TAG", "历史引用标签");
        UUID terminal = create(
                context,
                store,
                "历史引用终端",
                "34000006",
                configurationWithRangeRefs(
                        "ORDERING_CASHIER",
                        "TABLE_AREA",
                        false,
                        List.of(area.ref().toString())));
        JsonNode before = readDetail(context, store, terminal);
        // spotless:off
        AreaRef renamed = updateArea(context, setup, area, "历史引用桌台区改名", area.code(), "TABLE_AREA",
            "ENABLED");
        // spotless:on
        transitionArea(context, setup, renamed, "DISABLED");
        transitionTag(context, setup, tag, "DISABLED");
        JsonNode retained = readDetail(context, store, terminal);
        assertEquals(
                before.at("/configuration/functions/0/ranges/0/refs"),
                retained.at("/configuration/functions/0/ranges/0/refs"),
                "BUSINESS: existing references remain writable after the referenced object is disabled");

        // spotless:off
        AreaRef replacement = createArea(context, setup, "TABLE_AREA", "历史引用新桌台区",
            "TERMINAL-HISTORY-NEW");
        // spotless:on
        BackendAcceptanceTest.Response added = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody(
                        "历史引用终端",
                        retained.path("version").asLong(),
                        configurationWithExistingFunctionRangeRefs(
                                retained,
                                "TABLE_AREA",
                                false,
                                List.of(area.ref().toString(), replacement.ref().toString()))),
                idempotency(),
                OK);
        assertEquals(terminal.toString(), added.json().path("terminalRef").asText());
        JsonNode addedRead = readDetail(context, store, terminal);
        assertTrue(addedRead
                .at("/configuration/functions/0/ranges/0/refs")
                .toString()
                .contains(area.ref().toString()));
        assertTrue(addedRead
                .at("/configuration/functions/0/ranges/0/refs")
                .toString()
                .contains(replacement.ref().toString()));
    }

    @AcceptanceScenario(
            id = "storeTerminalReferencesUseRef",
            module = "ORG",
            operation = "storeTerminalReferencesUseRef")
    void storeTerminalReferencesUseRef(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        StoreContext setup = referenceSetupStore(context, store);
        AreaRef area = createArea(context, setup, "TABLE_AREA", "可作废引用", "TERMINAL-VOID-AREA");
        TagRef tag = createTag(context, setup, "TERMINAL-VOID-TAG", "可作废标签");
        UUID terminal = create(
                context,
                store,
                "引用稳定性终端",
                "34000007",
                configurationWithRangeRefs(
                        "ORDERING_CASHIER",
                        "TABLE_AREA",
                        false,
                        List.of(area.ref().toString())));
        JsonNode first = readDetail(context, store, terminal);
        transitionArea(context, setup, area, "VOIDED");
        transitionTag(context, setup, tag, "VOIDED");
        createArea(context, setup, "TABLE_AREA", "同编码新桌台区", area.code());
        createTag(context, setup, tag.code(), "同编码新标签");
        JsonNode retained = readDetail(context, store, terminal);
        UUID same = UUID.fromString(first.path("terminalRef").asText());
        assertEquals(terminal, same, "BUSINESS: detail readback preserves terminal identity");
        assertEquals(
                first.at("/configuration/functions/0/ranges/0/refs"),
                retained.at("/configuration/functions/0/ranges/0/refs"),
                "BUSINESS: re-created same-code candidates never replace historical refs");
    }

    @AcceptanceScenario(
            id = "storeTerminalSceneOwnershipMatrix",
            module = "ORG",
            operation = "storeTerminalSceneOwnershipMatrix")
    void storeTerminalSceneOwnershipMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        List<SceneCase> scenes = List.of(
                new SceneCase("ORDERING_CASHIER", "TABLE_ORDER_TICKET"),
                new SceneCase("ORDERING_CASHIER", "PRECHECK_TICKET"),
                new SceneCase("ORDERING_CASHIER", "CHECKOUT_TICKET"),
                new SceneCase("ORDERING_CASHIER", "PICKUP_TICKET"),
                new SceneCase("ORDERING_CASHIER", "REVERSE_CHECKOUT_TICKET"),
                new SceneCase("ORDERING_CASHIER", "REFUND_RECEIPT"),
                new SceneCase("KITCHEN_PRINT", "PREPARATION_TICKET"),
                new SceneCase("KITCHEN_PRINT", "RETURN_TICKET"),
                new SceneCase("KITCHEN_PRINT", "EXPEDITE_TICKET"),
                new SceneCase("KITCHEN_PRINT", "START_PREPARATION_TICKET"),
                new SceneCase("KITCHEN_PRINT", "LABEL_PREPARATION_TICKET"),
                new SceneCase("DISPATCH", "DISH_CHECK_SUMMARY"),
                new SceneCase("DISPATCH", "FOOD_DELIVERY_TICKET"),
                new SceneCase("DISPATCH", "DELIVERY_TICKET"),
                new SceneCase("DISPATCH", "DELIVERY_MERCHANT_COPY"),
                new SceneCase("DISPATCH", "DELIVERY_CUSTOMER_COPY"),
                new SceneCase("QUEUE_CALL", "QUEUE_NUMBER_TICKET"));
        int index = 0;
        for (SceneCase scene : scenes) {
            UUID terminal = create(
                    context,
                    store,
                    "场景归属 " + scene.sceneKey(),
                    String.format("35%06d", ++index),
                    configurationWithScene(scene.functionKey(), scene.sceneKey()));
            assertEquals(
                    scene.sceneKey(),
                    readDetail(context, store, terminal)
                            .at("/configuration/functions/0/scenes/0/sceneKey")
                            .asText());
            BackendAcceptanceTest.Response wrongFunction = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBody(
                            "错误功能场景 " + scene.sceneKey(),
                            String.format("36%06d", index),
                            configurationWithScene("ORDER_CONFIRMATION", scene.sceneKey())),
                    idempotency(),
                    CLIENT_FAILURE);
            assertProblem(wrongFunction, "STORE_TERMINAL_RULE_INVALID");
        }
    }

    @AcceptanceScenario(
            id = "storeTerminalScenePaperMatrix",
            module = "ORG",
            operation = "storeTerminalScenePaperMatrix")
    void storeTerminalScenePaperMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        List<String> papers = List.of(
                "THERMAL_58", "THERMAL_80", "LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40", "LABEL_80_50");
        List<SceneCase> scenes = List.of(
                new SceneCase("ORDERING_CASHIER", "TABLE_ORDER_TICKET"),
                new SceneCase("ORDERING_CASHIER", "PRECHECK_TICKET"),
                new SceneCase("ORDERING_CASHIER", "CHECKOUT_TICKET"),
                new SceneCase("ORDERING_CASHIER", "PICKUP_TICKET"),
                new SceneCase("ORDERING_CASHIER", "REVERSE_CHECKOUT_TICKET"),
                new SceneCase("ORDERING_CASHIER", "REFUND_RECEIPT"),
                new SceneCase("KITCHEN_PRINT", "PREPARATION_TICKET"),
                new SceneCase("KITCHEN_PRINT", "RETURN_TICKET"),
                new SceneCase("KITCHEN_PRINT", "EXPEDITE_TICKET"),
                new SceneCase("KITCHEN_PRINT", "START_PREPARATION_TICKET"),
                new SceneCase("KITCHEN_PRINT", "LABEL_PREPARATION_TICKET"),
                new SceneCase("DISPATCH", "DISH_CHECK_SUMMARY"),
                new SceneCase("DISPATCH", "FOOD_DELIVERY_TICKET"),
                new SceneCase("DISPATCH", "DELIVERY_TICKET"),
                new SceneCase("DISPATCH", "DELIVERY_MERCHANT_COPY"),
                new SceneCase("DISPATCH", "DELIVERY_CUSTOMER_COPY"),
                new SceneCase("QUEUE_CALL", "QUEUE_NUMBER_TICKET"));
        int index = 0;
        for (SceneCase scene : scenes) {
            for (String paper : papers) {
                boolean allowed = scene.sceneKey().equals("LABEL_PREPARATION_TICKET")
                        ? paper.startsWith("LABEL")
                        : paper.startsWith("THERMAL");
                String name = "场景纸型矩阵 " + scene.sceneKey() + " " + paper;
                BackendAcceptanceTest.Response response = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                        terminalsPath(store.fixture()),
                        store.session().cookie(),
                        createBody(
                                name,
                                String.format("37%06d", ++index),
                                configurationWithPrinterScene(
                                        scene.functionKey(),
                                        scene.sceneKey(),
                                        "GENERIC",
                                        genericModelForPaper(paper),
                                        paper,
                                        "NETWORK",
                                        "192.0.2." + (10 + index % 200))),
                        idempotency(),
                        allowed ? CREATED : CLIENT_FAILURE);
                assertEquals(
                        allowed,
                        response.status() == 201,
                        "BUSINESS: paper matrix status; scene=" + scene.sceneKey() + ", paper=" + paper
                                + ", model=" + genericModelForPaper(paper) + ", status=" + response.status()
                                + ", problem=" + response.problemCode() + ", body=" + response.json());
                if (allowed) {
                    UUID terminal =
                            UUID.fromString(response.json().path("terminalRef").asText());
                    assertEquals(
                            paper,
                            readDetail(context, store, terminal)
                                    .at("/configuration/printers/0/paperSpecKey")
                                    .asText());
                } else {
                    assertProblem(response, "STORE_TERMINAL_RULE_INVALID");
                }
            }
        }
        UUID thermal = create(
                context,
                store,
                "热敏改标签",
                "37999991",
                configurationWithPrinterScene(
                        "KITCHEN_PRINT",
                        "PREPARATION_TICKET",
                        "GENERIC",
                        "GENERIC_THERMAL_58",
                        "THERMAL_58",
                        "NETWORK",
                        "192.0.2.211"));
        JsonNode before = readDetail(context, store, thermal);
        BackendAcceptanceTest.Response rejected = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), thermal),
                store.session().cookie(),
                replaceBody(
                        "热敏改标签",
                        before.path("version").asLong(),
                        configurationWithPrinterAndFunctionRefs(
                                before.at("/configuration/printers/0/ref").asText(),
                                before.at("/configuration/functions/0/ref").asText(),
                                "GENERIC",
                                "GENERIC_LABEL_40_30",
                                "LABEL_40_30",
                                "NETWORK",
                                "192.0.2.212",
                                "PREPARATION_TICKET")),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(rejected, "STORE_TERMINAL_RULE_INVALID");
        assertEquals(
                before.path("configuration"),
                readDetail(context, store, thermal).path("configuration"));
    }

    @AcceptanceScenario(
            id = "storeTerminalConnectionParameterMatrix",
            module = "ORG",
            operation = "storeTerminalConnectionParameterMatrix")
    void storeTerminalConnectionParameterMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        List<ConnectionCase> connections = List.of(
                new ConnectionCase("NETWORK", "GENERIC_THERMAL_58", "192.0.2.16"),
                new ConnectionCase("CLOUD", "GENERIC_THERMAL_58", "cloud-terminal-01"),
                new ConnectionCase("USB", "GENERIC_THERMAL_58", "usb-terminal-01"),
                new ConnectionCase("BLUETOOTH", "GENERIC_THERMAL_58", "bt-terminal-01"),
                new ConnectionCase("BUILT_IN", "BUILTIN_THERMAL_58", null));
        int index = 0;
        for (ConnectionCase connection : connections) {
            UUID terminal = create(
                    context,
                    store,
                    "连接方式 " + connection.method(),
                    String.format("38%06d", ++index),
                    configurationWithPrinter(
                            "GENERIC", connection.model(), "THERMAL_58", connection.method(), connection.parameter()));
            JsonNode printer = readDetail(context, store, terminal).at("/configuration/printers/0");
            assertEquals(
                    connection.method(), printer.path("connectionMethodKey").asText());
            if (connection.parameter() != null)
                assertEquals(
                        connection.parameter(),
                        printer.path("connectionParameter").asText());
        }
        for (String method : List.of("NETWORK", "CLOUD", "USB", "BLUETOOTH")) {
            BackendAcceptanceTest.Response missing = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBody(
                            "缺少连接参数 " + method,
                            String.format("39%06d", ++index),
                            configurationWithPrinter("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", method, null)),
                    idempotency(),
                    CLIENT_FAILURE);
            assertProblem(missing, "STORE_TERMINAL_RULE_INVALID");
        }
        BackendAcceptanceTest.Response builtinParameter = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "内置打印机多余参数",
                        String.format("39%06d", ++index),
                        configurationWithPrinter(
                                "GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58", "BUILT_IN", "unexpected")),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(builtinParameter, "STORE_TERMINAL_RULE_INVALID");
        for (String method : List.of("USB", "BLUETOOTH")) {
            BackendAcceptanceTest.Response control = context.post(
                    BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                    terminalsPath(store.fixture()),
                    store.session().cookie(),
                    createBody(
                            "控制字符 " + method,
                            String.format("39%06d", ++index),
                            configurationWithPrinter(
                                    "GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", method, "device-\u0001")),
                    idempotency(),
                    CLIENT_FAILURE);
            assertProblem(control, "STORE_TERMINAL_RULE_INVALID");
        }
    }

    @AcceptanceScenario(id = "storeTerminalScenePrinterSet", module = "ORG", operation = "storeTerminalScenePrinterSet")
    void storeTerminalScenePrinterSet(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(context, store, "多打印机场景", "31000019", configurationWithThreePrinterScene());
        JsonNode detail = readDetail(context, store, terminal);
        assertEquals(3, detail.at("/configuration/printers").size(), "BUSINESS: all printers are persisted");
        assertEquals(
                3,
                detail.at("/configuration/functions/0/scenes/0/printers").size(),
                "BUSINESS: scene owns an unordered printer set");
        List<String> refs = textFieldArray(detail.at("/configuration/functions/0/scenes/0/printers"), "printerRef");
        assertEquals(3, refs.size());

        Map<String, Object> duplicateBinding = configurationWithPrinterRefs(
                detail,
                List.of(
                        detail.at("/configuration/printers/0/ref").asText(),
                        detail.at("/configuration/printers/0/ref").asText()));
        BackendAcceptanceTest.Response duplicate = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("多打印机场景", detail.path("version").asLong(), duplicateBinding),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(duplicate, "STORE_TERMINAL_RULE_INVALID");

        Map<String, Object> renamed = configurationWithPrinterRefs(detail, refs);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> renamedPrinters = (List<Map<String, Object>>) renamed.get("printers");
        renamedPrinters.get(0).put("name", "打印机一改名");
        BackendAcceptanceTest.Response renamedResponse = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody(
                        "多打印机场景",
                        readDetail(context, store, terminal).path("version").asLong(),
                        renamed),
                idempotency(),
                OK);
        assertEquals(
                terminal.toString(), renamedResponse.json().path("terminalRef").asText());
        JsonNode renamedRead = readDetail(context, store, terminal);
        assertEquals(detail.at("/configuration/printers/0/ref"), renamedRead.at("/configuration/printers/0/ref"));
        assertEquals("打印机一改名", renamedRead.at("/configuration/printers/0/name").asText());

        Map<String, Object> withNewPrinter = configurationWithPrinterRefsAndNewPrinter(renamedRead);
        BackendAcceptanceTest.Response added = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("多打印机场景", renamedRead.path("version").asLong(), withNewPrinter),
                idempotency(),
                OK);
        assertEquals(terminal.toString(), added.json().path("terminalRef").asText());
        assertEquals(
                4,
                readDetail(context, store, terminal)
                        .at("/configuration/printers")
                        .size());

        Map<String, Object> foreignReference = configurationWithPrinterRefs(
                readDetail(context, store, terminal), List.of(UUID.randomUUID().toString()));
        BackendAcceptanceTest.Response foreign = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("跨终端打印机引用", "34000008", foreignReference),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(foreign, "STORE_TERMINAL_RULE_INVALID");
    }

    @AcceptanceScenario(id = "storeTerminalSceneOrderTypes", module = "ORG", operation = "storeTerminalSceneOrderTypes")
    void storeTerminalSceneOrderTypes(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(
                context,
                store,
                "订单类型场景",
                "31000020",
                configurationWithSceneOrderTypes(
                        "ORDERING_CASHIER", "PRECHECK_TICKET", List.of("DINE_IN", "TAKEAWAY")));
        assertEquals(
                2,
                readDetail(context, store, terminal)
                        .at("/configuration/functions/0/scenes/0/orderTypes")
                        .size());
        UUID empty = create(
                context,
                store,
                "空订单类型场景",
                "34000009",
                configurationWithSceneOrderTypes("ORDERING_CASHIER", "CHECKOUT_TICKET", List.of()));
        assertEquals(
                0,
                readDetail(context, store, empty)
                        .at("/configuration/functions/0/scenes/0/orderTypes")
                        .size());
        BackendAcceptanceTest.Response unknown = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "未知订单类型",
                        "34000010",
                        configurationWithSceneOrderTypes(
                                "ORDERING_CASHIER", "PRECHECK_TICKET", List.of("UNKNOWN_ORDER_TYPE"))),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(unknown, "STORE_TERMINAL_RULE_INVALID");
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationUniqueness",
            module = "ORG",
            operation = "storeTerminalActivationUniqueness")
    void storeTerminalActivationUniqueness(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID occupied = create(context, store, "激活码占用", "31000021", configuration());
        BackendAcceptanceTest.Response duplicate = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("重复激活码", "31000021", configuration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(duplicate, "STORE_TERMINAL_ACTIVATION_CODE_CONFLICT");

        JsonNode occupiedDetail = readDetail(context, store, occupied);
        context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), occupied) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "VOIDED",
                        "expectedVersion",
                        occupiedDetail.path("version").asLong()),
                idempotency(),
                OK);
        BackendAcceptanceTest.Response voidedDuplicate = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("作废码不可复用", "31000021", configuration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(voidedDuplicate, "STORE_TERMINAL_ACTIVATION_CODE_CONFLICT");

        BackendAcceptanceTest.Fixture sibling = host.siblingStoreFixture(store.fixture(), Set.of(EDIT));
        host.completeInvitation(context, sibling);
        BackendAcceptanceTest.Session siblingSession = selectStore(context, sibling, host.login(context, sibling));
        BackendAcceptanceTest.Response sameGroupOtherStore = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(sibling),
                siblingSession.cookie(),
                createBody("同集团另一门店", "31000021", configuration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(sameGroupOtherStore, "STORE_TERMINAL_ACTIVATION_CODE_CONFLICT");

        BackendAcceptanceTest.Fixture otherGroup =
                host.siblingStoreFixture(host.fixture("PROJECT", Set.of(EDIT)), Set.of(EDIT));
        host.completeInvitation(context, otherGroup);
        BackendAcceptanceTest.Session otherGroupSession =
                selectStore(context, otherGroup, host.login(context, otherGroup));
        BackendAcceptanceTest.Response otherGroupCreated = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(otherGroup),
                otherGroupSession.cookie(),
                createBody("另一集团同码", "31000021", configuration()),
                idempotency(),
                CREATED);
        assertFalse(otherGroupCreated.json().path("terminalRef").asText().isBlank());

        String fixedKey = "acceptance-store-terminal-idempotency-fixed";
        context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("幂等原请求", "31000031", configuration()),
                idempotency(fixedKey),
                CREATED);
        BackendAcceptanceTest.Response changedRequest = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody("幂等改码请求", "31000032", configuration()),
                idempotency(fixedKey),
                CLIENT_FAILURE);
        assertProblem(changedRequest, "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT");
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationImmutable",
            module = "ORG",
            operation = "storeTerminalActivationImmutable")
    void storeTerminalActivationImmutable(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(context, store, "状态转换终端", "31000022", configuration());
        JsonNode before = readDetail(context, store, terminal);
        BackendAcceptanceTest.Response invalid = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminal) + "/status",
                store.session().cookie(),
                Map.of(
                        "status",
                        "ENABLED",
                        "expectedVersion",
                        before.path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(invalid, "STORE_TERMINAL_STATUS_TRANSITION_INVALID");
        assertEquals(
                before.path("version").asLong(),
                readDetail(context, store, terminal).path("version").asLong());

        Map<String, Object> replaceWithCode =
                new LinkedHashMap<>(replaceBody("不允许改码", before.path("version").asLong()));
        replaceWithCode.put("activationCode", "99887766");
        BackendAcceptanceTest.Response replaceCode = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceWithCode,
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(replaceCode.status() >= 400, "BUSINESS: replacement cannot carry an activation code");

        Map<String, Object> statusWithCode = new LinkedHashMap<>();
        statusWithCode.put("status", "DISABLED");
        statusWithCode.put("expectedVersion", before.path("version").asLong());
        statusWithCode.put("activationCode", "99887766");
        BackendAcceptanceTest.Response statusCode = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminal) + "/status",
                store.session().cookie(),
                statusWithCode,
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(statusCode.status() >= 400, "BUSINESS: status command cannot carry an activation code");

        JsonNode disabled = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                        terminalPath(store.fixture(), terminal) + "/status",
                        store.session().cookie(),
                        Map.of(
                                "status",
                                "DISABLED",
                                "expectedVersion",
                                before.path("version").asLong()),
                        idempotency(),
                        OK)
                .json();
        JsonNode enabled = context.post(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                        terminalPath(store.fixture(), terminal) + "/status",
                        store.session().cookie(),
                        Map.of(
                                "status",
                                "ENABLED",
                                "expectedVersion",
                                disabled.path("version").asLong()),
                        idempotency(),
                        OK)
                .json();
        assertEquals(
                before.path("activationCode"),
                readDetail(context, store, terminal).path("activationCode"));
        assertTrue(enabled.path("version").asLong() > before.path("version").asLong());
    }

    @AcceptanceScenario(
            id = "storeTerminalActivationReadFace",
            module = "ORG",
            operation = "storeTerminalActivationReadFace")
    void storeTerminalActivationReadFace(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(context, store, "激活码展示", "31000023", configuration());
        assertEquals(
                "31000023",
                readDetail(context, store, terminal).path("activationCode").asText());
        assertFalse(context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                        terminalsPath(store.fixture()),
                        store.session().cookie(),
                        OK)
                .json()
                .toString()
                .contains("31000023"));
    }

    @AcceptanceScenario(
            id = "storeTerminalDisabledStoreParity",
            module = "ORG",
            operation = "storeTerminalDisabledStoreParity")
    void storeTerminalDisabledStoreParity(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Fixture statusActor =
                host.projectUserFixture(store.fixture(), Set.of("BC-ORG-STORE-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, statusActor);
        BackendAcceptanceTest.Session statusSession =
                selectStore(context, statusActor, host.login(context, statusActor));
        long organizationStoreVersionBeforeTerminalCreate =
                host.organizationStoreVersion(store.fixture().storeId());
        UUID terminal = create(context, store, "停用门店终端", "41000001", configuration());
        long organizationStoreVersion =
                host.organizationStoreVersion(store.fixture().storeId());
        assertEquals(
                organizationStoreVersionBeforeTerminalCreate,
                organizationStoreVersion,
                "BUSINESS: creating a terminal must not change the organization store revision");
        BackendAcceptanceTest.Fixture readActor = host.storeUserFixture(store.fixture(), Set.of(EDIT));
        host.completeInvitation(context, readActor);
        BackendAcceptanceTest.Session readSession = selectStore(context, readActor, host.login(context, readActor));
        JsonNode disabledStore = context.post(
                        BackendAcceptanceTest.OPERATIONS_ORGANIZATION_STORE_STATUS,
                        "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey()
                                + "/organization/stores/" + store.fixture().storeId() + "/status",
                        statusSession.cookie(),
                        Map.of("targetStatus", "DISABLED", "expectedVersion", organizationStoreVersion),
                        idempotency(),
                        OK)
                .json();
        assertEquals(
                "DISABLED",
                disabledStore.path("status").asText(),
                "BUSINESS: organization store status command is read back");
        assertEquals(
                organizationStoreVersion + 1,
                host.organizationStoreVersion(store.fixture().storeId()),
                "BUSINESS: organization store status command increments the persisted version");
        BackendAcceptanceTest.Response page = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINALS,
                terminalsPath(readActor),
                readSession.cookie(),
                CLIENT_FAILURE);
        assertEquals(
                404, page.status(), "BUSINESS: disabled store terminal page follows the store-page scope boundary");
        assertProblem(page, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        BackendAcceptanceTest.Response detail = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL,
                terminalPath(readActor, terminal),
                readSession.cookie(),
                CLIENT_FAILURE);
        assertEquals(
                404, detail.status(), "BUSINESS: disabled store terminal detail follows the store-page scope boundary");
        assertProblem(detail, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        BackendAcceptanceTest.Response candidates = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES,
                terminalsPath(readActor) + "/area-candidates?pageSize=20",
                readSession.cookie(),
                CLIENT_FAILURE);
        assertEquals(
                404,
                candidates.status(),
                "BUSINESS: disabled store terminal area candidates follow the store-page scope boundary");
        assertProblem(candidates, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
        BackendAcceptanceTest.Response tagCandidates = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES,
                terminalsPath(readActor) + "/tag-candidates?pageSize=20",
                readSession.cookie(),
                CLIENT_FAILURE);
        assertEquals(
                404,
                tagCandidates.status(),
                "BUSINESS: disabled store terminal tag candidates follow the store-page scope boundary");
        assertProblem(tagCandidates, "PLATFORM_COMMON_RESOURCE_NOT_FOUND");
    }

    @AcceptanceScenario(
            id = "storeTerminalIgnoresOperatingSwitch",
            module = "ORG",
            operation = "storeTerminalIgnoresOperatingSwitch")
    void storeTerminalIgnoresOperatingSwitch(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture base = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Fixture closed = host.closedStoreFixture(base, Set.of(EDIT));
        host.completeInvitation(context, closed);
        StoreContext store = new StoreContext(closed, selectStore(context, closed, host.login(context, closed)));
        UUID terminal = create(context, store, "经营开关无关", "31000024", configuration());
        assertEquals(
                terminal.toString(),
                readDetail(context, store, terminal).path("terminalRef").asText());
        assertTrue(context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_AREA_CANDIDATES,
                        terminalsPath(store.fixture()) + "/area-candidates?pageSize=20",
                        store.session().cookie(),
                        OK)
                .json()
                .path("items")
                .isArray());
        assertTrue(context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_TAG_CANDIDATES,
                        terminalsPath(store.fixture()) + "/tag-candidates?pageSize=20",
                        store.session().cookie(),
                        OK)
                .json()
                .path("items")
                .isArray());
    }

    @AcceptanceScenario(
            id = "storeTerminalFunctionRemovalIdentity",
            module = "ORG",
            operation = "storeTerminalFunctionRemovalIdentity")
    void storeTerminalFunctionRemovalIdentity(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(
                context,
                store,
                "功能身份",
                "31000025",
                configurationWithFunctions("laptop", List.of("ORDERING_CASHIER", "KITCHEN_PRINT")));
        JsonNode before = readDetail(context, store, terminal);
        JsonNode functions = before.path("configuration").path("functions");
        Map<String, Object> replacement = configurationFromExistingFunction(functions.get(0));
        BackendAcceptanceTest.Response updated = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("功能身份", before.path("version").asLong(), replacement),
                idempotency(),
                OK);
        assertEquals(terminal.toString(), updated.json().path("terminalRef").asText());
        assertEquals(
                1,
                readDetail(context, store, terminal)
                        .at("/configuration/functions")
                        .size());
    }

    @AcceptanceScenario(
            id = "storeTerminalSoftConstraintsAllowed",
            module = "ORG",
            operation = "storeTerminalSoftConstraintsAllowed")
    void storeTerminalSoftConstraintsAllowed(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(
                // spotless:off
                context, store, "软约束样本", "31000026", configurationWithScene("ORDERING_CASHIER",
                    "PRECHECK_TICKET"));
                // spotless:on
        assertEquals("软约束样本", readDetail(context, store, terminal).path("name").asText());
    }

    @AcceptanceScenario(
            id = "storeTerminalAtomicReplaceAndCas",
            module = "ORG",
            operation = "storeTerminalAtomicReplaceAndCas")
    void storeTerminalAtomicReplaceAndCas(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(context, store, "版本条件", "31000027", configuration());
        JsonNode before = readDetail(context, store, terminal);
        context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("版本条件一", before.path("version").asLong(), configuration()),
                idempotency(),
                OK);
        BackendAcceptanceTest.Response stale = context.put(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                terminalPath(store.fixture(), terminal),
                store.session().cookie(),
                replaceBody("版本条件二", before.path("version").asLong(), configuration()),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(stale, "PLATFORM_COMMON_VERSION_CONFLICT");
        assertEquals("版本条件一", readDetail(context, store, terminal).path("name").asText());
    }

    @AcceptanceScenario(
            id = "storeTerminalCrossStoreIsolation",
            module = "ORG",
            operation = "storeTerminalCrossStoreIsolation")
    void storeTerminalCrossStoreIsolation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        UUID terminal = create(context, store, "跨店隔离", "31000028", configuration());
        BackendAcceptanceTest.Fixture otherFixture = host.siblingStoreFixture(store.fixture(), Set.of(EDIT));
        host.completeInvitation(context, otherFixture);
        BackendAcceptanceTest.Session otherSession =
                selectStore(context, otherFixture, host.login(context, otherFixture));
        BackendAcceptanceTest.Response crossStore = context.get(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL,
                terminalPath(otherFixture, terminal),
                otherSession.cookie(),
                CLIENT_FAILURE);
        assertTrue(crossStore.status() >= 400, "BUSINESS: terminal detail cannot cross store boundary");
    }

    @AcceptanceScenario(
            id = "storeTerminalPrinterModelPaperMatrix",
            module = "ORG",
            operation = "storeTerminalPrinterModelPaperMatrix")
    void storeTerminalPrinterModelPaperMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        List<String> papers = List.of(
                "THERMAL_58", "THERMAL_80", "LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40", "LABEL_80_50");
        List<ModelPaperMatrixRow> rows = List.of(
                row("EPSON", "EPSON_TM_T88VII", "THERMAL_58", "THERMAL_80"),
                row("ZEBRA", "ZEBRA_ZD421D", "LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40", "LABEL_80_50"),
                row("ZEBRA", "ZEBRA_ZD411D", "LABEL_40_30", "LABEL_40_60", "LABEL_50_30", "LABEL_60_40"),
                row("GENERIC", "GENERIC_THERMAL_58", "THERMAL_58"),
                row("GENERIC", "GENERIC_THERMAL_80", "THERMAL_80"),
                row("GENERIC", "GENERIC_LABEL_40_30", "LABEL_40_30"),
                row("GENERIC", "GENERIC_LABEL_40_60", "LABEL_40_60"),
                row("GENERIC", "GENERIC_LABEL_50_30", "LABEL_50_30"),
                row("GENERIC", "GENERIC_LABEL_60_40", "LABEL_60_40"),
                row("GENERIC", "GENERIC_LABEL_80_50", "LABEL_80_50"),
                row("GENERIC", "BUILTIN_THERMAL_58", "THERMAL_58"),
                row("GENERIC", "BUILTIN_THERMAL_80", "THERMAL_80"));
        int index = 0;
        for (ModelPaperMatrixRow row : rows) {
            String initialPaper = row.allowedPapers().iterator().next();
            String connection = row.model().startsWith("BUILTIN") ? "BUILT_IN" : "NETWORK";
            String parameter = row.model().startsWith("BUILTIN") ? null : "192.0.2." + (10 + index);
            UUID terminal = create(
                    context,
                    store,
                    "型号纸型矩阵 " + index,
                    "3100" + String.format("%04d", 300 + index++),
                    configurationWithPrinterScene(
                            "KITCHEN_PRINT",
                            sceneForPaper(initialPaper),
                            row.brand(),
                            row.model(),
                            initialPaper,
                            connection,
                            parameter));
            JsonNode initial = readDetail(context, store, terminal);
            String printerRef = initial.at("/configuration/printers/0/ref").asText();
            String functionRef = initial.at("/configuration/functions/0/ref").asText();
            for (String paper : papers) {
                boolean allowed = row.allowedPapers().contains(paper);
                JsonNode before = readDetail(context, store, terminal);
                Map<String, Object> replacement = configurationWithPrinterAndFunctionRefs(
                        printerRef, functionRef, row.brand(), row.model(), paper, connection, parameter);
                BackendAcceptanceTest.Response response = context.put(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_UPDATE,
                        terminalPath(store.fixture(), terminal),
                        store.session().cookie(),
                        replaceBody(
                                "型号纸型矩阵 " + (index - 1), before.path("version").asLong(), replacement),
                        idempotency(),
                        allowed ? OK : CLIENT_FAILURE);
                JsonNode after = readDetail(context, store, terminal);
                if (allowed) {
                    assertEquals(
                            paper,
                            after.at("/configuration/printers/0/paperSpecKey").asText());
                } else {
                    assertProblem(response, "STORE_TERMINAL_RULE_INVALID");
                    assertEquals(
                            before.path("version").asLong(),
                            after.path("version").asLong());
                    assertEquals(
                            before.at("/configuration/printers/0/paperSpecKey").asText(),
                            after.at("/configuration/printers/0/paperSpecKey").asText());
                }
            }
        }

        BackendAcceptanceTest.Response brandMismatch = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "品牌型号不匹配",
                        "31999991",
                        configurationWithPrinterScene(
                                "KITCHEN_PRINT",
                                "PREPARATION_TICKET",
                                "EPSON",
                                "ZEBRA_ZD421D",
                                "THERMAL_58",
                                "NETWORK",
                                "192.0.2.201")),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(brandMismatch, "STORE_TERMINAL_RULE_INVALID");
        BackendAcceptanceTest.Response unknownModel = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "未登记型号",
                        "31999992",
                        configurationWithPrinterScene(
                                "KITCHEN_PRINT",
                                "PREPARATION_TICKET",
                                "GENERIC",
                                "UNKNOWN_MODEL",
                                "THERMAL_58",
                                "NETWORK",
                                "192.0.2.202")),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(unknownModel, "STORE_TERMINAL_RULE_INVALID");
        BackendAcceptanceTest.Response builtInNetwork = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "内置型号配网口",
                        "31999993",
                        configurationWithPrinterScene(
                                "KITCHEN_PRINT",
                                "PREPARATION_TICKET",
                                "GENERIC",
                                "BUILTIN_THERMAL_58",
                                "THERMAL_58",
                                "NETWORK",
                                "192.0.2.203")),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(builtInNetwork, "STORE_TERMINAL_RULE_INVALID");
        BackendAcceptanceTest.Response genericBuiltIn = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(
                        "通用型号配设备内置",
                        "31999994",
                        configurationWithPrinterScene(
                                "KITCHEN_PRINT",
                                "PREPARATION_TICKET",
                                "GENERIC",
                                "GENERIC_THERMAL_58",
                                "THERMAL_58",
                                "BUILT_IN",
                                null)),
                idempotency(),
                CLIENT_FAILURE);
        assertProblem(genericBuiltIn, "STORE_TERMINAL_RULE_INVALID");
    }

    private UUID create(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, String name, String activationCode)
            throws Exception {
        return create(context, store, name, activationCode, configuration());
    }

    private UUID create(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            String name,
            String activationCode,
            Map<String, Object> configuration)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_CREATE,
                terminalsPath(store.fixture()),
                store.session().cookie(),
                createBody(name, activationCode, configuration),
                idempotency(),
                CREATED);
        return UUID.fromString(response.json().path("terminalRef").asText());
    }

    private JsonNode readDetail(BackendAcceptanceTest.ScenarioContext context, StoreContext store, UUID terminalRef)
            throws Exception {
        return context.get(
                        BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL,
                        terminalPath(store.fixture(), terminalRef),
                        store.session().cookie(),
                        OK)
                .json();
    }

    private long terminalBindingAuditTotal(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, UUID terminalRef) throws Exception {
        return terminalBindingAuditHistory(context, store, terminalRef)
                .path("total")
                .asLong();
    }

    private JsonNode terminalBindingAuditHistory(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, UUID terminalRef) throws Exception {
        return context.get(
                        BackendAcceptanceTest.OPERATIONS_AUDIT_HISTORY,
                        "/api/operations/audit-history?groupWorkspaceKey="
                                + store.fixture().groupWorkspaceKey() + "&entityType=TERMINAL_BINDING&entityId="
                                + terminalRef + "&page=1&pageSize=20",
                        store.session().cookie(),
                        OK)
                .json();
    }

    private static boolean hasTerminalBindingAuditReason(JsonNode history, String actorDisplay, String reason) {
        for (JsonNode item : history.path("items")) {
            String actualActor = item.path("actorDisplayName").asText();
            if (actorDisplay != null && !actorDisplay.equals(actualActor)) continue;
            for (JsonNode change : item.path("changes")) {
                if ("reason".equals(change.path("fieldKey").asText())
                        && reason.equals(change.path("afterValue").asText())) return true;
            }
        }
        return false;
    }

    private void awaitActiveBindingGeneration(StoreContext store, UUID terminalRef, long generation)
            throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        long matches = 0;
        do {
            matches = host.count(
                    "SELECT count(*) FROM terminal_binding.latest_binding "
                            + "WHERE workspace_uuid=? AND group_workspace_key=? AND terminal_ref=? "
                            + "AND generation=? AND binding_status='ACTIVE'",
                    store.fixture().workspaceUuid(),
                    store.fixture().groupWorkspaceKey(),
                    terminalRef,
                    generation);
            if (matches == 1) return;
            Thread.sleep(100);
        } while (System.nanoTime() < deadline);
        assertEquals(1L, matches, "V-B13_FIRST_ACTIVATION_COMMIT_NOT_VISIBLE");
    }

    private long bindingAuditCount(BackendAcceptanceTest.Fixture fixture, UUID terminalRef) {
        return host.count(
                "SELECT count(*) FROM terminal_binding.audit_event "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? "
                        + "AND entity_type='TERMINAL_BINDING' AND entity_ref_text=?",
                fixture.workspaceUuid(),
                fixture.groupWorkspaceKey(),
                terminalRef.toString());
    }

    private void transitionTerminalStatus(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, UUID terminalRef, String targetStatus)
            throws Exception {
        long version = readDetail(context, store, terminalRef).path("version").asLong();
        context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_TERMINAL_STATUS,
                terminalPath(store.fixture(), terminalRef) + "/status",
                store.session().cookie(),
                Map.of("status", targetStatus, "expectedVersion", version),
                idempotency(),
                OK);
    }

    private void assertActivationProblem(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            UUID terminalRef,
            String activationCode,
            String surfaceForm,
            String expectedCode)
            throws Exception {
        JsonNode before = readDetail(context, store, terminalRef);
        long auditBefore = terminalBindingAuditTotal(context, store, terminalRef);
        BackendAcceptanceTest.Response response = activationAttempt(
                context,
                store.fixture().groupWorkspaceKey(),
                activationCode,
                "matrix-negative-device-" + UUID.randomUUID(),
                newCredentialSecret(),
                surfaceForm,
                CLIENT_FAILURE);
        assertProblem(response, expectedCode);
        JsonNode after = readDetail(context, store, terminalRef);
        assertEquals(before.path("version").asLong(), after.path("version").asLong());
        assertEquals(before.path("binding"), after.path("binding"));
        assertEquals(auditBefore, terminalBindingAuditTotal(context, store, terminalRef));
    }

    private BackendAcceptanceTest.Response activationAttempt(
            BackendAcceptanceTest.ScenarioContext context,
            String groupWorkspaceKey,
            String activationCode,
            String deviceId,
            String secret,
            String surfaceForm,
            Set<Integer> expected)
            throws Exception {
        return context.post(
                BackendAcceptanceTest.TERMINAL_ACTIVATION,
                terminalActivationPath(groupWorkspaceKey),
                null,
                activationBody(activationCode, deviceId, secret, surfaceForm),
                Map.of(),
                expected);
    }

    private StoreContext enabledStore(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture base = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Fixture fixture =
                host.storeServicePointFixture(base, Set.of(EDIT, "EDIT_STORE_SERVICE_POINT_QR", "EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        return new StoreContext(fixture, selectStore(context, fixture, host.login(context, fixture)));
    }

    private StoreContext referenceSetupStore(BackendAcceptanceTest.ScenarioContext context, StoreContext terminalStore)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.storeUserFixture(
                terminalStore.fixture(), Set.of("EDIT_STORE_SERVICE_POINT_QR", "EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        return new StoreContext(fixture, selectStore(context, fixture, host.login(context, fixture)));
    }

    private static Map<String, Object> createBody(String name, String activationCode) {
        return createBody(name, activationCode, configuration());
    }

    private static Map<String, Object> activationBody(String activationCode, String deviceId, String secret) {
        return activationBody(activationCode, deviceId, secret, "laptop");
    }

    private static Map<String, Object> activationBody(
            String activationCode, String deviceId, String secret, String surfaceForm) {
        return Map.of(
                "activationCode", activationCode,
                "deviceId", deviceId,
                "surfaceForm", surfaceForm,
                "appVersion", "acceptance-test",
                "credentialSecret", secret);
    }

    private static String newCredentialSecret() {
        byte[] secret = new byte[32];
        new SecureRandom().nextBytes(secret);
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        } finally {
            Arrays.fill(secret, (byte) 0);
        }
    }

    private static String terminalCredential(long generation, String secret) {
        return "Terminal " + generation + "." + secret;
    }

    private static Map<String, Object> createBody(
            String name, String activationCode, Map<String, Object> configuration) {
        return createBody(name, activationCode, configuration, "laptop");
    }

    private static Map<String, Object> createBody(
            String name, String activationCode, Map<String, Object> configuration, String deviceType) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("deviceType", deviceType);
        if (activationCode != null) body.put("activationCode", activationCode);
        body.put("configuration", configuration);
        return body;
    }

    private static Map<String, Object> createBodyWithActivationField(
            String name, Object activationCode, Map<String, Object> configuration) {
        Map<String, Object> body = new LinkedHashMap<>(createBody(name, null, configuration));
        body.put("activationCode", activationCode);
        return body;
    }

    private static Map<String, Object> replaceBody(String name, long expectedVersion) {
        return replaceBody(name, expectedVersion, configuration());
    }

    private static Map<String, Object> replaceBody(
            String name, long expectedVersion, Map<String, Object> configuration) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("configuration", configuration);
        body.put("expectedVersion", expectedVersion);
        return body;
    }

    private static Map<String, Object> configuration() {
        return Map.of(
                "printers", java.util.List.of(),
                "functions",
                        java.util.List.of(Map.of(
                                "clientKey",
                                "function-ordering-cashier",
                                "functionKey",
                                "ORDERING_CASHIER",
                                "ranges",
                                java.util.List.of(),
                                "scenes",
                                java.util.List.of())));
    }

    private static Map<String, Object> emptyConfiguration() {
        return Map.of("printers", List.of(), "functions", List.of());
    }

    private static Map<String, Object> configurationFor(String deviceType, String functionKey) {
        Map<String, Object> configuration = configurationWithFunctions(deviceType, List.of(functionKey));
        return configuration;
    }

    private static Map<String, Object> configurationWithFunctions(String deviceType, List<String> functionKeys) {
        List<Map<String, Object>> functions = new ArrayList<>();
        int index = 0;
        for (String functionKey : functionKeys) {
            functions.add(Map.of(
                    "clientKey",
                    "function-" + index++,
                    "functionKey",
                    functionKey,
                    "ranges",
                    List.of(),
                    "scenes",
                    List.of()));
        }
        return Map.of("printers", List.of(), "functions", functions);
    }

    private static Map<String, Object> configurationWithRange(String functionKey, String rangeKey, boolean all) {
        return configurationWithRangeRefs(functionKey, rangeKey, all, List.of());
    }

    private static Map<String, Object> configurationWithRangeRefs(
            String functionKey, String rangeKey, boolean all, List<String> refs) {
        return Map.of(
                "printers", List.of(),
                "functions",
                        List.of(Map.of(
                                "clientKey",
                                "range-function",
                                "functionKey",
                                functionKey,
                                "ranges",
                                List.of(Map.of("key", rangeKey, "all", all, "refs", refs)),
                                "scenes",
                                List.of())));
    }

    private static Map<String, Object> configurationWithExistingFunctionRangeRefs(
            JsonNode detail, String rangeKey, boolean all, List<String> refs) {
        JsonNode function = detail.at("/configuration/functions/0");
        return Map.of(
                "printers", List.of(),
                "functions",
                        List.of(Map.of(
                                "ref", function.path("ref").asText(),
                                "functionKey", function.path("functionKey").asText(),
                                "ranges", List.of(Map.of("key", rangeKey, "all", all, "refs", refs)),
                                "scenes", List.of())));
    }

    private static Map<String, Object> configurationWithScene(String functionKey, String sceneKey) {
        return configurationWithSceneOrderTypes(functionKey, sceneKey, List.of());
    }

    private static Map<String, Object> configurationWithSceneOrderTypes(
            String functionKey, String sceneKey, List<String> orderTypes) {
        return Map.of(
                "printers", List.of(),
                "functions",
                        List.of(Map.of(
                                "clientKey",
                                "scene-function",
                                "functionKey",
                                functionKey,
                                "ranges",
                                List.of(),
                                "scenes",
                                List.of(Map.of(
                                        "sceneKey", sceneKey,
                                        "orderTypes", orderTypes,
                                        "printers", List.of())))));
    }

    private static Map<String, Object> configurationWithPrinter(
            String brand, String model, String paper, String connection, String parameter) {
        return Map.of(
                "printers", List.of(printer("printer-1", "打印机一", brand, model, paper, connection, parameter)),
                "functions",
                        List.of(Map.of(
                                "clientKey",
                                "printer-function",
                                "functionKey",
                                "KITCHEN_PRINT",
                                "ranges",
                                List.of(),
                                "scenes",
                                List.of())));
    }

    private static Map<String, Object> configurationWithPrinterScene(
            String functionKey,
            String sceneKey,
            String brand,
            String model,
            String paper,
            String connection,
            String parameter) {
        return Map.of(
                "printers", List.of(printer("printer-1", "打印机一", brand, model, paper, connection, parameter)),
                "functions",
                        List.of(Map.of(
                                "clientKey",
                                "printer-function",
                                "functionKey",
                                functionKey,
                                "ranges",
                                List.of(),
                                "scenes",
                                List.of(Map.of(
                                        "sceneKey", sceneKey,
                                        "orderTypes", List.of(),
                                        "printers", List.of(Map.of("printerClientKey", "printer-1")))))));
    }

    private static Map<String, Object> configurationWithPrinterAndFunctionRefs(
            String printerRef,
            String functionRef,
            String brand,
            String model,
            String paper,
            String connection,
            String parameter) {
        return configurationWithPrinterAndFunctionRefs(
                printerRef, functionRef, brand, model, paper, connection, parameter, sceneForPaper(paper));
    }

    private static Map<String, Object> configurationWithPrinterAndFunctionRefs(
            String printerRef,
            String functionRef,
            String brand,
            String model,
            String paper,
            String connection,
            String parameter,
            String sceneKey) {
        Map<String, Object> value = new LinkedHashMap<>();
        // spotless:off
        value.put("printers", List.of(printerWithRef(printerRef, "打印机一", brand, model, paper, connection,
            parameter)));
        // spotless:on
        value.put(
                "functions",
                List.of(Map.of(
                        "ref",
                        functionRef,
                        "functionKey",
                        "KITCHEN_PRINT",
                        "ranges",
                        List.of(),
                        "scenes",
                        List.of(Map.of(
                                "sceneKey", sceneKey,
                                "orderTypes", List.of(),
                                "printers", List.of(Map.of("printerRef", printerRef)))))));
        return value;
    }

    private static Map<String, Object> configurationWithThreePrinterScene() {
        List<Map<String, Object>> printers = List.of(
                printer("printer-1", "打印机一", "EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", "192.0.2.41"),
                printer("printer-2", "打印机二", "EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK", "192.0.2.42"),
                // spotless:off
                printer("printer-3", "打印机三", "EPSON", "EPSON_TM_T88VII", "THERMAL_58", "NETWORK",
                    "192.0.2.43"));
                // spotless:on
        return configurationWithPrinterNodes(
                printers,
                null,
                List.of(
                        Map.of("printerClientKey", "printer-2"),
                        Map.of("printerClientKey", "printer-1"),
                        Map.of("printerClientKey", "printer-3")));
    }

    private static Map<String, Object> configurationWithPrinterRefs(JsonNode detail, List<String> printerRefs) {
        List<Map<String, Object>> printers = new ArrayList<>();
        for (JsonNode value : detail.at("/configuration/printers")) {
            String ref = value.path("ref").asText();
            String parameter = value.path("connectionParameter").isMissingNode()
                            || value.path("connectionParameter").isNull()
                    ? null
                    : value.path("connectionParameter").asText();
            printers.add(printerWithRef(
                    ref,
                    value.path("name").asText(),
                    value.path("brandKey").asText(),
                    value.path("modelKey").asText(),
                    value.path("paperSpecKey").asText(),
                    value.path("connectionMethodKey").asText(),
                    parameter));
        }
        return configurationWithPrinterNodes(
                printers,
                detail.at("/configuration/functions/0/ref").asText(),
                printerRefs.stream()
                        .map(ref -> Map.<String, Object>of("printerRef", ref))
                        .toList());
    }

    private static Map<String, Object> configurationWithPrinterRefsAndNewPrinter(JsonNode detail) {
        List<Map<String, Object>> printers = new ArrayList<>();
        for (JsonNode value : detail.at("/configuration/printers")) {
            String parameter = value.path("connectionParameter").isMissingNode()
                            || value.path("connectionParameter").isNull()
                    ? null
                    : value.path("connectionParameter").asText();
            printers.add(printerWithRef(
                    value.path("ref").asText(),
                    value.path("name").asText(),
                    value.path("brandKey").asText(),
                    value.path("modelKey").asText(),
                    value.path("paperSpecKey").asText(),
                    value.path("connectionMethodKey").asText(),
                    parameter));
        }
        printers.add(printer(
                // spotless:off
                "printer-new", "新增打印机", "GENERIC", "GENERIC_THERMAL_58", "THERMAL_58", "NETWORK",
                    "192.0.2.99"));
                // spotless:on
        List<Map<String, Object>> bindings = new ArrayList<>();
        detail.at("/configuration/functions/0/scenes/0/printers").forEach(value -> {
            if (value.has("printerRef"))
                bindings.add(Map.of("printerRef", value.path("printerRef").asText()));
            else
                bindings.add(Map.of(
                        "printerClientKey", value.path("printerClientKey").asText()));
        });
        bindings.add(Map.of("printerClientKey", "printer-new"));
        return configurationWithPrinterNodes(
                printers, detail.at("/configuration/functions/0/ref").asText(), bindings);
    }

    private static Map<String, Object> configurationWithPrinterNodes(
            List<Map<String, Object>> printers, String functionRef, List<Map<String, Object>> bindings) {
        Map<String, Object> function = new LinkedHashMap<>();
        if (functionRef != null) function.put("ref", functionRef);
        else function.put("clientKey", "printer-function");
        function.put("functionKey", "KITCHEN_PRINT");
        function.put("ranges", List.of());
        Map<String, Object> scene = new LinkedHashMap<>();
        scene.put("sceneKey", "PREPARATION_TICKET");
        scene.put("orderTypes", List.of());
        scene.put("printers", bindings == null ? List.of() : bindings);
        function.put("scenes", List.of(scene));
        return Map.of("printers", printers, "functions", List.of(function));
    }

    private static Map<String, Object> printerWithRef(
            String ref, String name, String brand, String model, String paper, String connection, String parameter) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("ref", ref);
        value.put("name", name);
        value.put("brandKey", brand);
        value.put("modelKey", model);
        value.put("paperSpecKey", paper);
        value.put("connectionMethodKey", connection);
        if (parameter != null) value.put("connectionParameter", parameter);
        return value;
    }

    private static String sceneForPaper(String paper) {
        return paper.startsWith("LABEL") ? "LABEL_PREPARATION_TICKET" : "PREPARATION_TICKET";
    }

    private static String genericModelForPaper(String paper) {
        return switch (paper) {
            case "THERMAL_58" -> "GENERIC_THERMAL_58";
            case "THERMAL_80" -> "GENERIC_THERMAL_80";
            case "LABEL_40_30" -> "GENERIC_LABEL_40_30";
            case "LABEL_40_60" -> "GENERIC_LABEL_40_60";
            case "LABEL_50_30" -> "GENERIC_LABEL_50_30";
            case "LABEL_60_40" -> "GENERIC_LABEL_60_40";
            case "LABEL_80_50" -> "GENERIC_LABEL_80_50";
            default -> throw new IllegalArgumentException("unsupported paper " + paper);
        };
    }

    private static Map<String, Object> configurationWithTwoPrinterScene() {
        return Map.of(
                "printers",
                        List.of(
                                printer(
                                        "printer-1",
                                        "打印机一",
                                        "EPSON",
                                        "EPSON_TM_T88VII",
                                        "THERMAL_58",
                                        "NETWORK",
                                        "192.0.2.41"),
                                printer(
                                        "printer-2",
                                        "打印机二",
                                        "EPSON",
                                        "EPSON_TM_T88VII",
                                        "THERMAL_58",
                                        "NETWORK",
                                        "192.0.2.42")),
                "functions",
                        List.of(Map.of(
                                "clientKey",
                                "printer-function",
                                "functionKey",
                                "KITCHEN_PRINT",
                                "ranges",
                                List.of(),
                                "scenes",
                                List.of(Map.of(
                                        "sceneKey", "PREPARATION_TICKET",
                                        "orderTypes", List.of(),
                                        "printers",
                                                List.of(
                                                        Map.of("printerClientKey", "printer-1"),
                                                        Map.of("printerClientKey", "printer-2")))))));
    }

    private static Map<String, Object> printer(
            String clientKey,
            String name,
            String brand,
            String model,
            String paper,
            String connection,
            String parameter) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("clientKey", clientKey);
        value.put("name", name);
        value.put("brandKey", brand);
        value.put("modelKey", model);
        value.put("paperSpecKey", paper);
        value.put("connectionMethodKey", connection);
        if (parameter != null) value.put("connectionParameter", parameter);
        return value;
    }

    private static Map<String, Object> configurationFromExistingFunction(JsonNode function) {
        return Map.of(
                "printers", List.of(),
                "functions",
                        List.of(Map.of(
                                "ref", function.path("ref").asText(),
                                "functionKey", function.path("functionKey").asText(),
                                "ranges", List.of(),
                                "scenes", List.of())));
    }

    private AreaRef createArea(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            String areaType,
            String name,
            String code)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_SERVICE_POINT_AREA_CREATE,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/stores/"
                        + store.fixture().storeId() + "/service-point-areas",
                store.session().cookie(),
                Map.of("name", name, "code", code, "areaType", areaType),
                idempotency(),
                CREATED);
        JsonNode json = response.json();
        return new AreaRef(
                UUID.fromString(json.path("areaRef").asText()),
                json.path("version").asLong(),
                code);
    }

    private AreaRef updateArea(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            AreaRef area,
            String name,
            String code,
            String areaType,
            String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.patch(
                BackendAcceptanceTest.OPERATIONS_STORE_SERVICE_POINT_AREA_UPDATE,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/stores/"
                        + store.fixture().storeId() + "/service-point-areas/" + area.ref(),
                store.session().cookie(),
                Map.of(
                        "name",
                        name,
                        "code",
                        code,
                        "areaType",
                        areaType,
                        "status",
                        status,
                        "expectedVersion",
                        area.version()),
                idempotency(),
                OK);
        JsonNode json = response.json();
        return new AreaRef(
                UUID.fromString(json.path("areaRef").asText()),
                json.path("version").asLong(),
                code);
    }

    private AreaRef transitionArea(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaRef area, String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                BackendAcceptanceTest.OPERATIONS_STORE_SERVICE_POINT_AREA_STATUS,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey() + "/stores/"
                        + store.fixture().storeId() + "/service-point-areas/" + area.ref() + "/status",
                store.session().cookie(),
                Map.of("status", status, "expectedVersion", area.version()),
                idempotency(),
                OK);
        JsonNode json = response.json();
        return new AreaRef(
                UUID.fromString(json.path("areaRef").asText()),
                json.path("version").asLong(),
                area.code());
    }

    private TagRef createTag(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, String code, String name)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                BackendAcceptanceTest.OPERATIONS_PRODUCTION_TAG_CREATE,
                "/api/operations/catalog-inventory/production-tags",
                store.session().cookie(),
                Map.of("dataNodeRef", store.fixture().storeId().toString(), "code", code, "name", name),
                idempotency(),
                OK);
        JsonNode result = response.json().path("result");
        return new TagRef(
                UUID.fromString(result.path("tagRef").asText()),
                code,
                result.path("version").asLong(1));
    }

    private TagRef transitionTag(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, TagRef tag, String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                BackendAcceptanceTest.OPERATIONS_PRODUCTION_TAG_STATUS,
                "/api/operations/catalog-inventory/production-tags/" + tag.code() + "/status",
                store.session().cookie(),
                Map.of(
                        "dataNodeRef",
                        store.fixture().storeId().toString(),
                        "tagCode",
                        tag.code(),
                        "expectedVersion",
                        tag.version(),
                        "targetStatus",
                        status),
                idempotency(),
                OK);
        return new TagRef(
                tag.ref(),
                tag.code(),
                response.json().path("result").path("version").asLong(tag.version() + 1));
    }

    private static List<String> textArray(JsonNode values) {
        List<String> result = new ArrayList<>();
        values.forEach(value -> result.add(value.asText()));
        return result;
    }

    private static List<String> textFieldArray(JsonNode values, String field) {
        List<String> result = new ArrayList<>();
        values.forEach(value -> result.add(value.path(field).asText()));
        return result;
    }

    private static void assertProblem(BackendAcceptanceTest.Response response, String expected) {
        assertEquals(
                expected,
                response.problemCode(),
                "BUSINESS: typed store-terminal problem code; status=" + response.status() + ", body="
                        + response.json());
    }

    private static void assertProblemOneOf(BackendAcceptanceTest.Response response, String... expected) {
        assertTrue(
                Set.of(expected).contains(response.problemCode()),
                "BUSINESS: expected one of " + Set.of(expected) + ", actual=" + response.problemCode() + "; status="
                        + response.status() + ", body=" + response.json());
    }

    private static Map<String, String> idempotency() {
        return idempotency("acceptance-store-terminal-" + UUID.randomUUID());
    }

    private static Map<String, String> idempotency(String key) {
        return Map.of("Idempotency-Key", key);
    }

    private static BackendAcceptanceTest.Session selectStore(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session)
            throws Exception {
        BackendAcceptanceTest.Response selected = context.post(
                BackendAcceptanceTest.OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/session/data-node",
                session.cookie(),
                Map.of(
                        "dataNodeRef", fixture.storeId(),
                        "dataNodeType", "STORE",
                        "requiredContextVersion", session.contextVersion()),
                OK);
        assertEquals(
                fixture.storeId().toString(),
                selected.json()
                        .path("scopeContext")
                        .path("store")
                        .path("dataNodeRef")
                        .asText());
        return new BackendAcceptanceTest.Session(
                session.cookie(),
                selected.json(),
                selected.json().path("contextVersion").asLong());
    }

    private static String terminalsPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/terminals";
    }

    private static String terminalPath(BackendAcceptanceTest.Fixture fixture, UUID terminalRef) {
        return terminalsPath(fixture) + "/" + terminalRef;
    }

    private static String terminalActivationPath(BackendAcceptanceTest.Fixture fixture) {
        return terminalActivationPath(fixture.groupWorkspaceKey());
    }

    private static String terminalActivationPath(String groupWorkspaceKey) {
        return "/api/terminal/group-workspaces/" + groupWorkspaceKey + "/activation";
    }

    private static String terminalActivationCancelPath(BackendAcceptanceTest.Fixture fixture, UUID terminalRef) {
        return "/api/terminal/group-workspaces/" + fixture.groupWorkspaceKey() + "/terminals/" + terminalRef
                + "/activation/cancel";
    }

    private static String operationsTerminalActivationCancelPath(
            BackendAcceptanceTest.Fixture fixture, UUID terminalRef) {
        return terminalsPath(fixture) + "/" + terminalRef + "/activation/cancel";
    }

    private record StoreContext(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}

    private static ModelPaperMatrixRow row(String brand, String model, String... allowedPapers) {
        return new ModelPaperMatrixRow(brand, model, Set.of(allowedPapers));
    }

    private record ModelPaperMatrixRow(String brand, String model, Set<String> allowedPapers) {}

    private record AreaRef(UUID ref, long version, String code) {}

    private record TagRef(UUID ref, String code, long version) {}

    private record SceneCase(String functionKey, String sceneKey) {}

    private record ConnectionCase(String method, String model, String parameter) {}
}
