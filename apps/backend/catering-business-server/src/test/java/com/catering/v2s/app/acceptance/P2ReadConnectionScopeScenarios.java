package com.catering.v2s.app.acceptance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * CP-09 only: real HTTP recipes used to exercise the current P2 read-scope closed set. This class is not registered in
 * the business scenario catalog and therefore does not change the 80-scenario business denominator.
 */
final class P2ReadConnectionScopeScenarios {
    private static BackendAcceptanceTest.RouteIdentity route(String operationId, String logicalTemplate) {
        return new BackendAcceptanceTest.RouteIdentity(operationId, "/api" + logicalTemplate);
    }

    private static final BackendAcceptanceTest.RouteIdentity WORKBENCH_CONTEXT =
            route("getOperationsCatalogWorkbenchContext", "/operations/catalog-inventory/workbench/context");
    private static final BackendAcceptanceTest.RouteIdentity CATEGORY_CREATE =
            route("createOperationsCatalogCategory", "/operations/catalog-inventory/categories");
    private static final BackendAcceptanceTest.RouteIdentity CATEGORY_UPDATE =
            route("updateOperationsCatalogCategory", "/operations/catalog-inventory/categories/{categoryRef}");
    private static final BackendAcceptanceTest.RouteIdentity CATEGORY_MOVE =
            route("moveOperationsCatalogCategory", "/operations/catalog-inventory/categories/{categoryRef}/move");
    private static final BackendAcceptanceTest.RouteIdentity DICTIONARY_READ =
            route("getOperationsCatalogDictionary", "/operations/catalog-inventory/dictionaries/{dictionaryKind}");
    private static final BackendAcceptanceTest.RouteIdentity DICTIONARY_REORDER = route(
            "reorderOperationsCatalogDictionaryEntry",
            "/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/reorder");
    private static final BackendAcceptanceTest.RouteIdentity UNIT_DELETE =
            route("deleteOperationsCatalogUnit", "/operations/catalog-inventory/units/{unitRef}");
    private static final BackendAcceptanceTest.RouteIdentity ITEM_PREFLIGHT = route(
            "preflightOperationsTemporaryCatalogItemPromotion",
            "/operations/catalog-inventory/items/{itemCode}/temporary-promotion/preflight");
    private static final BackendAcceptanceTest.RouteIdentity ITEM_EXECUTE = route(
            "executeOperationsTemporaryCatalogItemPromotion",
            "/operations/catalog-inventory/items/{itemCode}/temporary-promotion/execute");
    private static final BackendAcceptanceTest.RouteIdentity INVENTORY_INCREASE = route(
            "increaseOperationsInventoryTarget",
            "/operations/catalog-inventory/inventory-targets/{targetRef}/increase");
    private static final BackendAcceptanceTest.RouteIdentity INVENTORY_ADJUST = route(
            "adjustOperationsInventoryTarget", "/operations/catalog-inventory/inventory-targets/{targetRef}/adjust");
    private static final BackendAcceptanceTest.RouteIdentity INVENTORY_CHANGES = route(
            "getOperationsInventoryTargetChangeSummary",
            "/operations/catalog-inventory/inventory-targets/{targetRef}/changes");
    private static final BackendAcceptanceTest.RouteIdentity INVENTORY_HISTORY = route(
            "getOperationsInventoryTargetBusinessHistory",
            "/operations/catalog-inventory/inventory-targets/{targetRef}/business-history");
    private static final BackendAcceptanceTest.RouteIdentity INVENTORY_DIAGNOSTICS = route(
            "getOperationsInventoryTargetDiagnostics",
            "/operations/catalog-inventory/inventory-targets/{targetRef}/diagnostics");
    private static final BackendAcceptanceTest.RouteIdentity PRODUCTION_TAGS =
            route("getOperationsProductionTags", "/operations/catalog-inventory/production-tags");
    private static final BackendAcceptanceTest.RouteIdentity PRODUCTION_TAG_UPDATE =
            route("updateOperationsProductionTag", "/operations/catalog-inventory/production-tags/{tagCode}");
    private static final BackendAcceptanceTest.RouteIdentity PRODUCTION_TAG_STATUS = route(
            "transitionOperationsProductionTagStatus",
            "/operations/catalog-inventory/production-tags/{tagCode}/status");

    private static final Set<Integer> PROBE_STATUSES = Set.of(200, 201, 204, 400, 401, 403, 404, 409, 422, 429);

    private P2ReadConnectionScopeScenarios() {}

    static void run(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context) throws Exception {
        catalogInventory(host, context);
        iamAndPlatform(host, context);
    }

    private static void catalogInventory(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture =
                host.fixture("STORE", Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_INVENTORY"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String dataNodeRef = fixture.storeId().toString();
        String root = "/api/operations/catalog-inventory";

        BackendAcceptanceTest.Response workbench = context.get(
                WORKBENCH_CONTEXT,
                root + "/workbench/context?dataNodeRef=" + dataNodeRef,
                session.cookie(),
                Set.of(200));
        assertTrue(workbench.json().isObject(), "BUSINESS: workbench context returns an owner readback object");

        Map<String, Object> categoryABody = new LinkedHashMap<>();
        categoryABody.put("dataNodeRef", dataNodeRef);
        categoryABody.put("code", "CAL-CATEGORY-A-" + suffix);
        categoryABody.put("name", "Calibration A");
        categoryABody.put("parentCategoryRef", null);
        BackendAcceptanceTest.Response categoryA =
                context.post(CATEGORY_CREATE, root + "/categories", session.cookie(), categoryABody, Set.of(200));
        JsonNode categoryAResult = categoryA.json().path("result");
        String categoryARef = categoryAResult.path("categoryRef").asText();
        long categoryAVersion = categoryAResult.path("version").asLong();
        assertFalse(categoryARef.isBlank(), "BUSINESS: calibration category has an opaque owner reference");

        BackendAcceptanceTest.Response updatedCategory = context.patch(
                CATEGORY_UPDATE,
                root + "/categories/" + categoryARef,
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "categoryRef", categoryARef,
                        "expectedVersion", categoryAVersion,
                        "name", "Calibration A Updated"),
                Map.of("Idempotency-Key", "calibration-category-update-" + suffix),
                Set.of(200));
        assertEquals(
                "Calibration A Updated",
                updatedCategory.json().path("result").path("name").asText(),
                "BUSINESS: category update reads back the changed owner name");

        Map<String, Object> categoryBBody = new LinkedHashMap<>();
        categoryBBody.put("dataNodeRef", dataNodeRef);
        categoryBBody.put("code", "CAL-CATEGORY-B-" + suffix);
        categoryBBody.put("name", "Calibration B");
        categoryBBody.put("parentCategoryRef", null);
        BackendAcceptanceTest.Response categoryB =
                context.post(CATEGORY_CREATE, root + "/categories", session.cookie(), categoryBBody, Set.of(200));
        JsonNode categoryBResult = categoryB.json().path("result");
        String categoryBRef = categoryBResult.path("categoryRef").asText();
        BackendAcceptanceTest.Response movedCategory = context.post(
                CATEGORY_MOVE,
                root + "/categories/" + categoryARef + "/move",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "categoryRef", categoryARef,
                        "expectedVersion",
                                updatedCategory
                                        .json()
                                        .path("result")
                                        .path("version")
                                        .asLong(),
                        "action", "REPARENT",
                        "parentCategoryRef", categoryBRef),
                Map.of("Idempotency-Key", "calibration-category-move-" + suffix),
                Set.of(200));
        assertEquals(
                categoryBRef,
                movedCategory.json().path("result").path("parentCategoryRef").asText(),
                "BUSINESS: category move reads back the new parent");

        JsonNode firstEntry = new CatalogAcceptanceScenarios(host)
                .calibrationCreateDictionaryEntry(
                        context, fixture, session, "TAG", "CAL-TAG-A-" + suffix, "Calibration tag A");
        JsonNode secondEntry = new CatalogAcceptanceScenarios(host)
                .calibrationCreateDictionaryEntry(
                        context, fixture, session, "TAG", "CAL-TAG-B-" + suffix, "Calibration tag B");
        BackendAcceptanceTest.Response reordered = context.post(
                DICTIONARY_REORDER,
                root + "/dictionaries/TAG/entries/reorder",
                session.cookie(),
                Map.of(
                        "dictionaryKind",
                        "TAG",
                        "orderedCodes",
                        List.of(
                                secondEntry.path("code").asText(),
                                firstEntry.path("code").asText()),
                        "dataNodeRef",
                        dataNodeRef),
                Map.of("Idempotency-Key", "calibration-dictionary-reorder-" + suffix),
                Set.of(200));
        JsonNode dictionary = context.get(
                        DICTIONARY_READ,
                        root + "/dictionaries/TAG?dataNodeRef=" + dataNodeRef,
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("entries");
        String firstCode = firstEntry.path("code").asText();
        String secondCode = secondEntry.path("code").asText();
        int firstPosition = dictionaryPosition(dictionary, firstCode);
        int secondPosition = dictionaryPosition(dictionary, secondCode);
        assertTrue(
                firstPosition >= 0 && secondPosition >= 0,
                "BUSINESS: dictionary reorder readback contains both requested entries");

        JsonNode disposableUnit = new CatalogAcceptanceScenarios(host)
                .calibrationCreateUnit(
                        context, fixture, session, "CAL-DELETE-UNIT-" + suffix, "Calibration delete unit", "COUNT", 0);
        JsonNode disposableUnitReadback = disposableUnit.path("result").path("unit");
        String disposableUnitRef = disposableUnitReadback.path("unitRef").asText();
        BackendAcceptanceTest.Response deletedUnit = context.delete(
                UNIT_DELETE,
                root + "/units/" + disposableUnitRef,
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "unitRef",
                        disposableUnitRef,
                        "expectedVersion",
                        disposableUnitReadback.path("version").asLong()),
                Set.of(200));
        assertEquals(
                disposableUnitRef,
                deletedUnit.json().path("result").path("unitRef").asText(),
                "BUSINESS: an unreferenced unit is deleted by the catalog owner");

        JsonNode material = new CatalogAcceptanceScenarios(host)
                .calibrationCreateInventoryMaterial(context, fixture, session, "calibration-inventory-" + suffix);
        String targetRef = CatalogAcceptanceScenarios.calibrationInventoryTargetRef(material);
        BackendAcceptanceTest.Response currentTarget = context.get(
                route("getOperationsInventoryTarget", "/operations/catalog-inventory/inventory-targets/{targetRef}"),
                root + "/inventory-targets/" + targetRef + "?dataNodeRef=" + dataNodeRef,
                session.cookie(),
                Set.of(200));
        long targetVersion = currentTarget.json().path("version").asLong();
        BackendAcceptanceTest.Response increased = context.post(
                INVENTORY_INCREASE,
                root + "/inventory-targets/" + targetRef + "/increase",
                session.cookie(),
                Map.of(
                        "dataNodeRef",
                        dataNodeRef,
                        "targetRef",
                        targetRef,
                        "expectedVersion",
                        targetVersion,
                        "quantity",
                        "2",
                        "note",
                        "calibration increase"),
                Map.of("Idempotency-Key", "calibration-inventory-increase-" + suffix),
                Set.of(200));
        assertEquals(
                "2",
                increased.json().path("result").path("change").asText(),
                "BUSINESS: inventory increase reports the applied consumption-unit delta");
        long increasedVersion = increased.json().path("result").path("version").asLong();
        BackendAcceptanceTest.Response adjusted = context.post(
                INVENTORY_ADJUST,
                root + "/inventory-targets/" + targetRef + "/adjust",
                session.cookie(),
                Map.of(
                        "dataNodeRef", dataNodeRef,
                        "targetRef", targetRef,
                        "expectedVersion", increasedVersion,
                        "direction", "DECREASE",
                        "quantity", "1",
                        "reasonCode", "CORRECTION",
                        "note", "calibration adjust"),
                Map.of("Idempotency-Key", "calibration-inventory-adjust-" + suffix),
                Set.of(200));
        assertEquals(
                "-1",
                adjusted.json().path("result").path("change").asText(),
                "BUSINESS: inventory adjustment reports a signed owner delta");
        String period = "30D";
        assertTrue(
                context.get(
                                INVENTORY_CHANGES,
                                root + "/inventory-targets/" + targetRef + "/changes?dataNodeRef=" + dataNodeRef
                                        + "&period=" + period,
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("entryCount")
                        .isInt(),
                "BUSINESS: inventory change summary returns a typed period aggregate");
        assertTrue(
                context.get(
                                INVENTORY_HISTORY,
                                root + "/inventory-targets/" + targetRef + "/business-history?dataNodeRef="
                                        + dataNodeRef + "&pageSize=20",
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("entries")
                        .isArray(),
                "BUSINESS: inventory business history returns ledger-backed entries");
        assertTrue(
                context.get(
                                INVENTORY_DIAGNOSTICS,
                                root + "/inventory-targets/" + targetRef + "/diagnostics?dataNodeRef=" + dataNodeRef,
                                session.cookie(),
                                Set.of(200))
                        .json()
                        .path("queries")
                        .isArray(),
                "BUSINESS: inventory diagnostics returns a typed query observation list");

        String itemCode = "CAL-NORMAL-PROMOTION-" + suffix;
        JsonNode normalItem = new CatalogAcceptanceScenarios(host)
                .calibrationCreatePlainItem(context, fixture, session, itemCode, "Calibration normal item");
        long itemVersion = normalItem.path("version").asLong();
        String formalCode = "calibration-formal-" + suffix;
        Map<String, Object> promotionRequest = new LinkedHashMap<>();
        promotionRequest.put("itemCode", itemCode);
        promotionRequest.put("formalCode", formalCode);
        promotionRequest.put("shapeKey", "STANDARD_SALE_COUNTED");
        promotionRequest.put("name", "Calibration formal item");
        promotionRequest.put("shortName", "Calibration formal");
        promotionRequest.put("materialRole", "NONE");
        promotionRequest.put("expectedSourceVersion", itemVersion);
        promotionRequest.put("dataNodeRef", dataNodeRef);
        BackendAcceptanceTest.Response preflight = context.post(
                ITEM_PREFLIGHT,
                root + "/items/" + itemCode + "/temporary-promotion/preflight",
                session.cookie(),
                promotionRequest,
                Map.of("Idempotency-Key", "calibration-promotion-preflight-" + suffix),
                Set.of(200));
        assertFalse(
                preflight.json().path("data").path("canPromote").asBoolean(true),
                "BUSINESS: a normal item is explicitly ineligible for temporary promotion");
        promotionRequest.put("expectedVersion", itemVersion);
        promotionRequest.put(
                "preflightDigest",
                preflight.json().path("data").path("preflightDigest").asText());
        BackendAcceptanceTest.Response execute = context.post(
                ITEM_EXECUTE,
                root + "/items/" + itemCode + "/temporary-promotion/execute",
                session.cookie(),
                promotionRequest,
                Map.of("Idempotency-Key", "calibration-promotion-execute-" + suffix),
                Set.of(422));
        assertEquals(
                "VALIDATION_ERROR",
                execute.problemCode(),
                "BUSINESS: executing a non-temporary promotion is rejected by the typed owner problem");

        String tagCode = "CAL-TAG-" + suffix;
        CatalogAcceptanceScenarios catalog = new CatalogAcceptanceScenarios(host);
        catalog.calibrationCreateProductionTag(context, fixture, session, tagCode, "Calibration tag");
        JsonNode tagRows = context.get(
                        PRODUCTION_TAGS,
                        root + "/production-tags?dataNodeRef=" + dataNodeRef + "&pageSize=100",
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("entries");
        JsonNode tagRow = null;
        for (JsonNode row : tagRows) if (tagCode.equals(row.path("code").asText())) tagRow = row;
        assertNotNull(tagRow, "BUSINESS: calibration production tag is visible in the owner list");
        long tagVersion = tagRow.path("version").asLong();
        BackendAcceptanceTest.Response updatedTag = context.patch(
                PRODUCTION_TAG_UPDATE,
                root + "/production-tags/" + tagCode,
                session.cookie(),
                Map.of(
                        "tagCode",
                        tagCode,
                        "expectedVersion",
                        tagVersion,
                        "tagKind",
                        "PRODUCTION",
                        "name",
                        "Calibration tag updated",
                        "dataNodeRef",
                        dataNodeRef),
                Map.of("Idempotency-Key", "calibration-production-tag-update-" + suffix),
                Set.of(200));
        assertEquals(
                "Calibration tag updated",
                updatedTag.json().path("result").path("name").asText(),
                "BUSINESS: production tag update reads back the changed name");
        BackendAcceptanceTest.Response disabledTag = context.post(
                PRODUCTION_TAG_STATUS,
                root + "/production-tags/" + tagCode + "/status",
                session.cookie(),
                Map.of(
                        "tagCode",
                        tagCode,
                        "expectedVersion",
                        updatedTag.json().path("result").path("version").asLong(),
                        "targetStatus",
                        "DISABLED",
                        "dataNodeRef",
                        dataNodeRef),
                Map.of("Idempotency-Key", "calibration-production-tag-status-" + suffix),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabledTag.json().path("result").path("status").asText(),
                "BUSINESS: production tag status transition is persisted");
    }

    private static void iamAndPlatform(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        workspaceAccess(host, context);
        operationsOrganizationAndContracts(host, context);
        platformAndRecovery(host, context);
    }

    private static void workspaceAccess(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        for (String targetType : List.of("GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE")) {
            String pageKey = "PG-IAM-" + targetType.replace('_', '-') + "-USERS";
            BackendAcceptanceTest.Fixture fixture = host.fixture(targetType, Set.of(pageKey), Set.of());
            host.completeInvitation(context, fixture);
            BackendAcceptanceTest.Session session = host.login(context, fixture);
            UUID targetRef = targetRef(fixture, targetType);
            String label = targetLabel(targetType);
            String slug = targetType.toLowerCase(java.util.Locale.ROOT).replace('_', '-');
            String prefix = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey();
            String scopeQuery = "&scopeRef=" + targetRef;
            String expectedContext = "&expectedContextVersion=" + session.contextVersion();

            context.get(
                    route(
                            "getOperationsWorkspace" + label + "Invitations",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations"),
                    prefix + "/user-management/" + slug + "/invitations?page=1&pageSize=20" + expectedContext
                            + scopeQuery,
                    session.cookie(),
                    PROBE_STATUSES);
            context.get(
                    route(
                            "getOperationsWorkspace" + label + "InvitationCandidates",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations/candidates"),
                    prefix + "/user-management/" + slug + "/invitations/candidates"
                            + "?subjectType=ORGANIZATION&candidateUsage=LIST_FILTER&page=1&pageSize=20"
                            + expectedContext + scopeQuery,
                    session.cookie(),
                    PROBE_STATUSES);

            BackendAcceptanceTest.Response userPage = context.get(
                    route(
                            "getOperationsWorkspace" + label + "User",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug + "/user"),
                    prefix + "/user-management/" + slug + "/user?page=1&pageSize=20" + expectedContext + scopeQuery,
                    session.cookie(),
                    PROBE_STATUSES);
            JsonNode user = userPage.status() == 200
                            && userPage.json().path("items").isArray()
                            && userPage.json().path("items").size() > 0
                    ? userPage.json().path("items").get(0)
                    : null;
            if (user != null && user.path("accountId").isTextual()) {
                String accountId = user.path("accountId").asText();
                context.get(
                        route(
                                "getOperationsWorkspace" + label + "UserAccount",
                                "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                        + "/user/accounts/{accountId}"),
                        prefix + "/user-management/" + slug + "/user/accounts/" + accountId + "?expectedContextVersion="
                                + session.contextVersion(),
                        session.cookie(),
                        PROBE_STATUSES);
                JsonNode assignment = user.path("assignments").isArray()
                                && user.path("assignments").size() > 0
                        ? user.path("assignments").get(0)
                        : null;
                if (assignment != null && assignment.path("id").isTextual()) {
                    String assignmentId = assignment.path("id").asText();
                    context.post(
                            route(
                                    "selectOperationsWorkspaceSessionContext",
                                    "/operations/group-workspaces/{groupWorkspaceKey}/session/context"),
                            prefix + "/session/context",
                            session.cookie(),
                            Map.of(
                                    "roleAssignmentRef",
                                    assignmentId,
                                    "requiredContextVersion",
                                    session.contextVersion()),
                            headers("calibration-session-context-" + UUID.randomUUID()),
                            PROBE_STATUSES);
                    context.post(
                            route(
                                    "revokeOperationsWorkspace" + label + "UserAssignment",
                                    "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                            + "/user/assignments/{assignmentId}/revoke"),
                            prefix + "/user-management/" + slug + "/user/assignments/" + assignmentId + "/revoke",
                            session.cookie(),
                            Map.of(
                                    "expectedVersion",
                                    assignment.path("revision").asLong()),
                            PROBE_STATUSES);
                }
            }

            List<UUID> roleIds = host.createEnabledRoles(fixture, targetType, 2);
            String createIdempotency = "calibration-operations-invitation-" + UUID.randomUUID();
            Map<String, Object> createBody = new LinkedHashMap<>();
            createBody.put("scopeRef", targetRef.toString());
            createBody.put("mobile", calibrationMobile(targetType + "-a"));
            createBody.put("roleIds", roleIds.stream().map(UUID::toString).toList());
            createBody.put("idempotencyKey", createIdempotency);
            BackendAcceptanceTest.Response firstInvitation = context.post(
                    route(
                            "createOperationsWorkspace" + label + "Invitation",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations"),
                    prefix + "/user-management/" + slug + "/invitations",
                    session.cookie(),
                    createBody,
                    headers(createIdempotency),
                    PROBE_STATUSES);
            String invitationId =
                    firstInvitation.json().path("id").asText(UUID.randomUUID().toString());
            long invitationVersion = firstInvitation.json().path("revision").asLong(1);
            String actionIdempotency = "calibration-operations-invitation-reissue-" + UUID.randomUUID();
            Map<String, Object> actionBody =
                    invitationAction(targetRef, session.contextVersion(), invitationVersion, actionIdempotency);
            BackendAcceptanceTest.Response reissued = context.post(
                    route(
                            "reissueOperationsWorkspace" + label + "Invitation",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations/{invitationId}/reissue"),
                    prefix + "/user-management/" + slug + "/invitations/" + invitationId + "/reissue",
                    session.cookie(),
                    actionBody,
                    headers(actionIdempotency),
                    PROBE_STATUSES);

            String secondIdempotency = "calibration-operations-invitation-second-" + UUID.randomUUID();
            Map<String, Object> secondBody = new LinkedHashMap<>(createBody);
            secondBody.put("mobile", calibrationMobile(targetType + "-b"));
            secondBody.put("idempotencyKey", secondIdempotency);
            BackendAcceptanceTest.Response secondInvitation = context.post(
                    route(
                            "createOperationsWorkspace" + label + "Invitation",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations"),
                    prefix + "/user-management/" + slug + "/invitations",
                    session.cookie(),
                    secondBody,
                    headers(secondIdempotency),
                    PROBE_STATUSES);
            String secondInvitationId =
                    secondInvitation.json().path("id").asText(UUID.randomUUID().toString());
            long secondVersion = secondInvitation.json().path("revision").asLong(1);
            String cancelIdempotency = "calibration-operations-invitation-cancel-" + UUID.randomUUID();
            context.post(
                    route(
                            "cancelOperationsWorkspace" + label + "Invitation",
                            "/operations/group-workspaces/{groupWorkspaceKey}/user-management/" + slug
                                    + "/invitations/{invitationId}/cancel"),
                    prefix + "/user-management/" + slug + "/invitations/" + secondInvitationId + "/cancel",
                    session.cookie(),
                    invitationAction(targetRef, session.contextVersion(), secondVersion, cancelIdempotency),
                    headers(cancelIdempotency),
                    PROBE_STATUSES);
            if (reissued.status() == 200) {
                // The reissue response is intentionally consumed so the recipe remains a real owner readback.
                assertTrue(
                        reissued.json().path("id").isTextual(),
                        "BUSINESS: invitation reissue returns the owner invitation identity");
            }
        }

        BackendAcceptanceTest.Fixture authFixture = host.fixture("STORE", Set.of("PG-IAM-STORE-USERS"), Set.of());
        host.completeInvitation(context, authFixture);
        BackendAcceptanceTest.Session authSession = host.login(context, authFixture);
        String authRoot = "/api/operations/group-workspaces/" + authFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response otp = context.post(
                route("sendOperationsWorkspaceOtp", "/operations/group-workspaces/{groupWorkspaceKey}/otp/send"),
                authRoot + "/otp/send",
                authSession.cookie(),
                Map.of("mobile", authFixture.mobile()),
                headers("calibration-operations-otp-send-" + UUID.randomUUID()),
                Set.of(200));
        String otpCode = otp.json().path("debugVerificationCode").asText("000000");
        context.post(
                route("verifyOperationsWorkspaceOtp", "/operations/group-workspaces/{groupWorkspaceKey}/otp/verify"),
                authRoot + "/otp/verify",
                authSession.cookie(),
                Map.of("mobile", authFixture.mobile(), "code", otpCode),
                headers("calibration-operations-otp-verify-" + UUID.randomUUID()),
                PROBE_STATUSES);
        context.post(
                route(
                        "changeCurrentWorkspacePassword",
                        "/operations/group-workspaces/{groupWorkspaceKey}/session/password"),
                authRoot + "/session/password",
                authSession.cookie(),
                Map.of(
                        "currentPassword", "wrong-calibration-password",
                        "newPassword", "Calibration-New-123!",
                        "expectedSessionVersion", authSession.contextVersion()),
                headers("calibration-workspace-password-" + UUID.randomUUID()),
                PROBE_STATUSES);
        operationsPasswordRecovery(host, context, authFixture);
        BackendAcceptanceTest.Fixture logoutFixture = host.fixture("STORE", Set.of("PG-IAM-STORE-USERS"), Set.of());
        host.completeInvitation(context, logoutFixture);
        BackendAcceptanceTest.Session logoutSession = host.login(context, logoutFixture);
        context.post(
                route("operationsWorkspaceLogout", "/operations/group-workspaces/{groupWorkspaceKey}/logout"),
                "/api/operations/group-workspaces/" + logoutFixture.groupWorkspaceKey() + "/logout",
                logoutSession.cookie(),
                Map.of(),
                headers("calibration-operations-logout-" + UUID.randomUUID()),
                Set.of(204));
    }

    private static void operationsPasswordRecovery(
            BackendAcceptanceTest host,
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture)
            throws Exception {
        String root = "/api/public/operations-workspaces/" + fixture.groupWorkspaceKey() + "/password-recovery";
        String startKey = "calibration-operations-recovery-start-" + UUID.randomUUID();
        BackendAcceptanceTest.Response started = context.post(
                route(
                        "startOperationsPasswordRecovery",
                        "/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/start"),
                root + "/start",
                null,
                Map.of("loginName", fixture.loginName(), "mobile", fixture.mobile()),
                headers(startKey),
                Set.of(200));
        String flowCookie = cookie(started, "V2S_OPERATIONS_RECOVERY_FLOW");
        BackendAcceptanceTest.Response sent = context.post(
                route(
                        "sendOperationsPasswordRecoveryOtp",
                        "/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/send"),
                root + "/otp/send",
                flowCookie,
                Map.of(),
                headers("calibration-operations-recovery-send-" + UUID.randomUUID()),
                Set.of(200));
        String code = sent.json().path("debugVerificationCode").asText();
        assertTrue(code.matches("[0-9]{6}"), "BUSINESS: operations recovery calibration receives a real OTP code");
        BackendAcceptanceTest.Response verified = context.post(
                route(
                        "verifyOperationsPasswordRecoveryOtp",
                        "/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/otp/verify"),
                root + "/otp/verify",
                flowCookie,
                Map.of("code", code),
                headers("calibration-operations-recovery-verify-" + UUID.randomUUID()),
                Set.of(200));
        String grantCookie = cookie(verified, "V2S_OPERATIONS_RECOVERY_GRANT");
        context.post(
                route(
                        "completeOperationsPasswordRecovery",
                        "/public/operations-workspaces/{groupWorkspaceKey}/password-recovery/complete"),
                root + "/complete",
                flowCookie + "; " + grantCookie,
                Map.of("newPassword", "Calibration-Recovered-123!"),
                headers("calibration-operations-recovery-complete-" + UUID.randomUUID()),
                Set.of(200));
    }

    private static void operationsOrganizationAndContracts(
            BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Set<String> organizationCapabilities = Set.of("BC-ORG-BRAND-EDIT", "BC-ORG-TENANT-EDIT", "BC-ORG-GROUP-EDIT");
        BackendAcceptanceTest.Fixture organizationFixture = host.fixture(
                "GROUP", Set.of("PG-ORG-BRAND", "PG-ORG-TENANT", "PG-ORG-STRUCTURE"), organizationCapabilities);
        host.completeInvitation(context, organizationFixture);
        BackendAcceptanceTest.Session organizationSession = host.login(context, organizationFixture);
        String organizationRoot = "/api/operations/group-workspaces/" + organizationFixture.groupWorkspaceKey();
        String contextQuery = "?expectedContextVersion=" + organizationSession.contextVersion();
        context.get(
                route(
                        "getOperationsOrganizationBrand",
                        "/operations/group-workspaces/{groupWorkspaceKey}/organization/brands/{brandId}"),
                organizationRoot + "/organization/brands/" + organizationFixture.brandId() + contextQuery,
                organizationSession.cookie(),
                Set.of(200));
        context.get(
                route(
                        "getOperationsOrganizationTenant",
                        "/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}"),
                organizationRoot + "/organization/tenants/" + organizationFixture.tenantId() + contextQuery,
                organizationSession.cookie(),
                Set.of(200));
        context.patch(
                BackendAcceptanceTest.OPERATIONS_ORGANIZATION_BRAND_UPDATE,
                organizationRoot + "/organization/brands/" + organizationFixture.brandId(),
                organizationSession.cookie(),
                Map.of(
                        "code", "acceptance-brand",
                        "name", "Calibration Brand Updated",
                        "alias", "CAL-BRAND",
                        "remark", "performance calibration",
                        "expectedVersion", 1,
                        "extensionValues", List.of()),
                headers("calibration-brand-update-" + UUID.randomUUID()),
                PROBE_STATUSES);
        context.patch(
                route(
                        "updateOperationsOrganizationTenant",
                        "/operations/group-workspaces/{groupWorkspaceKey}/organization/tenants/{tenantId}"),
                organizationRoot + "/organization/tenants/" + organizationFixture.tenantId(),
                organizationSession.cookie(),
                Map.of(
                        "code", "acceptance-tenant",
                        "name", "Calibration Tenant Updated",
                        "legalName", "Calibration Tenant Ltd",
                        "unifiedSocialCreditCode", "91310000CALIBRATION",
                        "remark", "performance calibration",
                        "expectedVersion", 1,
                        "extensionValues", List.of()),
                headers("calibration-tenant-update-" + UUID.randomUUID()),
                PROBE_STATUSES);
        context.patch(
                route(
                        "updateOperationsCommercialGroup",
                        "/operations/group-workspaces/{groupWorkspaceKey}/hierarchy/commercial-group"),
                organizationRoot + "/hierarchy/commercial-group",
                organizationSession.cookie(),
                Map.of(
                        "groupCode",
                        "ACCEPTANCE-ROOT",
                        "groupName",
                        "Calibration Commercial Group",
                        "extensionValues",
                        Map.of(),
                        "expectedVersion",
                        1),
                headers("calibration-commercial-group-update-" + UUID.randomUUID()),
                PROBE_STATUSES);

        BackendAcceptanceTest.Fixture headCompanyFixture =
                host.fixture("HEAD_COMPANY", Set.of("PG-ORG-HEAD-COMPANY"), Set.of("BC-ORG-HEAD-COMPANY-EDIT"));
        host.completeInvitation(context, headCompanyFixture);
        BackendAcceptanceTest.Session headCompanySession = host.login(context, headCompanyFixture);
        context.patch(
                route(
                        "updateOperationsOrganizationHeadCompany",
                        "/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}"),
                "/api/operations/group-workspaces/" + headCompanyFixture.groupWorkspaceKey()
                        + "/organization/head-companies/" + headCompanyFixture.headCompanyId(),
                headCompanySession.cookie(),
                Map.of(
                        "code", "acceptance-head-company",
                        "name", "Calibration Head Company",
                        "legalName", "Calibration Head Company Ltd",
                        "unifiedSocialCreditCode", "91310000HEADCAL",
                        "remark", "performance calibration",
                        "expectedVersion", 1,
                        "extensionValues", List.of()),
                headers("calibration-head-company-update-" + UUID.randomUUID()),
                PROBE_STATUSES);

        BackendAcceptanceTest.Fixture contractFixture = host.fixture("PROJECT", Set.of("BC-CONTRACT-CREATE"));
        host.completeInvitation(context, contractFixture);
        BackendAcceptanceTest.Session contractSession = host.login(context, contractFixture);
        String contractRoot = "/api/operations/group-workspaces/" + contractFixture.groupWorkspaceKey();
        context.get(
                route(
                        "getOperationsContractCandidates",
                        "/operations/group-workspaces/{groupWorkspaceKey}/contracts/candidates"),
                contractRoot + "/contracts/candidates?expectedContextVersion=" + contractSession.contextVersion(),
                contractSession.cookie(),
                Set.of(200));
        BackendAcceptanceTest.Fixture storeProfileFixture = host.fixture("STORE", Set.of());
        host.completeInvitation(context, storeProfileFixture);
        BackendAcceptanceTest.Session storeProfileSession = host.login(context, storeProfileFixture);
        String storeProfileRoot = "/api/operations/group-workspaces/" + storeProfileFixture.groupWorkspaceKey();
        context.get(
                route("getOperationsStoreProfile", "/operations/group-workspaces/{groupWorkspaceKey}/store/profile"),
                storeProfileRoot + "/store/profile?expectedContextVersion=" + storeProfileSession.contextVersion(),
                storeProfileSession.cookie(),
                Set.of(200));
        context.get(
                route(
                        "getOperationsFixedStoreContracts",
                        "/operations/group-workspaces/{groupWorkspaceKey}/store/profile/contracts"),
                storeProfileRoot + "/store/profile/contracts?expectedContextVersion="
                        + storeProfileSession.contextVersion() + "&state=CURRENT",
                storeProfileSession.cookie(),
                Set.of(200));
        BackendAcceptanceTest.Response contract = context.post(
                BackendAcceptanceTest.OPERATIONS_CONTRACT_CREATE,
                contractRoot + "/contracts",
                contractSession.cookie(),
                Map.of(
                        "storeId",
                        contractFixture.storeId().toString(),
                        "phaseName",
                        "Opening",
                        "contractNo",
                        "CAL-PERF-" + UUID.randomUUID().toString().substring(0, 8),
                        "effectiveFrom",
                        "2026-01-01",
                        "effectiveTo",
                        "2026-12-31",
                        "note",
                        "performance calibration",
                        "items",
                        List.of(Map.of("code", "CAL-PERF-ITEM", "name", "Calibration item")),
                        "extensionValues",
                        List.of()),
                Set.of(201));

        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String platformRoot = "/api/platform/group-workspaces/" + contractFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response contractPage = context.get(
                route(
                        "getPlatformContractOverviewPage",
                        "/platform/group-workspaces/{groupWorkspaceKey}/contract-overview"),
                platformRoot + "/contract-overview?page=1&pageSize=50",
                platform.cookie(),
                Set.of(200));
        JsonNode contractRows = contractPage.json().path("items");
        String contractId = contractRows.size() > 0
                ? contractRows
                        .get(0)
                        .path("contractRef")
                        .path("id")
                        .asText(contract.json().path("id").asText())
                : contract.json().path("id").asText();
        context.get(
                route(
                        "getPlatformContractOverviewDetail",
                        "/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}"),
                platformRoot + "/contract-overview/" + contractId,
                platform.cookie(),
                PROBE_STATUSES);
        context.get(
                route(
                        "getPlatformOrganizationHierarchyTree",
                        "/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy"),
                "/api/platform/group-workspaces/" + organizationFixture.groupWorkspaceKey()
                        + "/organization-overview/hierarchy",
                platform.cookie(),
                Set.of(200));
        context.get(
                route(
                        "getPlatformOrganizationOverviewDetail",
                        "/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}"),
                "/api/platform/group-workspaces/" + organizationFixture.groupWorkspaceKey()
                        + "/organization-overview/BUSINESS_ENTITY/" + organizationFixture.brandId(),
                platform.cookie(),
                PROBE_STATUSES);

        BackendAcceptanceTest.Fixture channelFixture = host.fixture("STORE", Set.of("BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, channelFixture);
        BackendAcceptanceTest.Session channelSession = host.login(context, channelFixture);
        context.get(
                route("getOperationsExternalCapabilityDictionary", "/operations/external-capability-dictionary"),
                "/api/operations/external-capability-dictionary",
                channelSession.cookie(),
                Set.of(200));
        new BusinessChannelAcceptanceScenarios(host)
                .calibrationUpdateAndDeleteExternalBinding(
                        context, channelFixture, channelSession, "MEITUAN_ISV_B", PROBE_STATUSES);
    }

    private static void platformAndRecovery(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)
            throws Exception {
        host.ensurePlatformAdministrator();
        BackendAcceptanceTest.Session platform = host.platformLogin(context);
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        context.get(
                route("getCurrentPlatformSession", "/platform/auth/session"),
                "/api/platform/auth/session",
                platform.cookie(),
                Set.of(200));
        context.post(
                route("changeCurrentPlatformPassword", "/platform/auth/password"),
                "/api/platform/auth/password",
                platform.cookie(),
                Map.of(
                        "currentPassword", "wrong-calibration-password",
                        "newPassword", "Calibration-Platform-123!",
                        "expectedSessionVersion", platform.contextVersion()),
                headers("calibration-platform-password-" + UUID.randomUUID()),
                PROBE_STATUSES);

        BackendAcceptanceTest.Response adminPage = context.get(
                BackendAcceptanceTest.PLATFORM_ADMIN_PAGE,
                "/api/platform/admin-users?page=1&pageSize=20",
                platform.cookie(),
                Set.of(200));
        JsonNode existingAdmin = adminPage.json().path("items").isArray()
                        && adminPage.json().path("items").size() > 0
                ? adminPage.json().path("items").get(0)
                : null;
        if (existingAdmin != null && existingAdmin.path("id").isTextual()) {
            context.get(
                    route("getPlatformAdminDetail", "/platform/admin-users/{platformAdminId}"),
                    "/api/platform/admin-users/" + existingAdmin.path("id").asText(),
                    platform.cookie(),
                    Set.of(200));
        }

        String adminLogin = "calibration-admin-" + suffix;
        String adminMobile = calibrationMobile("platform-admin-" + suffix);
        String createAdminKey = "calibration-platform-admin-create-" + UUID.randomUUID();
        BackendAcceptanceTest.Response createdAdmin = context.post(
                route("createPlatformAdmin", "/platform/admin-users"),
                "/api/platform/admin-users",
                platform.cookie(),
                Map.of(
                        "loginName", adminLogin,
                        "userName", "Calibration Platform Admin",
                        "mobile", adminMobile,
                        "password", "Calibration-Admin-123!",
                        "idempotencyKey", createAdminKey),
                headers(createAdminKey),
                Set.of(201));
        String adminId = createdAdmin.json().path("id").asText();
        assertTrue(!adminId.isBlank(), "BUSINESS: platform admin create returns an owner id");
        long adminVersion = createdAdmin.json().path("version").asLong(1);

        String profileKey = "calibration-platform-admin-profile-" + UUID.randomUUID();
        BackendAcceptanceTest.Response updatedAdmin = context.patch(
                route("updatePlatformAdminProfile", "/platform/admin-users/{platformAdminId}/profile"),
                "/api/platform/admin-users/" + adminId + "/profile",
                platform.cookie(),
                Map.of(
                        "userName", "Calibration Platform Admin Updated",
                        "mobile", adminMobile,
                        "expectedVersion", adminVersion,
                        "idempotencyKey", profileKey),
                headers(profileKey),
                Set.of(200));
        adminVersion = updatedAdmin.json().path("version").asLong(adminVersion + 1);

        String resetKey = "calibration-platform-admin-reset-" + UUID.randomUUID();
        BackendAcceptanceTest.Response resetAdmin = context.post(
                route("resetPlatformAdminCredential", "/platform/admin-users/{platformAdminId}/credential-reset"),
                "/api/platform/admin-users/" + adminId + "/credential-reset",
                platform.cookie(),
                Map.of(
                        "password", "Calibration-Admin-456!",
                        "expectedVersion", adminVersion,
                        "idempotencyKey", resetKey),
                headers(resetKey),
                Set.of(200));
        adminVersion = resetAdmin.json().path("version").asLong(adminVersion + 1);

        BackendAcceptanceTest.Response loginOtp = context.post(
                route("sendPlatformLoginOtp", "/platform/auth/login-otp/send"),
                "/api/platform/auth/login-otp/send",
                null,
                Map.of("mobile", adminMobile),
                headers("calibration-platform-login-otp-send-" + UUID.randomUUID()),
                Set.of(200));
        String loginOtpCode = loginOtp.json().path("debugVerificationCode").asText();
        assertTrue(loginOtpCode.matches("[0-9]{6}"), "BUSINESS: platform login OTP is delivered by the test transport");
        context.post(
                route("verifyPlatformLoginOtp", "/platform/auth/login-otp/verify"),
                "/api/platform/auth/login-otp/verify",
                null,
                Map.of("mobile", adminMobile, "code", loginOtpCode),
                headers("calibration-platform-login-otp-verify-" + UUID.randomUUID()),
                Set.of(200));

        platformPasswordRecovery(context, adminLogin, adminMobile);

        String adminStatusKey = "calibration-platform-admin-status-" + UUID.randomUUID();
        context.post(
                route("transitionPlatformAdminStatus", "/platform/admin-users/{platformAdminId}/status"),
                "/api/platform/admin-users/" + adminId + "/status",
                platform.cookie(),
                Map.of(
                        "targetStatus", "DISABLED",
                        "expectedVersion", adminVersion,
                        "idempotencyKey", adminStatusKey),
                headers(adminStatusKey),
                PROBE_STATUSES);

        BackendAcceptanceTest.Fixture workspace = host.fixture("GROUP", Set.of(), Set.of());
        String workspaceRoot = "/api/platform/group-workspaces/" + workspace.groupWorkspaceKey();
        BackendAcceptanceTest.Response workspaceDetail = context.get(
                BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_DETAIL, workspaceRoot, platform.cookie(), Set.of(200));
        long workspaceVersion = workspaceDetail.json().path("version").asLong(1);

        String roleKey = "calibration-platform-role-create-" + UUID.randomUUID();
        BackendAcceptanceTest.Response createdRole = context.post(
                route("createWorkspaceRole", "/platform/group-workspaces/{groupWorkspaceKey}/roles"),
                workspaceRoot + "/roles",
                platform.cookie(),
                Map.of(
                        "name", "Calibration Platform Role",
                        "serviceNodeType", "GROUP",
                        "description", "performance calibration",
                        "capabilityKeys", List.of("BC-IAM-GROUP-INVITE"),
                        "pageAccessKeys", List.of("PG-IAM-GROUP-USERS")),
                headers(roleKey),
                Set.of(201));
        String roleId = createdRole.json().path("id").asText();
        long roleVersion = createdRole.json().path("revision").asLong(1);
        context.get(
                route("getWorkspaceRole", "/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}"),
                workspaceRoot + "/roles/" + roleId,
                platform.cookie(),
                Set.of(200));
        String roleUpdateKey = "calibration-platform-role-update-" + UUID.randomUUID();
        BackendAcceptanceTest.Response updatedRole = context.patch(
                route("updateWorkspaceRole", "/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}"),
                workspaceRoot + "/roles/" + roleId,
                platform.cookie(),
                Map.of(
                        "name",
                        "Calibration Platform Role Updated",
                        "description",
                        "performance calibration updated",
                        "capabilityKeys",
                        List.of("BC-IAM-GROUP-INVITE"),
                        "pageAccessKeys",
                        List.of("PG-IAM-GROUP-USERS"),
                        "expectedVersion",
                        roleVersion),
                headers(roleUpdateKey),
                Set.of(200));
        roleVersion = updatedRole.json().path("revision").asLong(roleVersion + 1);
        context.post(
                route(
                        "transitionWorkspaceRoleStatus",
                        "/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status"),
                workspaceRoot + "/roles/" + roleId + "/status",
                platform.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", roleVersion),
                headers("calibration-platform-role-status-" + UUID.randomUUID()),
                PROBE_STATUSES);

        List<UUID> invitationRoles = host.createEnabledRoles(workspace, "GROUP", 1);
        String invitationKey = "calibration-platform-invitation-create-" + UUID.randomUUID();
        BackendAcceptanceTest.Response createdInvitation = context.post(
                route("createWorkspaceInvitation", "/platform/group-workspaces/{groupWorkspaceKey}/invitations"),
                workspaceRoot + "/invitations",
                platform.cookie(),
                Map.of(
                        "mobile", calibrationMobile("platform-invitation-" + suffix),
                        "targetOrganizationType", "GROUP",
                        "targetOrganizationRef", workspace.groupId().toString(),
                        "roleIds", invitationRoles.stream().map(UUID::toString).toList()),
                headers(invitationKey),
                Set.of(201));
        String invitationId = createdInvitation.json().path("id").asText();
        long invitationVersion = createdInvitation.json().path("revision").asLong(1);
        context.get(
                route(
                        "getWorkspaceInvitation",
                        "/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}"),
                workspaceRoot + "/invitations/" + invitationId,
                platform.cookie(),
                Set.of(200));
        BackendAcceptanceTest.Response reissuedInvitation = context.post(
                route(
                        "reissueWorkspaceInvitation",
                        "/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue"),
                workspaceRoot + "/invitations/" + invitationId + "/reissue",
                platform.cookie(),
                Map.of("expectedVersion", invitationVersion),
                headers("calibration-platform-invitation-reissue-" + UUID.randomUUID()),
                PROBE_STATUSES);
        context.post(
                route(
                        "cancelWorkspaceInvitation",
                        "/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel"),
                workspaceRoot + "/invitations/" + invitationId + "/cancel",
                platform.cookie(),
                Map.of(
                        "expectedVersion",
                        reissuedInvitation.json().path("revision").asLong(invitationVersion + 1)),
                headers("calibration-platform-invitation-cancel-" + UUID.randomUUID()),
                PROBE_STATUSES);

        BackendAcceptanceTest.Fixture accountFixture = host.fixture("GROUP", Set.of(), Set.of());
        host.completeInvitation(context, accountFixture);
        String accountRoot = "/api/platform/group-workspaces/" + accountFixture.groupWorkspaceKey();
        BackendAcceptanceTest.Response accountPage = context.get(
                route("getWorkspaceAccounts", "/platform/group-workspaces/{groupWorkspaceKey}/accounts"),
                accountRoot + "/accounts?page=1&pageSize=20",
                platform.cookie(),
                Set.of(200));
        JsonNode account = accountPage.json().path("items").isArray()
                        && accountPage.json().path("items").size() > 0
                ? accountPage.json().path("items").get(0)
                : null;
        if (account != null && account.path("id").isTextual()) {
            String accountId = account.path("id").asText();
            BackendAcceptanceTest.Response accountDetail = context.get(
                    route("getWorkspaceAccount", "/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}"),
                    accountRoot + "/accounts/" + accountId,
                    platform.cookie(),
                    Set.of(200));
            long accountVersion = accountDetail
                    .json()
                    .path("revision")
                    .asLong(account.path("revision").asLong(1));
            context.post(
                    route(
                            "requestWorkspaceCredentialReset",
                            "/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset"),
                    accountRoot + "/accounts/" + accountId + "/credential-reset",
                    platform.cookie(),
                    Map.of("expectedVersion", accountVersion),
                    headers("calibration-platform-account-reset-" + UUID.randomUUID()),
                    PROBE_STATUSES);
            context.post(
                    route(
                            "transitionWorkspaceAccountStatus",
                            "/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status"),
                    accountRoot + "/accounts/" + accountId + "/status",
                    platform.cookie(),
                    Map.of("targetStatus", "DISABLED", "expectedVersion", accountVersion),
                    headers("calibration-platform-account-status-" + UUID.randomUUID()),
                    PROBE_STATUSES);
            JsonNode assignments = accountDetail.json().path("assignments");
            if (assignments.isArray()
                    && assignments.size() > 0
                    && assignments.get(0).path("id").isTextual()) {
                context.post(
                        route(
                                "revokePlatformWorkspaceAssignment",
                                "/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/"
                                        + "{assignmentId}/revoke"),
                        accountRoot + "/accounts/" + accountId + "/assignments/"
                                + assignments.get(0).path("id").asText() + "/revoke",
                        platform.cookie(),
                        Map.of(
                                "expectedVersion",
                                assignments.get(0).path("revision").asLong(1)),
                        headers("calibration-platform-assignment-revoke-" + UUID.randomUUID()),
                        PROBE_STATUSES);
            }
        }

        BackendAcceptanceTest.WorkspaceFixture statusWorkspace = host.workspaceOnly();
        String statusRoot = "/api/platform/group-workspaces/" + statusWorkspace.groupWorkspaceKey();
        long statusVersion = context.get(
                        BackendAcceptanceTest.PLATFORM_GROUP_WORKSPACE_DETAIL,
                        statusRoot,
                        platform.cookie(),
                        Set.of(200))
                .json()
                .path("version")
                .asLong(1);
        String workspaceStatusKey = "calibration-platform-workspace-status-" + UUID.randomUUID();
        context.post(
                route(
                        "transitionPlatformGroupWorkspaceStatus",
                        "/platform/group-workspaces/{groupWorkspaceKey}/status"),
                statusRoot + "/status",
                platform.cookie(),
                Map.of(
                        "targetStatus",
                        "DISABLED",
                        "expectedVersion",
                        statusVersion,
                        "idempotencyKey",
                        workspaceStatusKey),
                headers(workspaceStatusKey),
                PROBE_STATUSES);

        BackendAcceptanceTest.Response stagedForCreate = context.multipartPlatformAsset(
                route("stagePlatformAsset", "/platform/assets/staging"),
                "/api/platform/assets/staging",
                platform.cookie(),
                "GROUP_WORKSPACE_LOGO",
                "calibration-platform-logo.png",
                "image/png",
                BackendAcceptanceTest.PNG,
                Set.of(201));
        String createAssetRef = stagedForCreate.json().path("assetRef").asText();
        String createBindGrant = stagedForCreate.json().path("bindGrant").asText();
        String createdWorkspaceKey = "calibration-platform-workspace-" + suffix;
        String workspaceCreateKey = "calibration-platform-workspace-create-" + UUID.randomUUID();
        context.post(
                route("createPlatformGroupWorkspace", "/platform/group-workspaces"),
                "/api/platform/group-workspaces",
                platform.cookie(),
                Map.of(
                        "groupWorkspaceKey", createdWorkspaceKey,
                        "name", "Calibration Platform Workspace",
                        "operationsTitle", "Calibration Operations",
                        "logoAssetRef", createAssetRef,
                        "logoBindGrant", createBindGrant,
                        "notes", "performance calibration",
                        "idempotencyKey", workspaceCreateKey),
                headers(workspaceCreateKey),
                Set.of(201));

        BackendAcceptanceTest.Response stagedForRelease = context.multipartPlatformAsset(
                route("stagePlatformAsset", "/platform/assets/staging"),
                "/api/platform/assets/staging",
                platform.cookie(),
                "GROUP_WORKSPACE_LOGO",
                "calibration-platform-release.png",
                "image/png",
                BackendAcceptanceTest.OTHER_PNG,
                Set.of(201));
        String releaseAssetRef = stagedForRelease.json().path("assetRef").asText();
        String releaseGrant = stagedForRelease.json().path("bindGrant").asText();
        context.post(
                route("releasePlatformStagedAsset", "/platform/assets/staging/{assetRef}/release"),
                "/api/platform/assets/staging/" + releaseAssetRef + "/release",
                platform.cookie(),
                Map.of(),
                Map.of("X-Asset-Bind-Grant", releaseGrant),
                Set.of(204));
        context.get(
                route("getPublicAssetContent", "/public/assets/{assetRef}/content"),
                "/api/public/assets/" + createAssetRef + "/content",
                null,
                PROBE_STATUSES);

        BackendAcceptanceTest.Response externalSystem = context.get(
                route(
                        "getPlatformExternalSystemDetail",
                        "/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}"),
                workspaceRoot + "/external-systems/MEITUAN",
                platform.cookie(),
                Set.of(200));
        context.post(
                route(
                        "transitionPlatformExternalSystemStatus",
                        "/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status"),
                workspaceRoot + "/external-systems/MEITUAN/status",
                platform.cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        externalSystem.json().path("version").asLong(1)),
                headers("calibration-platform-external-system-status-" + UUID.randomUUID()),
                PROBE_STATUSES);
        context.post(
                route("platformLogout", "/platform/auth/logout"),
                "/api/platform/auth/logout",
                platform.cookie(),
                Map.of(),
                headers("calibration-platform-logout-" + UUID.randomUUID()),
                Set.of(204));
    }

    private static void platformPasswordRecovery(
            BackendAcceptanceTest.ScenarioContext context, String loginName, String mobile) throws Exception {
        String recoveryRoot = "/api/platform/auth/password-recovery";
        BackendAcceptanceTest.Response started = context.post(
                route("startPlatformPasswordRecovery", "/platform/auth/password-recovery/start"),
                recoveryRoot + "/start",
                null,
                Map.of("loginName", loginName, "mobile", mobile),
                headers("calibration-platform-recovery-start-" + UUID.randomUUID()),
                Set.of(200));
        String flowCookie = cookie(started, "V2S_PLATFORM_PASSWORD_RECOVERY");
        BackendAcceptanceTest.Response sent = context.post(
                route("sendPlatformPasswordRecoveryOtp", "/platform/auth/password-recovery/otp/send"),
                recoveryRoot + "/otp/send",
                flowCookie,
                Map.of(),
                headers("calibration-platform-recovery-send-" + UUID.randomUUID()),
                Set.of(200));
        String code = sent.json().path("debugVerificationCode").asText();
        assertTrue(code.matches("[0-9]{6}"), "BUSINESS: platform password recovery receives a real OTP code");
        context.post(
                route("verifyPlatformPasswordRecoveryOtp", "/platform/auth/password-recovery/otp/verify"),
                recoveryRoot + "/otp/verify",
                flowCookie,
                Map.of("code", code),
                headers("calibration-platform-recovery-verify-" + UUID.randomUUID()),
                Set.of(200));
        context.post(
                route("completePlatformPasswordRecovery", "/platform/auth/password-recovery/complete"),
                recoveryRoot + "/complete",
                flowCookie,
                Map.of("newPassword", "Calibration-Admin-Recovered-123!"),
                headers("calibration-platform-recovery-complete-" + UUID.randomUUID()),
                Set.of(200));
    }

    private static UUID targetRef(BackendAcceptanceTest.Fixture fixture, String targetType) {
        return switch (targetType) {
            case "GROUP" -> fixture.groupId();
            case "REGION" -> fixture.regionId();
            case "PROJECT" -> fixture.projectId();
            case "HEAD_COMPANY" -> fixture.headCompanyId();
            case "STORE" -> fixture.storeId();
            default -> throw new IllegalArgumentException("unsupported calibration target " + targetType);
        };
    }

    private static String targetLabel(String targetType) {
        return switch (targetType) {
            case "GROUP" -> "Group";
            case "REGION" -> "Region";
            case "PROJECT" -> "Project";
            case "HEAD_COMPANY" -> "HeadCompany";
            case "STORE" -> "Store";
            default -> throw new IllegalArgumentException("unsupported calibration target " + targetType);
        };
    }

    private static String calibrationMobile(String seed) {
        int hash = Math.floorMod((seed + UUID.randomUUID()).hashCode(), 100_000_000);
        return "139" + String.format("%08d", hash);
    }

    private static Map<String, String> headers(String idempotencyKey) {
        return Map.of("Idempotency-Key", idempotencyKey);
    }

    private static Map<String, Object> invitationAction(
            UUID scopeRef, long expectedContextVersion, long expectedVersion, String idempotencyKey) {
        return Map.of(
                "scopeRef", scopeRef.toString(),
                "expectedContextVersion", expectedContextVersion,
                "expectedVersion", expectedVersion,
                "idempotencyKey", idempotencyKey);
    }

    private static String cookie(BackendAcceptanceTest.Response response, String name) {
        return response.http().headers().allValues("set-cookie").stream()
                .filter(value -> value.startsWith(name + "="))
                .map(value -> value.substring(0, value.indexOf(';')))
                .findFirst()
                .orElseThrow(() -> new AssertionError("BUSINESS: missing " + name + " recovery cookie"));
    }

    private static int dictionaryPosition(JsonNode entries, String code) {
        if (!entries.isArray()) return -1;
        for (int index = 0; index < entries.size(); index++) {
            if (code.equals(entries.get(index).path("code").asText())) return index;
        }
        return -1;
    }
}
