package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Real HTTP business oracles for the store service-point, table and QR surface. */
final class StoreServicePointAcceptanceScenarios {
    private static final String CAPABILITY = "EDIT_STORE_SERVICE_POINT_QR";
    private static final Set<Integer> OK = Set.of(200);
    private static final Set<Integer> CREATED = Set.of(201);
    private static final Set<Integer> CLIENT_FAILURE = Set.of(400, 403, 404, 409, 422);

    private final BackendAcceptanceTest host;
    private final BusinessChannelAcceptanceScenarios channels;

    StoreServicePointAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
        this.channels = new BusinessChannelAcceptanceScenarios(host);
    }

    @AcceptanceScenario(
            id = "storeServicePointAreaLifecycle",
            module = "ORG",
            operation = "storeServicePointAreaLifecycle")
    void storeServicePointAreaLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView tableArea = createArea(context, store, "TABLE_AREA", "Main table area", "TABLE-MAIN");
        AreaView scanArea = createArea(context, store, "SCAN_AREA", "Entry scan area", "SCAN-MAIN");
        assertAreaCollectionSnapshot(
                store, List.of(tableArea.ref(), scanArea.ref()), areaCollectionTime(store));

        JsonNode initial = listAreas(context, store);
        assertEquals(2, initial.path("total").asInt(), "BUSINESS: both active areas are listed");

        long collectionTimeBeforeMemberUpdate = areaCollectionTime(store);
        AreaView updated = updateArea(
                context, store, tableArea, "Main table area updated", "TABLE-MAIN-UPDATED", "TABLE_AREA", "ENABLED");
        assertAreaCollectionSnapshot(
                store, List.of(tableArea.ref(), scanArea.ref()), collectionTimeBeforeMemberUpdate);
        assertEquals("Main table area updated", updated.json().path("name").asText());
        assertEquals("TABLE_AREA", updated.json().path("areaType").asText());
        assertEquals(
                collectionTimeBeforeMemberUpdate,
                areaCollectionTime(store),
                "BUSINESS: updating a member preserves range time when membership hash is unchanged");

        AreaView moved = moveArea(context, store, scanArea, "UP");
        assertAreaCollectionSnapshot(
                store, List.of(tableArea.ref(), scanArea.ref()), collectionTimeBeforeMemberUpdate);
        assertEquals(
                "SCAN_AREA", moved.json().path("areaType").asText(), "BUSINESS: area order returns the moved area");

        AreaView currentUpdated = area(findItem(listAreas(context, store).path("items"), updated.ref()));
        AreaView disabled = transitionArea(context, store, currentUpdated, "DISABLED");
        long areaCollectionTimeAfterDisable = areaCollectionTime(store);
        assertAreaCollectionSnapshot(store, List.of(scanArea.ref()), disabledUpdatedAt(disabled.ref()));
        assertEquals("DISABLED", disabled.json().path("status").asText(), "BUSINESS: area status is persisted");
        JsonNode after = listAreas(context, store);
        assertEquals(2, after.path("total").asInt(), "BUSINESS: disabled area remains in the active list");

        AreaView voided = transitionArea(context, store, disabled, "VOIDED");
        assertEquals(
                "VOIDED",
                voided.json().path("status").asText(),
                "BUSINESS: voiding an area returns the retained historical row");
        assertEquals(
                1, listAreas(context, store).path("total").asInt(), "BUSINESS: a voided area leaves the current list");
        assertAreaCollectionSnapshot(store, List.of(scanArea.ref()), areaCollectionTimeAfterDisable);
    }

    @AcceptanceScenario(
            id = "storeServicePointAreaAvailability",
            module = "ORG",
            operation = "storeServicePointAreaAvailability")
    void storeServicePointAreaAvailability(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView area = createArea(context, store, "TABLE_AREA", "Availability area", "AVAILABILITY");
        PointView enabledPoint = createTablePoint(context, store, area, "Available table", "AVAIL-1", 4, "HALL", true);
        PointView disabledPoint =
                createTablePoint(context, store, area, "Disabled table", "AVAIL-2", 2, "BOOTH", false);
        PointView pointDisabled = transitionPoint(context, store, disabledPoint, "DISABLED");

        AreaView areaDisabled = transitionArea(context, store, area, "DISABLED");
        JsonNode disabledPage = listPoints(context, store, area);
        JsonNode disabledEnabled = findItem(disabledPage.path("items"), enabledPoint.ref());
        JsonNode disabledChild = findItem(disabledPage.path("items"), pointDisabled.ref());
        assertFalse(
                disabledEnabled.path("effectiveAvailable").asBoolean(true),
                "BUSINESS: disabled area disables descendants");
        assertFalse(disabledChild.path("effectiveAvailable").asBoolean(true), "BUSINESS: child remains unavailable");
        assertEquals(
                "ENABLED",
                disabledEnabled.path("status").asText(),
                "BUSINESS: parent disable does not rewrite point status");
        assertEquals("DISABLED", disabledChild.path("status").asText(), "BUSINESS: child status is retained");

        transitionArea(context, store, areaDisabled, "ENABLED");
        JsonNode restoredPage = listPoints(context, store, area);
        assertTrue(
                findItem(restoredPage.path("items"), enabledPoint.ref())
                        .path("effectiveAvailable")
                        .asBoolean(false),
                "BUSINESS: re-enabling the area restores an enabled point");
        assertFalse(
                findItem(restoredPage.path("items"), pointDisabled.ref())
                        .path("effectiveAvailable")
                        .asBoolean(true),
                "BUSINESS: re-enabling the area does not rewrite a disabled point");

        PointView voided = transitionPoint(context, store, pointDisabled, "VOIDED");
        assertEquals(
                "VOIDED",
                voided.json().path("status").asText(),
                "BUSINESS: voiding a point returns the retained historical row");
        JsonNode afterPointVoid = listPoints(context, store, area);
        assertEquals(
                1,
                afterPointVoid.path("total").asInt(),
                "BUSINESS: a voided point leaves the current list without losing the enabled point");

        PointView collectionMember = createTablePoint(
                context, store, area, "Collection member", "COLLECTION-MEMBER", 2, "HALL", true);
        assertPointCollectionSnapshot(
                store,
                List.of(enabledPoint.ref(), collectionMember.ref()),
                Math.max(pointUpdatedAt(enabledPoint.ref()), pointUpdatedAt(collectionMember.ref())));
        PointView collectionMemberDisabled = transitionPoint(context, store, collectionMember, "DISABLED");
        assertPointCollectionSnapshot(
                store, List.of(enabledPoint.ref()), pointUpdatedAt(collectionMemberDisabled.ref()));
    }

    @AcceptanceScenario(id = "storeServicePointOrdering", module = "ORG", operation = "storeServicePointOrdering")
    void storeServicePointOrdering(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView first = createArea(context, store, "TABLE_AREA", "Order first", "ORDER-1");
        AreaView middle = createArea(context, store, "TABLE_AREA", "Order middle", "ORDER-2");
        AreaView last = createArea(context, store, "TABLE_AREA", "Order last", "ORDER-3");

        moveArea(context, store, middle, "UP");
        JsonNode areasAfterUp = listAreas(context, store);
        assertEquals(
                List.of(
                        middle.ref().toString(),
                        first.ref().toString(),
                        last.ref().toString()),
                refs(areasAfterUp, "areaRef"),
                "BUSINESS: area UP swaps the moved row with its previous sibling");
        AreaView firstAfterUp = area(findItem(areasAfterUp.path("items"), first.ref()));
        moveArea(context, store, firstAfterUp, "DOWN");
        JsonNode areasAfterDown = listAreas(context, store);
        assertEquals(
                List.of(
                        middle.ref().toString(),
                        last.ref().toString(),
                        first.ref().toString()),
                refs(areasAfterDown, "areaRef"),
                "BUSINESS: area DOWN swaps the moved row with its next sibling");
        AreaView tail = createArea(context, store, "TABLE_AREA", "Order tail", "ORDER-4");
        AreaView middleAfterFirstDown = area(findItem(areasAfterDown.path("items"), middle.ref()));
        AreaView movedMiddleDown = moveArea(context, store, middleAfterFirstDown, "DOWN");
        JsonNode areasAfterFirstRepeatedDown = listAreas(context, store);
        assertEquals(
                List.of(
                        last.ref().toString(),
                        middle.ref().toString(),
                        first.ref().toString(),
                        tail.ref().toString()),
                refs(areasAfterFirstRepeatedDown, "areaRef"),
                "BUSINESS: area DOWN remains usable after the same target previously moved UP");
        AreaView movedMiddleDownAgain = moveArea(context, store, movedMiddleDown, "DOWN");
        JsonNode areasAfterSecondRepeatedDown = listAreas(context, store);
        assertEquals(
                List.of(
                        last.ref().toString(),
                        first.ref().toString(),
                        middle.ref().toString(),
                        tail.ref().toString()),
                refs(areasAfterSecondRepeatedDown, "areaRef"),
                "BUSINESS: repeated area DOWN creates a new mutation instead of replaying the first request");
        assertTrue(
                movedMiddleDownAgain.version() > movedMiddleDown.version(),
                "BUSINESS: area order mutation advances the target version");

        PointView point1 = createTablePoint(context, store, first, "Order point 1", "POINT-1", 2, "HALL", true);
        PointView point2 = createTablePoint(context, store, first, "Order point 2", "POINT-2", 2, "HALL", true);
        PointView point3 = createTablePoint(context, store, first, "Order point 3", "POINT-3", 2, "HALL", true);
        PointView movedPoint3Up = movePoint(context, store, point3, "UP");
        JsonNode pointsAfterUp = listPoints(context, store, first);
        assertEquals(
                List.of(
                        point1.ref().toString(),
                        point3.ref().toString(),
                        point2.ref().toString()),
                refs(pointsAfterUp, "pointRef"),
                "BUSINESS: point UP swaps the moved row with its previous sibling");
        PointView point1AfterUp = point(findItem(pointsAfterUp.path("items"), point1.ref()));
        movePoint(context, store, point1AfterUp, "DOWN");
        JsonNode pointsAfterDown = listPoints(context, store, first);
        assertEquals(
                List.of(
                        point3.ref().toString(),
                        point1.ref().toString(),
                        point2.ref().toString()),
                refs(pointsAfterDown, "pointRef"),
                "BUSINESS: point DOWN swaps the moved row with its next sibling");
        PointView point4 = createTablePoint(context, store, first, "Order point 4", "POINT-4", 2, "HALL", true);
        PointView point1AfterFirstDown = point(findItem(pointsAfterDown.path("items"), point1.ref()));
        PointView movedPoint1Down = movePoint(context, store, point1AfterFirstDown, "DOWN");
        JsonNode pointsAfterFirstRepeatedDown = listPoints(context, store, first);
        assertEquals(
                List.of(
                        point3.ref().toString(),
                        point2.ref().toString(),
                        point1.ref().toString(),
                        point4.ref().toString()),
                refs(pointsAfterFirstRepeatedDown, "pointRef"),
                ("BUSINESS: point DOWN remains usable after the same target previously mov"
                        + "ed DOWN through another state"));
        PointView movedPoint1DownAgain = movePoint(context, store, movedPoint1Down, "DOWN");
        JsonNode pointsAfterSecondRepeatedDown = listPoints(context, store, first);
        assertEquals(
                List.of(
                        point3.ref().toString(),
                        point2.ref().toString(),
                        point4.ref().toString(),
                        point1.ref().toString()),
                refs(pointsAfterSecondRepeatedDown, "pointRef"),
                "BUSINESS: repeated point DOWN creates a new mutation instead of replaying the first request");
        assertTrue(
                movedPoint1DownAgain.version() > movedPoint1Down.version(),
                "BUSINESS: point order mutation advances the target version");
        assertEquals(
                4, pointsAfterSecondRepeatedDown.path("total").asInt(), "BUSINESS: all ordered points remain listed");
        assertNotNull(last, "BUSINESS: third area fixture is retained for the ordering boundary");
        assertTrue(movedPoint3Up.version() > point3.version(), "BUSINESS: point UP advances the moved target version");
    }

    private static List<String> refs(JsonNode page, String field) {
        List<String> values = new ArrayList<>();
        page.path("items").forEach(item -> values.add(item.path(field).asText()));
        return values;
    }

    @AcceptanceScenario(
            id = "storeServicePointTypeCompatibility",
            module = "ORG",
            operation = "storeServicePointTypeCompatibility")
    void storeServicePointTypeCompatibility(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView tableArea = createArea(context, store, "TABLE_AREA", "Type table area", "TYPE-TABLE");
        AreaView scanArea = createArea(context, store, "SCAN_AREA", "Type scan area", "TYPE-SCAN");
        PointView table = createTablePoint(context, store, tableArea, "Type table", "TYPE-T-1", 4, "HALL", true);
        PointView scan = createScanPoint(context, store, scanArea, "Type scan", "TYPE-S-1");

        JsonNode tablePage = listPoints(context, store, tableArea);
        JsonNode scanPage = listPoints(context, store, scanArea);
        assertEquals("TABLE", tablePage.path("items").get(0).path("pointType").asText());
        assertEquals("SCAN", scanPage.path("items").get(0).path("pointType").asText());
        JsonNode detail = readPoint(context, store, table.ref());
        assertEquals(4, detail.path("seatCapacity").asInt(), "BUSINESS: table attributes are read back");
        assertEquals("HALL", detail.path("tableShape").asText());

        PointView updated = updateTablePoint(context, store, table, 6, "BOOTH", false);
        assertEquals(6, updated.json().path("seatCapacity").asInt(), "BUSINESS: table update is persisted");
        assertEquals("BOOTH", updated.json().path("tableShape").asText());
        assertFalse(updated.json().path("reservable").asBoolean(true));
        assertEquals(
                scan.ref().toString(),
                scan.json().path("pointRef").asText(),
                "BUSINESS: scan point identity is stable");
    }

    @AcceptanceScenario(
            id = "storeServicePointTableAttributes",
            module = "ORG",
            operation = "storeServicePointTableAttributes")
    void storeServicePointTableAttributes(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView tableArea = createArea(context, store, "TABLE_AREA", "Attribute table area", "ATTR-TABLE");
        AreaView scanArea = createArea(context, store, "SCAN_AREA", "Attribute scan area", "ATTR-SCAN");
        PointView table =
                createTablePoint(context, store, tableArea, "Attribute table", "ATTR-T-1", 4, "PRIVATE_ROOM", true);
        PointView optionalTable =
                createTablePoint(context, store, tableArea, "Optional table", "ATTR-T-2", null, null, null);
        PointView scan = createScanPoint(context, store, scanArea, "Attribute scan", "ATTR-S-1");
        BackendAcceptanceTest.Response stagedScanImage =
                stageAsset(context, store, "scan.png", BackendAcceptanceTest.sha256(BackendAcceptanceTest.PNG));
        UUID scanImageRef =
                UUID.fromString(stagedScanImage.json().path("assetRef").asText());
        String scanImageBindGrant = stagedScanImage.json().path("bindGrant").asText();
        table = updateTablePoint(context, store, table, 8, "OUTDOOR", true);

        JsonNode optionalReadback = readPoint(context, store, optionalTable.ref());
        assertTrue(optionalReadback.path("seatCapacity").isNull(), "BUSINESS: table capacity may be omitted");
        assertTrue(optionalReadback.path("tableShape").isNull(), "BUSINESS: table shape may be omitted");
        assertTrue(optionalReadback.path("reservable").isNull(), "BUSINESS: table reservability may be omitted");

        Map<String, Object> clearTableAttributes =
                pointBody("Attribute table", "ATTR-T-1", "TABLE", "ENABLED", table.version());
        clearTableAttributes.put("seatCapacity", null);
        clearTableAttributes.put("tableShape", null);
        clearTableAttributes.put("reservable", null);
        BackendAcceptanceTest.Response cleared = context.patch(
                OPERATIONS_STORE_SERVICE_POINT_UPDATE,
                pointPath(store.fixture(), table.ref()),
                store.session().cookie(),
                clearTableAttributes,
                idempotency(),
                OK);
        assertTrue(cleared.json().path("seatCapacity").isNull(), "BUSINESS: table capacity may be cleared");
        assertTrue(cleared.json().path("tableShape").isNull(), "BUSINESS: table shape may be cleared");
        assertTrue(cleared.json().path("reservable").isNull(), "BUSINESS: table reservability may be cleared");

        Map<String, Object> invalid = pointBody("Attribute scan", "ATTR-S-1", "SCAN", "ENABLED", scan.version() + 1);
        invalid.put("seatCapacity", 3);
        invalid.put("imageAssetRef", scanImageRef);
        invalid.put("imageBindGrant", scanImageBindGrant);
        BackendAcceptanceTest.Response rejected = context.patch(
                OPERATIONS_STORE_SERVICE_POINT_UPDATE,
                pointPath(store.fixture(), scan.ref()),
                store.session().cookie(),
                invalid,
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(rejected.status() >= 400, "BUSINESS: scan point rejects table-only attributes");
        JsonNode readback = readPoint(context, store, scan.ref());
        assertTrue(
                readback.path("seatCapacity").isNull(), "BUSINESS: rejected scan update does not store table capacity");
        assertTrue(readback.path("tableShape").isNull(), "BUSINESS: rejected scan update does not store table shape");
        assertTrue(readback.path("reservable").isNull(), "BUSINESS: rejected scan update does not store reservable");
        assertTrue(
                readback.path("imageAssetRef").isNull(), "BUSINESS: rejected scan update does not store a table image");
    }

    @AcceptanceScenario(
            id = "storeServicePointExtensionHost",
            module = "EXTENSION",
            operation = "storeServicePointExtensionHost")
    void storeServicePointExtensionHost(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        BackendAcceptanceTest.Response definition = context.get(
                OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION,
                "/api/operations/group-workspaces/" + store.fixture().groupWorkspaceKey()
                        + ("/organization/business-entities/extension-definition?entityType=SERVICE_"
                                + "POINT&expectedContextVersion=")
                        + store.session().contextVersion(),
                store.session().cookie(),
                OK);
        assertEquals(
                "SERVICE_POINT",
                definition.json().path("entityType").asText(),
                "BUSINESS: service-point extension host is exposed by the existing definition operation");
        AreaView area = createArea(context, store, "SCAN_AREA", "Extension area", "EXTENSION");
        PointView point = createScanPoint(context, store, area, "Extension point", "EXT-1");
        assertTrue(
                readPoint(context, store, point.ref()).path("extensionValues").isObject(),
                "BUSINESS: service-point readback always carries extension values");
    }

    @AcceptanceScenario(
            id = "storeServicePointTableAssetLifecycle",
            module = "ASSET",
            operation = "storeServicePointTableAssetLifecycle")
    void storeServicePointTableAssetLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView area = createArea(context, store, "TABLE_AREA", "Asset area", "ASSET");
        String digest = BackendAcceptanceTest.sha256(BackendAcceptanceTest.PNG);
        BackendAcceptanceTest.Response stagedForRelease = stageAsset(context, store, "discard.png", digest);
        UUID discardedAsset =
                UUID.fromString(stagedForRelease.json().path("assetRef").asText());
        long discardedVersion = stagedForRelease.json().path("version").asLong();
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_STORE_SERVICE_POINT_ASSET_RELEASE,
                assetReleasePath(store.fixture(), discardedAsset),
                store.session().cookie(),
                Map.of("expectedAssetVersion", discardedVersion),
                idempotency(),
                OK);
        assertEquals("RELEASED", released.json().path("status").asText(), "BUSINESS: staged image can be released");

        BackendAcceptanceTest.Response staged = stageAsset(context, store, "table.png", digest);
        UUID assetRef = UUID.fromString(staged.json().path("assetRef").asText());
        String bindGrant = staged.json().path("bindGrant").asText();
        PointView point = createTablePointWithAsset(
                context, store, area, "Asset table", "ASSET-1", 4, "HALL", true, assetRef, bindGrant);
        assertEquals(
                assetRef.toString(),
                point.json().path("imageAssetRef").asText(),
                "BUSINESS: point owner claims the staged image in the save transaction");
        assertEquals(
                assetRef.toString(),
                readPoint(context, store, point.ref()).path("imageAssetRef").asText(),
                "BUSINESS: active image binding is readable from the owner");
    }

    @AcceptanceScenario(id = "storeServicePointAudit", module = "AUDIT", operation = "storeServicePointAudit")
    void storeServicePointAudit(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView area = createArea(context, store, "TABLE_AREA", "Audit area", "AUDIT");
        PointView point = createTablePoint(context, store, area, "Audit table", "AUDIT-1", 4, "HALL", true);
        point = updateTablePoint(context, store, point, 5, "BOOTH", false);
        transitionPoint(context, store, point, "DISABLED");
        BackendAcceptanceTest.Response history = context.get(
                OPERATIONS_AUDIT_HISTORY,
                "/api/operations/audit-history?groupWorkspaceKey="
                        + store.fixture().groupWorkspaceKey() + "&entityType=STORE_SERVICE_POINT&entityId="
                        + point.ref() + "&page=1&pageSize=20",
                store.session().cookie(),
                OK);
        assertTrue(
                history.json().path("total").asLong() >= 3,
                "BUSINESS: point changes are available in operations audit history");
        assertTrue(history.json().path("items").isArray(), "BUSINESS: point audit readback returns history items");
    }

    @AcceptanceScenario(
            id = "storeQrConfigurationLifecycle",
            module = "BC",
            operation = "storeQrConfigurationLifecycle")
    void storeQrConfigurationLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        UUID channelRef = channels.acceptanceCreateStoreQrChannel(context, store.fixture(), store.session());
        JsonNode candidates = readQrCandidates(context, store);
        JsonNode candidate = findItem(candidates.path("items"), channelRef);
        assertEquals(
                "NOT_REQUIRED",
                candidate.path("bindingStatus").asText(),
                "BUSINESS: internal QR channel needs no binding");

        JsonNode initial = readQrConfiguration(context, store);
        assertFalse(initial.path("enabled").asBoolean(true), "BUSINESS: QR singleton defaults disabled");
        assertTrue(initial.path("channelRef").isNull(), "BUSINESS: disabled QR singleton has no selected channel");
        JsonNode enabled = updateQrConfiguration(
                context, store, true, channelRef, initial.path("version").asLong());
        assertTrue(enabled.path("enabled").asBoolean(false), "BUSINESS: QR configuration can be enabled");
        assertEquals(channelRef.toString(), enabled.path("channelRef").asText());
        assertEquals(
                channelRef.toString(),
                readQrConfiguration(context, store).path("channelRef").asText(),
                "BUSINESS: QR selection is read back from the owner");

        JsonNode disabled = updateQrConfiguration(
                context, store, false, channelRef, enabled.path("version").asLong());
        assertFalse(disabled.path("enabled").asBoolean(true), "BUSINESS: QR configuration can be switched off");
        assertEquals(
                channelRef.toString(),
                disabled.path("channelRef").asText(),
                "BUSINESS: switching QR off preserves the selected channel");
        assertEquals(
                channelRef.toString(),
                readQrConfiguration(context, store).path("channelRef").asText(),
                "BUSINESS: owner readback retains the channel while QR is disabled");
    }

    @AcceptanceScenario(
            id = "storeQrChannelCandidatePredicate",
            module = "BC",
            operation = "storeQrChannelCandidatePredicate")
    void storeQrChannelCandidatePredicate(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        List<UUID> matrix = channels.acceptanceCreateStoreQrCandidateMatrix(context, store.fixture(), store.session());
        JsonNode page = readQrCandidates(context, store);

        assertEquals(1, page.path("items").size(), "BUSINESS: candidate owner returns exactly one eligible channel");
        assertEquals(
                matrix.get(0).toString(),
                page.path("items").get(0).path("channelRef").asText(),
                "BUSINESS: candidate owner keeps the exact four-dimension match");
        for (UUID rejected : matrix.subList(1, matrix.size())) {
            assertTrue(
                    page.toString().indexOf(rejected.toString()) < 0,
                    "BUSINESS: candidate owner excludes an ineligible channel " + rejected);
        }
        assertTrue(page.path("nextCursor").isNull(), "BUSINESS: QR candidate read is bounded without a cursor");
    }

    @AcceptanceScenario(id = "storeQrChannelBoundedRead", module = "BC", operation = "storeQrChannelBoundedRead")
    void storeQrChannelBoundedRead(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        channels.acceptanceCreateStoreQrChannels(context, store.fixture(), store.session(), 100, "QR bounded");
        JsonNode exactLimit = readQrCandidates(context, store);
        assertEquals(100, exactLimit.path("items").size(), "BUSINESS: bounded QR read returns the exact limit");
        assertEquals(100, exactLimit.path("total").asInt(), "BUSINESS: bounded QR read reports the exact total");
        assertTrue(exactLimit.path("nextCursor").isNull(), "BUSINESS: bounded QR read has no continuation cursor");

        channels.acceptanceCreateStoreQrChannels(context, store.fixture(), store.session(), 1, "QR overflow");
        BackendAcceptanceTest.Response overflow = context.get(
                OPERATIONS_STORE_QR_CHANNEL_CANDIDATES,
                qrCandidatesPath(store.fixture()),
                store.session().cookie(),
                Set.of(422));
        assertEquals(
                "QR_CHANNEL_CANDIDATE_OVERFLOW",
                overflow.problemCode(),
                "BUSINESS: 101 QR candidates fail with a typed overflow problem");
        assertTrue(
                overflow.json().path("items").isMissingNode()
                        || overflow.json().path("items").isNull(),
                "BUSINESS: overflow does not silently return a truncated candidate list");
    }

    @AcceptanceScenario(id = "storeQrUrlDerivation", module = "BC", operation = "storeQrUrlDerivation")
    void storeQrUrlDerivation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        UUID channelRef = channels.acceptanceCreateStoreQrChannel(context, store.fixture(), store.session());
        JsonNode configuration = readQrConfiguration(context, store);
        updateQrConfiguration(
                context, store, true, channelRef, configuration.path("version").asLong());
        AreaView area = createArea(context, store, "SCAN_AREA", "QR area", "QR-URL");
        PointView point = createScanPoint(context, store, area, "QR point", "QR-URL-1");
        String qrUrl = readPoint(context, store, point.ref()).path("qrUrl").asText();
        assertTrue(qrUrl.startsWith("https://qr.example.test/order"), "BUSINESS: QR URL keeps the template base");
        assertTrue(
                qrUrl.contains("groupWorkspaceKey=" + store.fixture().groupWorkspaceKey()),
                "BUSINESS: QR URL includes the group workspace key");
        assertTrue(qrUrl.contains("servicePointRef=" + point.ref()), "BUSINESS: QR URL includes the service-point ref");
        assertTrue(qrUrl.endsWith("#entry"), "BUSINESS: QR URL keeps the fragment at the end");
    }

    @AcceptanceScenario(
            id = "storeQrGenerationStateIndependence",
            module = "ORG",
            operation = "storeQrGenerationStateIndependence")
    void storeQrGenerationStateIndependence(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        UUID channelRef = channels.acceptanceCreateStoreQrChannel(context, store.fixture(), store.session());
        JsonNode initial = readQrConfiguration(context, store);
        updateQrConfiguration(
                context, store, true, channelRef, initial.path("version").asLong());
        AreaView area = createArea(context, store, "SCAN_AREA", "QR state area", "QR-STATE");
        PointView point = createScanPoint(context, store, area, "QR state point", "QR-STATE-1");
        PointView disabled = transitionPoint(context, store, point, "DISABLED");
        assertFalse(
                disabled.json().path("effectiveAvailable").asBoolean(true), "BUSINESS: disabled point is unavailable");
        assertFalse(
                disabled.json().path("qrUrl").isNull(),
                "BUSINESS: QR generation remains independent from point lifecycle state");
    }

    @AcceptanceScenario(
            id = "storeQrConfigurationOwnerRecheck",
            module = "ORG",
            operation = "storeQrConfigurationOwnerRecheck")
    void storeQrConfigurationOwnerRecheck(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context, true);
        UUID selectedChannel = channels.acceptanceCreateStoreQrChannel(context, store.fixture(), store.session());
        JsonNode initial = readQrConfiguration(context, store);
        JsonNode enabled = updateQrConfiguration(
                context, store, true, selectedChannel, initial.path("version").asLong());

        BackendAcceptanceTest.Fixture foreignFixture =
                host.siblingStoreFixture(store.fixture(), Set.of(CAPABILITY, "BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, foreignFixture);
        BackendAcceptanceTest.Session foreignSession =
                selectStore(context, foreignFixture, host.login(context, foreignFixture));
        UUID foreignChannel = channels.acceptanceCreateStoreQrChannel(context, foreignFixture, foreignSession);

        BackendAcceptanceTest.Response foreignRejected = context.patch(
                OPERATIONS_STORE_QR_CONFIGURATION_UPDATE,
                qrConfigurationPath(store.fixture()),
                store.session().cookie(),
                Map.of(
                        "enabled",
                        true,
                        "channelRef",
                        foreignChannel,
                        "expectedVersion",
                        enabled.path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(foreignRejected.status() >= 400, "BUSINESS: owner rejects a channel belonging to another store");
        assertEquals(
                selectedChannel.toString(),
                readQrConfiguration(context, store).path("channelRef").asText(),
                "BUSINESS: rejected foreign selection retains the existing QR configuration");

        channels.acceptanceDisableStoreQrChannel(context, store.fixture(), store.session(), selectedChannel);
        BackendAcceptanceTest.Response statusRejected = context.patch(
                OPERATIONS_STORE_QR_CONFIGURATION_UPDATE,
                qrConfigurationPath(store.fixture()),
                store.session().cookie(),
                Map.of(
                        "enabled",
                        true,
                        "channelRef",
                        selectedChannel,
                        "expectedVersion",
                        readQrConfiguration(context, store).path("version").asLong()),
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(statusRejected.status() >= 400, "BUSINESS: owner rechecks the selected channel status at save time");
        assertEquals(
                selectedChannel.toString(),
                readQrConfiguration(context, store).path("channelRef").asText(),
                "BUSINESS: a failed status recheck does not clear the stored selection");
    }

    @AcceptanceScenario(
            id = "storeServicePointGateAndRoles",
            module = "ORG",
            operation = "storeServicePointGateAndRoles")
    void storeServicePointGateAndRoles(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        StoreContext store = enabledStore(context);
        AreaView area = createArea(context, store, "TABLE_AREA", "Role area", "ROLE");
        for (BackendAcceptanceTest.Fixture userFixture : List.of(
                host.groupUserFixture(store.fixture(), Set.of(CAPABILITY)),
                host.regionUserFixture(store.fixture(), Set.of(CAPABILITY)),
                host.projectUserFixture(store.fixture(), Set.of(CAPABILITY)),
                host.storeUserFixture(store.fixture(), Set.of(CAPABILITY)))) {
            host.completeInvitation(context, userFixture);
            BackendAcceptanceTest.Session session = selectStore(context, userFixture, host.login(context, userFixture));
            BackendAcceptanceTest.Response page =
                    context.get(OPERATIONS_STORE_SERVICE_POINT_AREAS, areasPath(userFixture), session.cookie(), OK);
            assertTrue(
                    findItem(page.json().path("items"), area.ref()).isObject(),
                    "BUSINESS: all four role levels read the selected store area");
        }

        BackendAcceptanceTest.Fixture base = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Fixture closed = host.closedStoreFixture(base, Set.of(CAPABILITY));
        host.completeInvitation(context, closed);
        BackendAcceptanceTest.Session closedSession = selectStore(context, closed, host.login(context, closed));
        BackendAcceptanceTest.Response rejected = context.post(
                OPERATIONS_STORE_SERVICE_POINT_AREA_CREATE,
                areasPath(closed),
                closedSession.cookie(),
                Map.of("name", "Closed area", "code", "CLOSED", "areaType", "TABLE_AREA"),
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(rejected.status() >= 400, "BUSINESS: closed store gate rejects direct mutation");

        BackendAcceptanceTest.Response stageRejected = context.multipartStoreServicePointAsset(
                OPERATIONS_STORE_SERVICE_POINT_ASSET_STAGE,
                assetStagePath(closed),
                closedSession.cookie(),
                "closed-store.png",
                "image/png",
                BackendAcceptanceTest.sha256(BackendAcceptanceTest.PNG),
                BackendAcceptanceTest.PNG,
                CLIENT_FAILURE);
        assertTrue(stageRejected.status() >= 400, "BUSINESS: closed store gate rejects service-point image staging");

        BackendAcceptanceTest.Response releaseRejected = context.post(
                OPERATIONS_STORE_SERVICE_POINT_ASSET_RELEASE,
                assetReleasePath(closed, UUID.randomUUID()),
                closedSession.cookie(),
                Map.of("expectedAssetVersion", 1),
                idempotency(),
                CLIENT_FAILURE);
        assertTrue(
                releaseRejected.status() >= 400,
                "BUSINESS: closed store gate rejects staged-image release before asset lookup");
    }

    private StoreContext enabledStore(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        return enabledStore(context, false);
    }

    private StoreContext enabledStore(BackendAcceptanceTest.ScenarioContext context, boolean businessChannelCapability)
            throws Exception {
        Set<String> capabilities =
                businessChannelCapability ? Set.of(CAPABILITY, "BC-BUSINESS-CHANNEL-STORE-EDIT") : Set.of(CAPABILITY);
        BackendAcceptanceTest.Fixture base = host.fixture("PROJECT", Set.of());
        BackendAcceptanceTest.Fixture fixture = host.storeServicePointFixture(base, capabilities);
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = selectStore(context, fixture, host.login(context, fixture));
        return new StoreContext(fixture, session);
    }

    private AreaView createArea(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, String type, String name, String code)
            throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("code", code);
        body.put("areaType", type);
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_AREA_CREATE,
                areasPath(store.fixture()),
                store.session().cookie(),
                body,
                idempotency(),
                CREATED);
        return area(response.json());
    }

    private AreaView updateArea(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            AreaView area,
            String name,
            String code,
            String type,
            String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.patch(
                OPERATIONS_STORE_SERVICE_POINT_AREA_UPDATE,
                areaPath(store.fixture(), area.ref()),
                store.session().cookie(),
                Map.of(
                        "name", name,
                        "code", code,
                        "areaType", type,
                        "status", status,
                        "expectedVersion", area.version()),
                idempotency(),
                OK);
        return area(response.json());
    }

    private AreaView transitionArea(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaView area, String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_AREA_STATUS,
                areaPath(store.fixture(), area.ref()) + "/status",
                store.session().cookie(),
                Map.of("status", status, "expectedVersion", area.version()),
                idempotency(),
                OK);
        return area(response.json());
    }

    private AreaView moveArea(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaView area, String direction)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_AREA_ORDER,
                areaPath(store.fixture(), area.ref()) + "/order",
                store.session().cookie(),
                Map.of("direction", direction, "expectedVersion", area.version()),
                idempotency(),
                OK);
        return area(response.json());
    }

    private PointView createTablePoint(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            AreaView area,
            String name,
            String code,
            Integer capacity,
            String shape,
            Boolean reservable)
            throws Exception {
        return createPoint(
                context, store, area, pointBody(name, code, "TABLE", null, null, capacity, shape, reservable));
    }

    private PointView createTablePointWithAsset(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            AreaView area,
            String name,
            String code,
            Integer capacity,
            String shape,
            Boolean reservable,
            UUID assetRef,
            String bindGrant)
            throws Exception {
        Map<String, Object> body = pointBody(name, code, "TABLE", null, null, capacity, shape, reservable);
        body.put("imageAssetRef", assetRef);
        body.put("imageBindGrant", bindGrant);
        return createPoint(context, store, area, body);
    }

    private PointView createScanPoint(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaView area, String name, String code)
            throws Exception {
        return createPoint(context, store, area, pointBody(name, code, "SCAN", null, null));
    }

    private PointView createPoint(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaView area, Map<String, Object> body)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_CREATE,
                areaPath(store.fixture(), area.ref()) + "/service-points",
                store.session().cookie(),
                body,
                idempotency(),
                CREATED);
        return point(response.json());
    }

    private PointView updateTablePoint(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            PointView point,
            Integer capacity,
            String shape,
            Boolean reservable)
            throws Exception {
        Map<String, Object> body = pointBody(
                point.json().path("name").asText(),
                point.json().path("code").asText(),
                "TABLE",
                point.json().path("status").asText(),
                point.version(),
                capacity,
                shape,
                reservable);
        BackendAcceptanceTest.Response response = context.patch(
                OPERATIONS_STORE_SERVICE_POINT_UPDATE,
                pointPath(store.fixture(), point.ref()),
                store.session().cookie(),
                body,
                idempotency(),
                OK);
        return point(response.json());
    }

    private PointView transitionPoint(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, PointView point, String status)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_STATUS,
                pointPath(store.fixture(), point.ref()) + "/status",
                store.session().cookie(),
                Map.of("status", status, "expectedVersion", point.version()),
                idempotency(),
                OK);
        return point(response.json());
    }

    private PointView movePoint(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, PointView point, String direction)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_STORE_SERVICE_POINT_ORDER,
                pointPath(store.fixture(), point.ref()) + "/order",
                store.session().cookie(),
                Map.of("direction", direction, "expectedVersion", point.version()),
                idempotency(),
                OK);
        return point(response.json());
    }

    private JsonNode listAreas(BackendAcceptanceTest.ScenarioContext context, StoreContext store) throws Exception {
        return context.get(
                        OPERATIONS_STORE_SERVICE_POINT_AREAS,
                        areasPath(store.fixture()),
                        store.session().cookie(),
                        OK)
                .json();
    }

    private JsonNode listPoints(BackendAcceptanceTest.ScenarioContext context, StoreContext store, AreaView area)
            throws Exception {
        return context.get(
                        OPERATIONS_STORE_SERVICE_POINTS,
                        areaPath(store.fixture(), area.ref()) + "/service-points",
                        store.session().cookie(),
                        OK)
                .json();
    }

    private JsonNode readPoint(BackendAcceptanceTest.ScenarioContext context, StoreContext store, UUID pointRef)
            throws Exception {
        return context.get(
                        OPERATIONS_STORE_SERVICE_POINT,
                        pointPath(store.fixture(), pointRef),
                        store.session().cookie(),
                        OK)
                .json();
    }

    private BackendAcceptanceTest.Response stageAsset(
            BackendAcceptanceTest.ScenarioContext context, StoreContext store, String fileName, String digest)
            throws Exception {
        return context.multipartStoreServicePointAsset(
                OPERATIONS_STORE_SERVICE_POINT_ASSET_STAGE,
                assetStagePath(store.fixture()),
                store.session().cookie(),
                fileName,
                "image/png",
                digest,
                BackendAcceptanceTest.PNG,
                CREATED);
    }

    private JsonNode readQrCandidates(BackendAcceptanceTest.ScenarioContext context, StoreContext store)
            throws Exception {
        return context.get(
                        OPERATIONS_STORE_QR_CHANNEL_CANDIDATES,
                        qrCandidatesPath(store.fixture()),
                        store.session().cookie(),
                        OK)
                .json();
    }

    private JsonNode readQrConfiguration(BackendAcceptanceTest.ScenarioContext context, StoreContext store)
            throws Exception {
        return context.get(
                        OPERATIONS_STORE_QR_CONFIGURATION,
                        qrConfigurationPath(store.fixture()),
                        store.session().cookie(),
                        OK)
                .json();
    }

    private JsonNode updateQrConfiguration(
            BackendAcceptanceTest.ScenarioContext context,
            StoreContext store,
            boolean enabled,
            UUID channelRef,
            long version)
            throws Exception {
        return context.patch(
                        OPERATIONS_STORE_QR_CONFIGURATION_UPDATE,
                        qrConfigurationPath(store.fixture()),
                        store.session().cookie(),
                        Map.of("enabled", enabled, "channelRef", channelRef, "expectedVersion", version),
                        idempotency(),
                        OK)
                .json();
    }

    private static Map<String, Object> pointBody(
            String name, String code, String type, String status, Long expectedVersion) {
        return pointBody(name, code, type, status, expectedVersion, null, null, null);
    }

    private static Map<String, Object> pointBody(
            String name,
            String code,
            String type,
            String status,
            Long expectedVersion,
            Integer capacity,
            String shape,
            Boolean reservable) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("code", code);
        body.put("pointType", type);
        if (status != null) body.put("status", status);
        if (capacity != null) body.put("seatCapacity", capacity);
        if (shape != null) body.put("tableShape", shape);
        if (reservable != null) body.put("reservable", reservable);
        body.put("extensionValues", Map.of());
        if (expectedVersion != null) body.put("expectedVersion", expectedVersion);
        return body;
    }

    private static Map<String, String> idempotency() {
        return Map.of("Idempotency-Key", "acceptance-store-service-point-" + UUID.randomUUID());
    }

    private static BackendAcceptanceTest.Session selectStore(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session)
            throws Exception {
        BackendAcceptanceTest.Response selected = context.post(
                OPERATIONS_WORKSPACE_SESSION_DATA_NODE,
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
                        .asText(),
                "BUSINESS: service-point fixture selects the intended store");
        return new BackendAcceptanceTest.Session(
                session.cookie(),
                selected.json(),
                selected.json().path("contextVersion").asLong());
    }

    private static String areasPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/service-point-areas?pageSize=20";
    }

    private static String areaPath(BackendAcceptanceTest.Fixture fixture, UUID areaRef) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/service-point-areas/" + areaRef;
    }

    private static String pointPath(BackendAcceptanceTest.Fixture fixture, UUID pointRef) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/service-points/" + pointRef;
    }

    private static String assetStagePath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/service-point-assets/stage";
    }

    private static String assetReleasePath(BackendAcceptanceTest.Fixture fixture, UUID assetRef) {
        return assetStagePath(fixture) + "/" + assetRef + "/release";
    }

    private static String qrConfigurationPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/qr-configuration";
    }

    private static String qrCandidatesPath(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/qr-channel-candidates";
    }

    private static AreaView area(JsonNode json) {
        return new AreaView(
                UUID.fromString(json.path("areaRef").asText()),
                json.path("version").asLong(),
                json);
    }

    private static PointView point(JsonNode json) {
        return new PointView(
                UUID.fromString(json.path("pointRef").asText()),
                json.path("version").asLong(),
                json);
    }

    private void assertAreaCollectionSnapshot(StoreContext store, List<UUID> members, long expectedTime)
            throws Exception {
        String canonicalMembers = members.stream()
                .map(UUID::toString)
                .sorted()
                .collect(java.util.stream.Collectors.joining("\n"));
        String expectedHash = BackendAcceptanceTest.sha256(
                canonicalMembers.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        Map<String, Object> snapshot = host.queryForMap(
                "SELECT collection_hash, topic_time_epoch_millis FROM organization.terminal_topic_snapshot "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? "
                        + "AND topic_key='SERVICE_POINT_AREA_COLLECTION'",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                store.fixture().storeId());
        assertEquals(
                expectedHash,
                snapshot.get("collection_hash").toString().trim(),
                "BUSINESS: area snapshot hashes full sorted refs");
        assertEquals(
                expectedTime,
                ((Number) snapshot.get("topic_time_epoch_millis")).longValue(),
                "BUSINESS: area snapshot time follows the owner transition rule");
    }

    private void assertPointCollectionSnapshot(StoreContext store, List<UUID> members, long expectedTime)
            throws Exception {
        String canonicalMembers = members.stream()
                .map(UUID::toString)
                .sorted()
                .collect(java.util.stream.Collectors.joining("\n"));
        String expectedHash = BackendAcceptanceTest.sha256(
                canonicalMembers.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        Map<String, Object> snapshot = host.queryForMap(
                "SELECT collection_hash, topic_time_epoch_millis FROM organization.terminal_topic_snapshot "
                        + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? "
                        + "AND topic_key='SERVICE_POINT_COLLECTION'",
                store.fixture().workspaceUuid(),
                store.fixture().groupWorkspaceKey(),
                store.fixture().storeId());
        assertEquals(expectedHash, snapshot.get("collection_hash").toString().trim(),
                "BUSINESS: point snapshot hashes the complete sorted enabled ref set");
        assertEquals(expectedTime, ((Number) snapshot.get("topic_time_epoch_millis")).longValue(),
                "BUSINESS: point snapshot time follows the owner transition rule");
    }

    private long pointUpdatedAt(UUID pointRef) {
        return ((Number) host.queryForMap(
                        "SELECT updated_at_epoch_millis FROM organization.store_service_point WHERE point_ref=?",
                        pointRef)
                .get("updated_at_epoch_millis")).longValue();
    }

    private long areaCollectionTime(StoreContext store) {
        return ((Number) host.queryForMap(
                        "SELECT topic_time_epoch_millis FROM organization.terminal_topic_snapshot "
                                + "WHERE workspace_uuid=? AND group_workspace_key=? AND store_ref=? "
                                + "AND topic_key='SERVICE_POINT_AREA_COLLECTION'",
                        store.fixture().workspaceUuid(),
                        store.fixture().groupWorkspaceKey(),
                        store.fixture().storeId())
                .get("topic_time_epoch_millis")).longValue();
    }

    private long disabledUpdatedAt(UUID areaRef) {
        return ((Number) host.queryForMap(
                        "SELECT updated_at_epoch_millis FROM organization.store_service_point_area WHERE area_ref=?",
                        areaRef)
                .get("updated_at_epoch_millis")).longValue();
    }

    private static JsonNode findItem(JsonNode items, UUID ref) {
        for (JsonNode item : items) {
            if (ref.toString().equals(item.path("areaRef").asText())
                    || ref.toString().equals(item.path("pointRef").asText())
                    || ref.toString().equals(item.path("channelRef").asText())) return item;
        }
        throw new AssertionError("BUSINESS: missing item " + ref + " available=" + items);
    }

    private record StoreContext(BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session) {}

    private record AreaView(UUID ref, long version, JsonNode json) {}

    private record PointView(UUID ref, long version, JsonNode json) {}
}
