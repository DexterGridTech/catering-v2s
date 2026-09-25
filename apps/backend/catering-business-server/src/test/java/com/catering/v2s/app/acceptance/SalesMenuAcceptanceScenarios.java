package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Real HTTP business oracles for the thirteen sales-menu aggregates in SM-05. */
final class SalesMenuAcceptanceScenarios {
    private static final Set<String> STORE_CAPABILITIES =
            Set.of("EDIT_STORE_CATALOG", "EDIT_STORE_SALES_MENU", "BC-BUSINESS-CHANNEL-STORE-EDIT");
    private static final String SALES_MENU_CAPABILITY = "EDIT_STORE_SALES_MENU";

    private static final RouteIdentity BUSINESS_CHANNEL_TEMPLATE_CREATE = new RouteIdentity(
            "createOperationsBusinessChannelTemplate",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channel-templates");
    private static final RouteIdentity BUSINESS_CHANNEL_CREATE = new RouteIdentity(
            "createOperationsBusinessChannel",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels");
    private static final RouteIdentity BUSINESS_CHANNEL_DETAIL = new RouteIdentity(
            "getOperationsBusinessChannelDetail",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}");
    private static final RouteIdentity BUSINESS_CHANNEL_STATUS = new RouteIdentity(
            "transitionOperationsBusinessChannelStatus",
            "/api/operations/group-workspaces/{groupWorkspaceKey}/business-channels/{channelRef}");

    private final BackendAcceptanceTest host;
    private final CatalogAcceptanceScenarios catalog;
    private final BusinessChannelAcceptanceScenarios channels;

    SalesMenuAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
        this.catalog = new CatalogAcceptanceScenarios(host);
        this.channels = new BusinessChannelAcceptanceScenarios(host);
    }

    private record MenuFixture(
            BackendAcceptanceTest.Fixture fixture, BackendAcceptanceTest.Session session, List<UUID> channels) {}

    private record MenuState(UUID ref, long version) {}

    private record SectionState(UUID ref, long menuVersion) {}

    private record ItemState(UUID ref, UUID catalogRef, long itemVersion) {}

    private record MenuReadResult(JsonNode json) {}

    private record AvailabilityExpectation(String applicability, String state, String reason) {}

    private record PreparedMenu(
            MenuFixture fixture,
            MenuState menu,
            SectionState section,
            ItemState item,
            String catalogItemCode,
            long menuVersion) {}

    @AcceptanceScenario(
            id = "sales-menu.store-scope-and-channel-eligibility",
            module = "SALES_MENU",
            operation = "getOperationsSalesMenus")
    void storeScopeAndChannelEligibility(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 scope");
        UUID channelRef = menus.channels().getFirst();
        MenuState menu = createMenu(context, menus, "SM05 scoped menu", channelRef);

        BackendAcceptanceTest.Response list = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + channelRef + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        JsonNode listItems = requiredJsonNode(
                list.json(), "/items", JsonNodeType.ARRAY, "BUSINESS: eligible store list returns a typed menu page");
        assertEquals(1, listItems.size(), "BUSINESS: menu list is confined to the current store and channel");
        assertEquals(
                menu.ref().toString(),
                listItems.get(0).path("salesMenuRef").asText(),
                "BUSINESS: the menu list returns the created menu identity");

        MenuReadResult detail = readMenu(context, menus, menu.ref(), channelRef);
        assertEquals(
                menus.fixture().storeId().toString(),
                detail.json().path("storeRef").asText(),
                "BUSINESS: menu detail is store-scoped");
        assertEquals(
                "DISABLED",
                detail.json().path("activation").path("status").asText(),
                "BUSINESS: a new menu is disabled for its eligible channel");
        assertFalse(detail.json().path("archived").asBoolean(true), "BUSINESS: a new menu is not archived");

        BackendAcceptanceTest.Fixture projectFixture =
                host.projectUserFixture(menus.fixture(), Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT"));
        host.completeInvitation(context, projectFixture);
        BackendAcceptanceTest.Session projectSession = host.login(context, projectFixture);
        UUID projectChannel = createProjectOwnedChannel(context, projectFixture, projectSession, "SM05 project");
        BackendAcceptanceTest.Response projectRejected = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", projectChannel, "name", "SM05 project rejected"),
                Set.of(422));
        assertEquals(
                "SALES_MENU_CHANNEL_INELIGIBLE",
                projectRejected.problemCode(),
                "BUSINESS: a project-owned channel is not a sales-menu channel");

        JsonNode external =
                channels.calibrationCreateExternalBinding(context, menus.fixture(), menus.session(), "MEITUAN_ISV_B");
        UUID externalChannel = UUID.fromString(external.path("channelRef").asText());
        BackendAcceptanceTest.Response externalRejected = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", externalChannel, "name", "SM05 external rejected"),
                Set.of(422));
        assertEquals(
                "SALES_MENU_CHANNEL_INELIGIBLE",
                externalRejected.problemCode(),
                "BUSINESS: an external channel is rejected by the menu owner boundary");

        BackendAcceptanceTest.Response eligibleChannels = context.get(
                BusinessChannelAcceptanceScenarios.CHANNEL_LIST_STORE,
                "/api/operations/group-workspaces/" + menus.fixture().groupWorkspaceKey() + "/stores/"
                        + menus.fixture().storeId() + "/business-channels?usage=SALES_MENU&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        JsonNode eligibleItems = requiredJsonNode(
                eligibleChannels.json(),
                "/items",
                JsonNodeType.ARRAY,
                "BUSINESS: sales-menu channel list returns a typed collection");
        assertEquals(1, eligibleItems.size(), "BUSINESS: only the current STORE eligible channel is listed");
        assertEquals(
                channelRef.toString(),
                eligibleItems.get(0).path("channelRef").asText(),
                "BUSINESS: eligible channel list returns the current STORE channel");
        assertFalse(
                eligibleChannels.json().toString().contains(projectChannel.toString()),
                "BUSINESS: project-owned channels are excluded from sales-menu channel candidates");
        assertFalse(
                eligibleChannels.json().toString().contains(externalChannel.toString()),
                "BUSINESS: external channels are excluded from sales-menu channel candidates");

        UUID dineInChannel = channels.acceptanceCreateSalesMenuEligibleStoreChannels(
                        context, menus.fixture(), menus.session(), 1, "SM05 scope dine-in", "DINE_IN")
                .getFirst();
        BackendAcceptanceTest.Response eligibleChannelsWithDineIn = context.get(
                BusinessChannelAcceptanceScenarios.CHANNEL_LIST_STORE,
                "/api/operations/group-workspaces/" + menus.fixture().groupWorkspaceKey() + "/stores/"
                        + menus.fixture().storeId() + "/business-channels?usage=SALES_MENU&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        Set<String> eligibleRefs = nodeRefs(
                requiredJsonNode(
                        eligibleChannelsWithDineIn.json(),
                        "/items",
                        JsonNodeType.ARRAY,
                        "BUSINESS: sales-menu channel list includes both supported order kinds"),
                "channelRef");
        assertEquals(2, eligibleRefs.size(), "BUSINESS: both DINE_IN and TAKEAWAY channels are eligible");
        assertTrue(eligibleRefs.contains(channelRef.toString()), "BUSINESS: TAKEAWAY channel remains eligible");
        assertTrue(eligibleRefs.contains(dineInChannel.toString()), "BUSINESS: DINE_IN channel is eligible");

        BackendAcceptanceTest.Fixture noCapability = host.storeUserFixture(menus.fixture(), Set.of());
        host.completeInvitation(context, noCapability);
        BackendAcceptanceTest.Session noCapabilitySession =
                selectStore(context, noCapability, host.login(context, noCapability));
        BackendAcceptanceTest.Response capabilityRejected = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(noCapability),
                noCapabilitySession.cookie(),
                Map.of("channelRef", channelRef, "name", "SM05 capability rejected"),
                Set.of(403));
        assertAccessProblem(capabilityRejected, "BUSINESS: menu commands require the sales-menu capability");

        BackendAcceptanceTest.Fixture sibling = host.siblingStoreFixtureSameBrand(menus.fixture(), STORE_CAPABILITIES);
        host.completeInvitation(context, sibling);
        BackendAcceptanceTest.Session siblingSession = selectStore(context, sibling, host.login(context, sibling));
        UUID siblingChannel = channels.acceptanceCreateSalesMenuEligibleStoreChannels(
                        context, sibling, siblingSession, 1, "SM05 sibling")
                .getFirst();
        BackendAcceptanceTest.Response hidden = context.get(
                OPERATIONS_SALES_MENU,
                menuRoot(sibling) + "/" + menu.ref() + "?channelRef=" + siblingChannel,
                siblingSession.cookie(),
                Set.of(404));
        assertEquals(
                "SALES_MENU_NOT_FOUND",
                hidden.problemCode(),
                "BUSINESS: a same-brand sibling store cannot read another store's menu");
    }

    @AcceptanceScenario(
            id = "sales-menu.external-dine-in-excluded",
            module = "SALES_MENU",
            operation = "getOperationsStoreBusinessChannels")
    void externalDineInExcluded(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 external DINE_IN exclusion");
        UUID eligibleChannel = menus.channels().getFirst();
        JsonNode external = channels.acceptanceCreateExternalDineInChannel(context, menus.fixture(), menus.session());
        UUID externalChannel = UUID.fromString(external.path("channelRef").asText());
        assertEquals(
                "STORE",
                external.path("ownerNodeType").asText(),
                "BUSINESS: external DINE_IN channel remains STORE-owned");
        assertTrue(external.path("bindingRef").isTextual(), "BUSINESS: external DINE_IN channel has a real binding");

        String channelListPath =
                "/api/operations/group-workspaces/" + menus.fixture().groupWorkspaceKey() + "/stores/"
                        + menus.fixture().storeId() + "/business-channels?usage=SALES_MENU&pageSize=20";
        BackendAcceptanceTest.Response eligibleChannels = context.get(
                BusinessChannelAcceptanceScenarios.CHANNEL_LIST_STORE,
                channelListPath,
                menus.session().cookie(),
                Set.of(200));
        Set<String> eligibleRefs = nodeRefs(
                requiredJsonNode(
                        eligibleChannels.json(),
                        "/items",
                        JsonNodeType.ARRAY,
                        "BUSINESS: sales-menu candidate read returns a typed collection"),
                "channelRef");
        assertTrue(
                eligibleRefs.contains(eligibleChannel.toString()),
                "BUSINESS: an internal STORE channel remains a sales-menu candidate");
        assertFalse(
                eligibleRefs.contains(externalChannel.toString()),
                "BUSINESS: external DINE_IN is excluded from sales-menu candidates");

        BackendAcceptanceTest.Response directRejected = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", externalChannel, "name", "SM05 external DINE_IN rejected"),
                Set.of(422));
        assertEquals(
                "SALES_MENU_CHANNEL_INELIGIBLE",
                directRejected.problemCode(),
                "BUSINESS: direct sales-menu create rejects external DINE_IN");
    }

    @AcceptanceScenario(
            id = "sales-menu.collection-lifecycle-and-multi-activation",
            module = "SALES_MENU",
            operation = "createOperationsSalesMenu")
    void collectionLifecycleAndMultiActivation(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 2, "SM05 lifecycle");
        UUID firstChannel = menus.channels().get(0);
        UUID secondChannel = menus.channels().get(1);
        List<MenuState> created = new ArrayList<>();
        for (int index = 0; index < 21; index++) {
            created.add(createMenu(context, menus, "SM05 lifecycle " + String.format("%02d", index), firstChannel));
        }

        BackendAcceptanceTest.Response firstPage = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + firstChannel + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                20,
                requiredJsonNode(firstPage.json(), "/items", JsonNodeType.ARRAY, "BUSINESS: lifecycle first page items")
                        .size(),
                "BUSINESS: twenty menus fill the first fixed-size page");
        String cursor = requiredJsonNode(
                        firstPage.json(), "/nextCursor", JsonNodeType.STRING, "BUSINESS: lifecycle first page cursor")
                .asText();
        assertFalse(cursor.isBlank(), "BUSINESS: the lifecycle page exposes a continuation cursor");
        BackendAcceptanceTest.Response secondPage = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + firstChannel + "&pageSize=20&cursor=" + encode(cursor),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                secondPage.json().path("items").size(),
                "BUSINESS: the twenty-first menu is reachable on the continuation page");
        Set<String> pageOneRefs = nodeRefs(firstPage.json().path("items"), "salesMenuRef");
        Set<String> pageTwoRefs = nodeRefs(secondPage.json().path("items"), "salesMenuRef");
        assertTrue(disjoint(pageOneRefs, pageTwoRefs), "BUSINESS: menu pages do not duplicate collection identities");

        BackendAcceptanceTest.Response cursorMismatch = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + secondChannel + "&pageSize=20&cursor=" + encode(cursor),
                menus.session().cookie(),
                Set.of(422));
        assertFalse(
                cursorMismatch.problemCode().isBlank(),
                "BUSINESS: a cursor bound to another channel has a typed rejection");

        MenuState active = created.getFirst();
        long version = setActivation(context, menus, active.ref(), firstChannel, "ENABLED", active.version());
        version = setActivation(context, menus, active.ref(), secondChannel, "ENABLED", version);
        MenuState secondActive = created.get(1);
        long secondActiveVersion =
                setActivation(context, menus, secondActive.ref(), firstChannel, "ENABLED", secondActive.version());
        MenuReadResult firstChannelActive = readMenu(context, menus, active.ref(), firstChannel);
        MenuReadResult secondChannelActive = readMenu(context, menus, secondActive.ref(), firstChannel);
        assertEquals(
                "ENABLED",
                firstChannelActive.json().path("activation").path("status").asText(),
                "BUSINESS: the first menu is enabled for the first channel");
        assertEquals(
                "ENABLED",
                secondChannelActive.json().path("activation").path("status").asText(),
                "BUSINESS: a second menu can be enabled for the same channel");
        assertTrue(secondActiveVersion > 0, "BUSINESS: the second active menu returns a versioned readback");
        version = setActivation(context, menus, active.ref(), firstChannel, "DISABLED", version);
        version = updateSchedule(context, menus, active.ref(), version, dailySchedule());
        version = renameMenu(context, menus, active.ref(), version, "SM05 lifecycle renamed");

        JsonNode item = catalog.acceptanceCreatePlainItem(
                context,
                menus.fixture(),
                menus.session(),
                "SM05-LIFECYCLE-" + UUID.randomUUID().toString().substring(0, 8),
                "SM05 lifecycle item");
        UUID catalogItemRef = UUID.fromString(item.path("itemRef").asText());
        SectionState section = createSection(context, menus, active.ref(), "SM05 lifecycle section", version);
        version = addItems(context, menus, active.ref(), section.ref(), section.menuVersion(), List.of(catalogItemRef));
        ItemState draftItem = findDraftItem(context, menus, active.ref(), section.ref(), catalogItemRef);
        version = updateItem(
                context,
                menus,
                active.ref(),
                draftItem,
                version,
                itemUpdateBody(null, directSale(2800), ordering(1, 1), inheritedMedia(), version));
        draftItem = readDraftItemState(context, menus, active.ref(), draftItem.ref());
        version = publish(context, menus, active.ref(), version);
        MenuReadResult activeDetail = readMenu(context, menus, active.ref(), firstChannel);
        assertEquals(
                "SM05 lifecycle renamed",
                activeDetail.json().path("name").asText(),
                "BUSINESS: an active collection can still be renamed and published");
        assertEquals(
                "DISABLED",
                activeDetail.json().path("activation").path("status").asText(),
                "BUSINESS: a disabled activation does not block edit or publish");
        assertEquals(
                "DAILY_TIME_RANGE",
                activeDetail.json().path("draftSchedule").path("kind").asText(),
                "BUSINESS: the updated draft schedule is read back");
        assertEquals(
                "09:00",
                activeDetail.json().path("draftSchedule").path("startLocalTime").asText(),
                "BUSINESS: the draft schedule start is authoritative");
        assertEquals(
                "22:00",
                activeDetail.json().path("draftSchedule").path("endLocalTime").asText(),
                "BUSINESS: the draft schedule end is authoritative");
        assertEquals(
                "DAILY_TIME_RANGE",
                activeDetail.json().path("latestPublishedSchedule").path("kind").asText(),
                "BUSINESS: the published schedule is read back");
        assertEquals(
                "09:00",
                activeDetail
                        .json()
                        .path("latestPublishedSchedule")
                        .path("startLocalTime")
                        .asText(),
                "BUSINESS: the published schedule start is frozen");
        assertEquals(
                "22:00",
                activeDetail
                        .json()
                        .path("latestPublishedSchedule")
                        .path("endLocalTime")
                        .asText(),
                "BUSINESS: the published schedule end is frozen");
        MenuReadResult activeSecondChannel = readMenu(context, menus, active.ref(), secondChannel);
        assertEquals(
                "ENABLED",
                activeSecondChannel.json().path("activation").path("status").asText(),
                "BUSINESS: a menu activation on another channel remains independent");
        assertEquals(
                1,
                activeDetail.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: a disabled/active lifecycle menu has an immutable first publication");
        assertTrue(
                version > 0 && draftItem.itemVersion() > 0,
                "BUSINESS: lifecycle commands return authoritative aggregate and item versions");

        MenuState archived = created.getLast();
        long archivedVersion = archiveMenu(context, menus, archived.ref(), archived.version());
        MenuReadResult archivedDetail = readMenu(context, menus, archived.ref(), firstChannel);
        assertTrue(
                archivedDetail.json().path("archived").asBoolean(false),
                "BUSINESS: archive is persisted on the collection");
        assertTrue(archivedVersion > 0, "BUSINESS: archive returns a versioned command readback");
        BackendAcceptanceTest.Response archivedList = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + firstChannel + "&query=SM05%20lifecycle%2020&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                archivedList.json().path("items").size(),
                "BUSINESS: archived menus remain in historical list results");
        assertTrue(
                archivedList.json().path("items").get(0).path("archived").asBoolean(false),
                "BUSINESS: historical list marks the archived collection");
    }

    @AcceptanceScenario(
            id = "sales-menu.copy-current-draft-boundary",
            module = "SALES_MENU",
            operation = "copyOperationsSalesMenu")
    void copyCurrentDraftBoundary(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PreparedMenu prepared = preparePlainMenu(context, "SM05 copy");
        MenuFixture menus = prepared.fixture();
        MenuState source = prepared.menu();
        long version = prepared.menuVersion();
        ItemState item = prepared.item();
        JsonNode skuCatalog = catalog.acceptanceCreateSkuItem(
                context, menus.fixture(), menus.session(), "SM05-COPY-SKU-" + suffix(), "SM05 copy SKU");
        JsonNode skuFact = skuCatalog.path("skus").get(0);
        assertNotNull(skuFact, "BUSINESS: copy fixture contains an owner SKU fact");
        UUID skuCatalogRef = UUID.fromString(skuCatalog.path("itemRef").asText());
        UUID skuRef = UUID.fromString(skuFact.path("productSkuRef").asText());
        String skuName = skuFact.path("skuName").asText();
        String skuCode = skuFact.path("skuCode").asText();
        version = addItems(context, menus, source.ref(), prepared.section().ref(), version, List.of(skuCatalogRef));
        ItemState skuItem =
                findDraftItem(context, menus, source.ref(), prepared.section().ref(), skuCatalogRef);
        JsonNode secondCatalog = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-COPY-SECOND-" + suffix(), "SM05 copy second item");
        UUID secondCatalogRef = UUID.fromString(secondCatalog.path("itemRef").asText());
        SectionState secondSection = createSection(context, menus, source.ref(), "SM05 copy second section", version);
        version = secondSection.menuVersion();
        version = addItems(context, menus, source.ref(), secondSection.ref(), version, List.of(secondCatalogRef));
        ItemState secondItem = findDraftItem(context, menus, source.ref(), secondSection.ref(), secondCatalogRef);
        version = updateItem(
                context,
                menus,
                source.ref(),
                item,
                version,
                itemUpdateBody("源菜单展示名", directSale(2800), ordering(1, 1), inheritedMedia(), version));
        item = readDraftItemState(context, menus, source.ref(), item.ref());
        version = updateItem(
                context,
                menus,
                source.ref(),
                skuItem,
                version,
                itemUpdateBody(
                        "源 SKU 已发布",
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(skuRef, skuName, skuCode, 1299, 1200))),
                        ordering(1, 2),
                        inheritedMedia(),
                        version));
        skuItem = readDraftItemState(context, menus, source.ref(), skuItem.ref());
        version = updateItem(
                context,
                menus,
                source.ref(),
                secondItem,
                version,
                itemUpdateBody("源第二项已发布", directSale(3400), ordering(1, 1), inheritedMedia(), version));
        secondItem = readDraftItemState(context, menus, source.ref(), secondItem.ref());
        version = updateSchedule(context, menus, source.ref(), version, dailySchedule());
        version = setActivation(context, menus, source.ref(), menus.channels().getFirst(), "ENABLED", version);
        version = publish(context, menus, source.ref(), version);
        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, source.ref(), item.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("ITEM", item.ref(), "源菜单手工停售", version),
                idempotencyHeaders("sales-menu-source-manual-sold-out"),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", source.ref(), item.ref());
        version = updateItem(
                context,
                menus,
                source.ref(),
                item,
                version,
                itemUpdateBody("源菜单当前草稿", directSale(3100), ordering(2, 3), inheritedMedia(), version));
        item = readDraftItemState(context, menus, source.ref(), item.ref());
        version = updateItem(
                context,
                menus,
                source.ref(),
                skuItem,
                version,
                itemUpdateBody(
                        "源 SKU 当前草稿",
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(skuRef, skuName, skuCode, 1299, 1750))),
                        ordering(2, 4),
                        inheritedMedia(),
                        version));
        skuItem = readDraftItemState(context, menus, source.ref(), skuItem.ref());
        String secondItemDraftName = "源第二项当前草稿";
        Map<String, Object> secondItemDraft =
                itemUpdateBody(secondItemDraftName, directSale(3600), ordering(3, 5), inheritedMedia(), version);
        version = updateItem(context, menus, source.ref(), secondItem, version, secondItemDraft);
        secondItem = readDraftItemState(context, menus, source.ref(), secondItem.ref());

        BackendAcceptanceTest.Response primaryStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                draftItemPath(menus, source.ref(), item.ref()) + "/assets/stage",
                menus.session().cookie(),
                item.itemVersion(),
                "sm05-copy-primary.png",
                "image/png",
                sha256(PNG),
                PNG,
                Set.of(201));
        String primaryAssetRef = requiredJsonNode(
                        primaryStage.json(),
                        "/assetRef",
                        JsonNodeType.STRING,
                        "BUSINESS: copy source custom primary assetRef")
                .asText();
        String primaryBindGrant = requiredJsonNode(
                        primaryStage.json(),
                        "/bindGrant",
                        JsonNodeType.STRING,
                        "BUSINESS: copy source custom primary bindGrant")
                .asText();
        BackendAcceptanceTest.Response secondaryStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                draftItemPath(menus, source.ref(), item.ref()) + "/assets/stage",
                menus.session().cookie(),
                item.itemVersion(),
                "sm05-copy-secondary.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(201));
        String secondaryAssetRef = requiredJsonNode(
                        secondaryStage.json(),
                        "/assetRef",
                        JsonNodeType.STRING,
                        "BUSINESS: copy source custom secondary assetRef")
                .asText();
        String secondaryBindGrant = requiredJsonNode(
                        secondaryStage.json(),
                        "/bindGrant",
                        JsonNodeType.STRING,
                        "BUSINESS: copy source custom secondary bindGrant")
                .asText();
        Map<String, String> copyAssetGrants = Map.of(
                "X-Sales-Menu-Asset-Bind-Grants",
                "{\"" + primaryAssetRef + "\":\"" + primaryBindGrant + "\",\"" + secondaryAssetRef + "\":\""
                        + secondaryBindGrant + "\"}");
        version = updateItem(
                context,
                menus,
                source.ref(),
                item,
                version,
                itemUpdateBody(
                        "源菜单当前草稿",
                        directSale(3100),
                        ordering(2, 3),
                        media(
                                "CUSTOM",
                                List.of(UUID.fromString(primaryAssetRef), UUID.fromString(secondaryAssetRef)),
                                UUID.fromString(primaryAssetRef)),
                        version),
                copyAssetGrants);
        item = readDraftItemState(context, menus, source.ref(), item.ref());
        BackendAcceptanceTest.Response sourceDraftItemRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, source.ref(), item.ref()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                "CUSTOM",
                sourceDraftItemRead.json().path("displayMedia").path("mode").asText(),
                "BUSINESS: source current draft keeps the staged custom media mode");
        assertEquals(
                primaryAssetRef,
                sourceDraftItemRead
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .get(0)
                        .asText(),
                "BUSINESS: source custom media keeps the primary assetRef order");
        assertEquals(
                secondaryAssetRef,
                sourceDraftItemRead
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .get(1)
                        .asText(),
                "BUSINESS: source custom media keeps the secondary assetRef order");
        long sourceAssetCountBeforeCopy = salesMenuImageCount(menus.fixture());
        String sourcePrimaryAssetFacts = assetPhysicalFacts(UUID.fromString(primaryAssetRef));
        String sourceSecondaryAssetFacts = assetPhysicalFacts(UUID.fromString(secondaryAssetRef));

        String sourceName = readMenu(
                        context, menus, source.ref(), menus.channels().getFirst())
                .json()
                .path("name")
                .asText();
        BackendAcceptanceTest.Response copied = context.postCoverageOnly(
                OPERATIONS_SALES_MENU_COPY,
                menuRoot(menus.fixture()) + "/" + source.ref() + "/copies",
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                Set.of(201));
        MenuState copy = new MenuState(
                UUID.fromString(requiredJsonNode(
                                copied.json(),
                                "/salesMenuRef",
                                JsonNodeType.STRING,
                                "BUSINESS: copy returns a new menu reference")
                        .asText()),
                assertCommand(copied, "copyOperationsSalesMenu", null, null));
        assertTrue(!copy.ref().equals(source.ref()), "BUSINESS: copied collection has an independent identity");

        MenuReadResult copyDetail =
                readMenu(context, menus, copy.ref(), menus.channels().getFirst());
        assertEquals(
                sourceName + " 副本",
                copyDetail.json().path("name").asText(),
                "BUSINESS: copy names the new collection from the source");
        assertEquals(
                "DAILY_TIME_RANGE",
                copyDetail.json().path("draftSchedule").path("kind").asText(),
                "BUSINESS: copy carries the current draft schedule");
        assertEquals(
                "09:00",
                copyDetail.json().path("draftSchedule").path("startLocalTime").asText(),
                "BUSINESS: copy carries the current draft schedule start");
        assertEquals(
                "22:00",
                copyDetail.json().path("draftSchedule").path("endLocalTime").asText(),
                "BUSINESS: copy carries the current draft schedule end");
        assertTrue(
                copyDetail.json().path("activation").isNull(),
                "BUSINESS: copy has no activation relation and is therefore default disabled");
        assertTrue(
                copyDetail.json().path("latestPublishedRevision").isNull(),
                "BUSINESS: copy has no copied publication revision");
        assertEquals(
                sourceAssetCountBeforeCopy,
                salesMenuImageCount(menus.fixture()),
                "BUSINESS: copy adds only sales-menu media relations, not Asset rows");
        assertEquals(
                sourcePrimaryAssetFacts,
                assetPhysicalFacts(UUID.fromString(primaryAssetRef)),
                "BUSINESS: copy leaves the primary Asset physical metadata and lifecycle unchanged");
        assertEquals(
                sourceSecondaryAssetFacts,
                assetPhysicalFacts(UUID.fromString(secondaryAssetRef)),
                "BUSINESS: copy leaves the secondary Asset physical metadata and lifecycle unchanged");

        BackendAcceptanceTest.Response copyPublished = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                menuRoot(menus.fixture()) + "/" + copy.ref() + "/published/sections",
                menus.session().cookie(),
                Set.of(404));
        assertEquals(
                "PUBLICATION_NOT_FOUND", copyPublished.problemCode(), "BUSINESS: copy has no published effective view");
        BackendAcceptanceTest.Response copyDraftSections = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + copy.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        List<JsonNode> copiedSections = iterable(copyDraftSections.json().path("items"));
        assertEquals(2, copiedSections.size(), "BUSINESS: copy preserves every current draft section");
        JsonNode copiedFirstSection = copiedSections.getFirst();
        JsonNode copiedSecondSection = copiedSections.get(1);
        UUID copiedSectionRef =
                UUID.fromString(copiedFirstSection.path("salesSectionRef").asText());
        UUID copiedSecondSectionRef =
                UUID.fromString(copiedSecondSection.path("salesSectionRef").asText());
        assertFalse(
                copiedSectionRef.equals(prepared.section().ref()) || copiedSecondSectionRef.equals(secondSection.ref()),
                "BUSINESS: copy creates independent section identities");
        assertEquals(
                "SM05 copy section",
                copiedFirstSection.path("name").asText(),
                "BUSINESS: copy preserves the first section name");
        assertEquals(
                0, copiedFirstSection.path("displayOrder").asLong(), "BUSINESS: copy preserves first section order");
        assertEquals(
                2, copiedFirstSection.path("itemCount").asLong(), "BUSINESS: copy preserves first section item count");
        assertEquals(
                "SM05 copy second section",
                copiedSecondSection.path("name").asText(),
                "BUSINESS: copy preserves the second section name");
        assertEquals(
                1, copiedSecondSection.path("displayOrder").asLong(), "BUSINESS: copy preserves second section order");
        assertEquals(
                1,
                copiedSecondSection.path("itemCount").asLong(),
                "BUSINESS: copy preserves second section item count");
        ItemState copiedItem = findDraftItem(context, menus, copy.ref(), copiedSectionRef, item.catalogRef());
        ItemState copiedSkuItem = findDraftItem(context, menus, copy.ref(), copiedSectionRef, skuCatalogRef);
        ItemState copiedSecondItem =
                findDraftItem(context, menus, copy.ref(), copiedSecondSectionRef, secondCatalogRef);
        assertFalse(
                copiedItem.ref().equals(item.ref()),
                "BUSINESS: copied draft item has an independent sales-item identity");
        assertFalse(
                copiedSkuItem.ref().equals(skuItem.ref()),
                "BUSINESS: copied SKU draft item has an independent sales-item identity");
        assertFalse(
                copiedSecondItem.ref().equals(secondItem.ref()),
                "BUSINESS: copied second draft item has an independent sales-item identity");
        assertEquals(
                List.of(copiedItem.ref().toString(), copiedSkuItem.ref().toString()),
                readAllDraftItemRows(context, menus, copy.ref(), copiedSectionRef).stream()
                        .map(row -> row.path("salesItemRef").asText())
                        .toList(),
                "BUSINESS: copy preserves current draft item order in the first section");
        assertEquals(
                List.of(copiedSecondItem.ref().toString()),
                readAllDraftItemRows(context, menus, copy.ref(), copiedSecondSectionRef).stream()
                        .map(row -> row.path("salesItemRef").asText())
                        .toList(),
                "BUSINESS: copy preserves current draft item order in the second section");
        BackendAcceptanceTest.Response copiedItemRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, copy.ref(), copiedItem.ref()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                3100,
                copiedItemRead
                        .json()
                        .path("saleContent")
                        .path("listedPriceCents")
                        .asInt(),
                "BUSINESS: copy reads the current source draft value, not the old publication");
        assertEquals(
                "源菜单当前草稿",
                copiedItemRead.json().path("displayName").asText(),
                "BUSINESS: copy carries the current draft display-name override");
        assertEquals(
                2,
                copiedItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("minItemQuantity")
                        .asInt(),
                "BUSINESS: copy carries the current draft minimum quantity");
        assertEquals(
                3,
                copiedItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("quantityStep")
                        .asInt(),
                "BUSINESS: copy carries the current draft quantity step");
        assertEquals(
                "CUSTOM",
                copiedItemRead.json().path("displayMedia").path("mode").asText(),
                "BUSINESS: copy carries the current draft custom media mode");
        assertEquals(
                primaryAssetRef,
                copiedItemRead
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .get(0)
                        .asText(),
                "BUSINESS: copy reuses the source primary assetRef in the same order");
        assertEquals(
                secondaryAssetRef,
                copiedItemRead
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .get(1)
                        .asText(),
                "BUSINESS: copy reuses the source secondary assetRef in the same order");
        assertEquals(
                primaryAssetRef,
                copiedItemRead
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: copy preserves the source custom primary assetRef");

        BackendAcceptanceTest.Response copiedSkuItemRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, copy.ref(), copiedSkuItem.ref()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                "源 SKU 当前草稿",
                copiedSkuItemRead.json().path("displayName").asText(),
                "BUSINESS: copy carries the SKU current draft display-name override");
        assertEquals(
                "SKU_SELECTION",
                copiedSkuItemRead.json().path("saleContent").path("kind").asText(),
                "BUSINESS: copy carries the current SKU sale definition kind");
        assertTrue(
                copiedSkuItemRead
                        .json()
                        .path("saleContent")
                        .path("listedPriceCents")
                        .isNull(),
                "BUSINESS: copied SKU sale keeps the public parent price absent");
        assertEquals(
                skuRef.toString(),
                copiedSkuItemRead
                        .json()
                        .path("saleContent")
                        .path("skuPrices")
                        .get(0)
                        .path("skuRef")
                        .asText(),
                "BUSINESS: copy carries the selected SKU identity");
        assertEquals(
                1750,
                copiedSkuItemRead
                        .json()
                        .path("saleContent")
                        .path("skuPrices")
                        .get(0)
                        .path("listedPriceCents")
                        .asInt(),
                "BUSINESS: copy carries the current SKU listed price");
        assertEquals(
                2,
                copiedSkuItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("minItemQuantity")
                        .asInt(),
                "BUSINESS: copy carries the SKU current minimum quantity");
        assertEquals(
                4,
                copiedSkuItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("quantityStep")
                        .asInt(),
                "BUSINESS: copy carries the SKU current quantity step");
        BackendAcceptanceTest.Response copiedSecondItemRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, copy.ref(), copiedSecondItem.ref()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                "源第二项当前草稿",
                copiedSecondItemRead.json().path("displayName").asText(),
                "BUSINESS: copy carries the second item current draft display-name override");
        assertEquals(
                3600,
                copiedSecondItemRead
                        .json()
                        .path("saleContent")
                        .path("listedPriceCents")
                        .asInt(),
                "BUSINESS: copy carries the second item current draft price");
        assertEquals(
                3,
                copiedSecondItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("minItemQuantity")
                        .asInt(),
                "BUSINESS: copy carries the second item minimum quantity");
        assertEquals(
                5,
                copiedSecondItemRead
                        .json()
                        .path("orderingConstraints")
                        .path("quantityStep")
                        .asInt(),
                "BUSINESS: copy carries the second item quantity step");

        BackendAcceptanceTest.Response copyRecords = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, copy.ref(), menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        for (JsonNode record : copyRecords.json().path("items")) {
            String operation = record.path("operationKind").asText();
            assertFalse(
                    operation.equals("publishOperationsSalesMenu")
                            || operation.equals("setOperationsSalesMenuItemSoldOut")
                            || operation.equals("restoreOperationsSalesMenuItemSale"),
                    "BUSINESS: copy operation records do not copy publication or manual-sale history");
        }
        BackendAcceptanceTest.Response sourcePublished = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(
                        menus, source.ref(), item.ref(), menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                "MANUAL_SOLD_OUT",
                sourcePublished.json().path("manualSaleStatus").path("state").asText(),
                "BUSINESS: source manual-sale state remains on the source publication only");
    }

    void calibrationCopyBoundedDraft(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PreparedMenu prepared = preparePlainMenu(context, "CP05 bounded copy");
        MenuFixture menus = prepared.fixture();
        BackendAcceptanceTest.Response copied = context.post(
                OPERATIONS_SALES_MENU_COPY,
                menuRoot(menus.fixture()) + "/" + prepared.menu().ref() + "/copies",
                menus.session().cookie(),
                Map.of("expectedVersion", prepared.menuVersion()),
                Set.of(201));
        UUID copyRef = UUID.fromString(requiredJsonNode(
                        copied.json(),
                        "/salesMenuRef",
                        JsonNodeType.STRING,
                        "BUSINESS: bounded copy returns a new menu reference")
                .asText());
        assertCommand(copied, "copyOperationsSalesMenu", null, null);
        assertFalse(copyRef.equals(prepared.menu().ref()), "BUSINESS: bounded copy creates an independent collection");
    }

    @AcceptanceScenario(
            id = "sales-menu.ordered-sections-and-items",
            module = "SALES_MENU",
            operation = "getOperationsSalesMenuDraftSections")
    void orderedSectionsAndItems(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 ordering");
        MenuState menu = createMenu(
                context, menus, "SM05 ordering menu", menus.channels().getFirst());
        long version = menu.version();
        SectionState first = createSection(context, menus, menu.ref(), "SM05 section A", version);
        version = first.menuVersion();
        SectionState second = createSection(context, menus, menu.ref(), "SM05 section B", version);
        version = second.menuVersion();
        SectionState third = createSection(context, menus, menu.ref(), "SM05 section C", version);
        version = third.menuVersion();

        List<UUID> catalogRefs = new ArrayList<>();
        for (int index = 0; index < 21; index++) {
            JsonNode item = catalog.acceptanceCreatePlainItem(
                    context,
                    menus.fixture(),
                    menus.session(),
                    "SM05-ORDER-" + UUID.randomUUID().toString().substring(0, 8) + "-" + index,
                    "SM05 ordering item " + index);
            catalogRefs.add(UUID.fromString(item.path("itemRef").asText()));
        }

        BackendAcceptanceTest.Response candidatesFirst = context.get(
                OPERATIONS_SALES_MENU_CANDIDATES,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/item-candidates?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                20,
                candidatesFirst.json().path("items").size(),
                "BUSINESS: item candidates use the fixed twenty-row page");
        String candidateCursor = nextCursor(candidatesFirst.json());
        assertFalse(candidateCursor.isBlank(), "BUSINESS: candidates expose a real cursor");
        BackendAcceptanceTest.Response candidatesSecond = context.get(
                OPERATIONS_SALES_MENU_CANDIDATES,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/item-candidates?pageSize=20&cursor="
                        + encode(candidateCursor),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                candidatesSecond.json().path("items").size(),
                "BUSINESS: all twenty-one catalog candidates are reachable");
        Set<String> candidateRefs = new LinkedHashSet<>();
        for (JsonNode candidate : candidatesFirst.json().path("items")) {
            candidateRefs.add(candidate.path("catalogItemRef").asText());
        }
        for (JsonNode candidate : candidatesSecond.json().path("items")) {
            candidateRefs.add(candidate.path("catalogItemRef").asText());
        }
        for (UUID catalogRef : catalogRefs)
            assertTrue(
                    candidateRefs.contains(catalogRef.toString()),
                    "BUSINESS: candidate cursor pages retain each catalog identity");

        version = addItems(context, menus, menu.ref(), first.ref(), version, catalogRefs);
        BackendAcceptanceTest.Response sections = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                List.of(
                        sectionFact(first.ref(), "SM05 section A", 0, 21, false, true),
                        sectionFact(second.ref(), "SM05 section B", 1, 0, true, true),
                        sectionFact(third.ref(), "SM05 section C", 2, 0, true, false)),
                sectionFacts(sections.json()),
                "BUSINESS: three explicit sections have the complete owner order and boundary facts");

        BackendAcceptanceTest.Response itemPage = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menu.ref(), first.ref()) + "?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(20, itemPage.json().path("items").size(), "BUSINESS: draft items use a fixed-size page");
        String itemCursor = nextCursor(itemPage.json());
        assertFalse(itemCursor.isBlank(), "BUSINESS: draft items expose a continuation cursor");
        BackendAcceptanceTest.Response itemPageSecond = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menu.ref(), first.ref()) + "?pageSize=20&cursor=" + encode(itemCursor),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1, itemPageSecond.json().path("items").size(), "BUSINESS: the twenty-first draft item is reachable");

        version = addItems(context, menus, menu.ref(), second.ref(), version, List.of(catalogRefs.getFirst()));
        BackendAcceptanceTest.Response afterDuplicate = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menu.ref(), first.ref()) + "?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        List<JsonNode> allItems = new ArrayList<>();
        allItems.addAll(iterable(afterDuplicate.json().path("items")));
        String afterCursor = nextCursor(afterDuplicate.json());
        if (!afterCursor.isBlank()) {
            BackendAcceptanceTest.Response tail = context.get(
                    OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                    draftItemsPath(menus, menu.ref(), first.ref()) + "?pageSize=20&cursor=" + encode(afterCursor),
                    menus.session().cookie(),
                    Set.of(200));
            allItems.addAll(iterable(tail.json().path("items")));
        }
        BackendAcceptanceTest.Response duplicateSectionPage = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menu.ref(), second.ref()) + "?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        allItems.addAll(iterable(duplicateSectionPage.json().path("items")));
        String duplicateSectionCursor = nextCursor(duplicateSectionPage.json());
        if (!duplicateSectionCursor.isBlank()) {
            BackendAcceptanceTest.Response duplicateSectionTail = context.get(
                    OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                    draftItemsPath(menus, menu.ref(), second.ref()) + "?pageSize=20&cursor="
                            + encode(duplicateSectionCursor),
                    menus.session().cookie(),
                    Set.of(200));
            allItems.addAll(iterable(duplicateSectionTail.json().path("items")));
        }
        List<JsonNode> duplicateRows = allItems.stream()
                .filter(row -> catalogRefs
                        .getFirst()
                        .toString()
                        .equals(row.path("catalogItemRef").asText()))
                .toList();
        assertEquals(
                2,
                duplicateRows.size(),
                "BUSINESS: adding the same catalog item creates two independent menu item rows");
        Set<String> duplicateSalesItemRefs = new LinkedHashSet<>();
        for (JsonNode row : duplicateRows) {
            String salesItemRef = row.path("salesItemRef").asText();
            assertFalse(salesItemRef.isBlank(), "BUSINESS: every duplicate occurrence has a stable sales item ref");
            duplicateSalesItemRefs.add(salesItemRef);
        }
        assertEquals(
                2,
                duplicateSalesItemRefs.size(),
                "BUSINESS: repeated catalog membership creates distinct sales item identities");

        version = addItems(context, menus, menu.ref(), third.ref(), version, List.of(catalogRefs.get(1)));
        List<JsonNode> transientRows = readAllDraftItemRows(context, menus, menu.ref(), third.ref());
        assertEquals(1, transientRows.size(), "BUSINESS: item delete fixture creates one isolated sales item row");
        UUID transientSalesItemRef =
                UUID.fromString(transientRows.getFirst().path("salesItemRef").asText());
        BackendAcceptanceTest.Response deletedItem = context.delete(
                OPERATIONS_SALES_MENU_ITEM_DELETE,
                draftItemPath(menus, menu.ref(), transientSalesItemRef),
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                Set.of(200));
        version = assertCommand(deletedItem, "deleteOperationsSalesMenuItem", menu.ref(), transientSalesItemRef);
        assertTrue(
                readAllDraftItemRows(context, menus, menu.ref(), third.ref()).isEmpty(),
                "BUSINESS: deleting a sales item removes only the addressed item row");

        version = renameSection(context, menus, menu.ref(), second.ref(), version, "SM05 section B renamed");
        version = moveSection(context, menus, menu.ref(), second.ref(), version, "DOWN");
        List<String> expectedSectionsAfterMove = List.of(
                sectionFact(first.ref(), "SM05 section A", 0, 21, false, true),
                sectionFact(third.ref(), "SM05 section C", 1, 0, true, true),
                sectionFact(second.ref(), "SM05 section B renamed", 2, 1, true, false));
        BackendAcceptanceTest.Response sectionsAfterMove = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                expectedSectionsAfterMove,
                sectionFacts(sectionsAfterMove.json()),
                "BUSINESS: section rename and DOWN use the requested identity and authoritative full order");
        BackendAcceptanceTest.Response nonEmptyDelete = context.delete(
                OPERATIONS_SALES_MENU_SECTION_DELETE,
                sectionPath(menus, menu.ref(), first.ref()),
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                Set.of(409));
        assertEquals(
                "SECTION_NOT_EMPTY", nonEmptyDelete.problemCode(), "BUSINESS: a non-empty section cannot be deleted");
        BackendAcceptanceTest.Response sectionsAfterRejectedDelete = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                expectedSectionsAfterMove,
                sectionFacts(sectionsAfterRejectedDelete.json()),
                "BUSINESS: rejected non-empty section deletion leaves every section fact unchanged");
        version = deleteSection(context, menus, menu.ref(), third.ref(), version);
        BackendAcceptanceTest.Response sectionsAfterEmptyDelete = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                List.of(
                        sectionFact(first.ref(), "SM05 section A", 0, 21, false, true),
                        sectionFact(second.ref(), "SM05 section B renamed", 2, 1, true, false)),
                sectionFacts(sectionsAfterEmptyDelete.json()),
                "BUSINESS: deleting the empty section removes only that identity and preserves the remaining order");

        List<JsonNode> itemsBeforeBoundary = readAllDraftItemRows(context, menus, menu.ref(), first.ref());
        assertTrue(
                itemsBeforeBoundary.size() >= 2,
                "BUSINESS: item ordering boundary has at least two authoritative neighboring rows");
        List<String> itemRefsBeforeBoundary = itemsBeforeBoundary.stream()
                .map(row -> row.path("salesItemRef").asText())
                .toList();
        Map<String, Long> itemVersionsBeforeBoundary = new LinkedHashMap<>();
        for (JsonNode row : itemsBeforeBoundary) {
            itemVersionsBeforeBoundary.put(
                    row.path("salesItemRef").asText(), row.path("version").asLong());
        }
        JsonNode firstItem = itemsBeforeBoundary.getFirst();
        UUID firstSalesItemRef = UUID.fromString(firstItem.path("salesItemRef").asText());
        long firstItemVersion = firstItem.path("version").asLong();
        BackendAcceptanceTest.Response boundary = context.post(
                OPERATIONS_SALES_MENU_ITEM_MOVE,
                draftItemPath(menus, menu.ref(), firstSalesItemRef) + "/move",
                menus.session().cookie(),
                Map.of("direction", "UP", "expectedVersion", version),
                Set.of(409));
        assertEquals(
                "MOVE_NOT_ALLOWED",
                boundary.problemCode(),
                "BUSINESS: an item move at the ordering boundary is typed and non-mutating");
        List<JsonNode> itemsAfterRejectedMove = readAllDraftItemRows(context, menus, menu.ref(), first.ref());
        assertEquals(
                itemRefsBeforeBoundary,
                itemsAfterRejectedMove.stream()
                        .map(row -> row.path("salesItemRef").asText())
                        .toList(),
                "BUSINESS: rejected first-item UP leaves the complete item order unchanged");
        for (JsonNode row : itemsAfterRejectedMove) {
            assertEquals(
                    itemVersionsBeforeBoundary.get(row.path("salesItemRef").asText()),
                    row.path("version").asLong(),
                    "BUSINESS: rejected first-item UP leaves every item version unchanged");
        }
        version = moveItem(context, menus, menu.ref(), firstSalesItemRef, version, "DOWN");
        List<JsonNode> reordered = readAllDraftItemRows(context, menus, menu.ref(), first.ref());
        List<String> reorderedRefs =
                reordered.stream().map(row -> row.path("salesItemRef").asText()).toList();
        assertEquals(
                itemsBeforeBoundary.size(),
                reorderedRefs.size(),
                "BUSINESS: item DOWN preserves the complete reachable item cardinality");
        assertEquals(
                new HashSet<>(itemRefsBeforeBoundary),
                new HashSet<>(reorderedRefs),
                "BUSINESS: item DOWN preserves every sales item identity exactly once");
        assertEquals(
                itemRefsBeforeBoundary.get(1),
                reorderedRefs.get(0),
                "BUSINESS: item DOWN moves the former second item to the first position");
        assertEquals(
                itemRefsBeforeBoundary.getFirst(),
                reorderedRefs.get(1),
                "BUSINESS: item DOWN moves the requested former first item to the second position");
        for (JsonNode row : reordered) {
            assertEquals(
                    itemVersionsBeforeBoundary.get(row.path("salesItemRef").asText()),
                    row.path("version").asLong(),
                    "BUSINESS: item DOWN changes order without changing item identity versions");
        }
        assertTrue(firstItemVersion > 0, "BUSINESS: item rows carry their own version");
    }

    @AcceptanceScenario(
            id = "sales-menu.shape-specific-sale-definition",
            module = "SALES_MENU",
            operation = "updateOperationsSalesMenuItem")
    void shapeSpecificSaleDefinition(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 shapes");
        MenuState menu =
                createMenu(context, menus, "SM05 shape menu", menus.channels().getFirst());
        long version = menu.version();
        SectionState section = createSection(context, menus, menu.ref(), "SM05 shape section", version);
        version = section.menuVersion();

        JsonNode direct = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-DIRECT-" + suffix(), "SM05 direct");
        JsonNode weighted = catalog.acceptanceCreateItemWithShape(
                context,
                menus.fixture(),
                menus.session(),
                "SM05-WEIGHTED-" + suffix(),
                "SM05 weighted",
                "STANDARD_SALE_WEIGHED");
        JsonNode composite = catalog.acceptanceCreateItemWithShape(
                context, menus.fixture(), menus.session(), "SM05-COMPOSITE-" + suffix(), "SM05 composite", "COMPOSITE");
        JsonNode service = catalog.acceptanceCreateItemWithShape(
                context, menus.fixture(), menus.session(), "SM05-SERVICE-" + suffix(), "SM05 service", "SERVICE");
        JsonNode sku = catalog.acceptanceCreateSkuItem(
                context, menus.fixture(), menus.session(), "SM05-SKU-" + suffix(), "SM05 sku");
        JsonNode skuFact = sku.path("skus").get(0);
        assertNotNull(skuFact, "BUSINESS: SKU fixture contains an owner SKU fact");
        assertEquals(
                "ENABLED",
                skuFact.path("status").asText(),
                "BUSINESS: shape fixture readback contains the enabled catalog SKU status");
        UUID skuRef = UUID.fromString(skuFact.path("productSkuRef").asText());
        String skuName = skuFact.path("skuName").asText();
        String actualSkuCode = skuFact.path("skuCode").asText();

        List<JsonNode> catalogItems = List.of(direct, weighted, composite, service, sku);
        List<UUID> catalogRefs = catalogItems.stream()
                .map(item -> UUID.fromString(item.path("itemRef").asText()))
                .toList();
        version = addItems(context, menus, menu.ref(), section.ref(), version, catalogRefs);
        List<ItemState> items = new ArrayList<>();
        for (UUID catalogRef : catalogRefs) {
            items.add(findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef));
        }

        List<Map<String, Object>> contents = List.of(
                directSale(1900),
                saleContent("WEIGHTED", 4500L, List.of()),
                saleContent("COMPOSITE", 5200L, List.of()),
                directSale(3300),
                saleContent("SKU_SELECTION", null, List.of(skuPrice(skuRef, skuName, actualSkuCode, 1299, 1599))));
        List<String> expectedShapes = List.of("ORDINARY", "WEIGHTED", "COMPOSITE", "SERVICE", "SKU");
        for (int index = 0; index < items.size(); index++) {
            ItemState item = items.get(index);
            version = updateItem(
                    context,
                    menus,
                    menu.ref(),
                    item,
                    version,
                    itemUpdateBody(
                            null,
                            contents.get(index),
                            ordering(index == 1 ? null : 1, index == 1 ? null : 1),
                            inheritedMedia(),
                            version));
            ItemState read = readDraftItemState(context, menus, menu.ref(), item.ref());
            BackendAcceptanceTest.Response readback = context.get(
                    OPERATIONS_SALES_MENU_DRAFT_ITEM,
                    draftItemPath(menus, menu.ref(), read.ref()),
                    menus.session().cookie(),
                    Set.of(200));
            assertEquals(
                    expectedShapes.get(index),
                    readback.json().path("productShape").asText(),
                    "BUSINESS: sale definition preserves the catalog product shape");
            assertEquals(
                    contents.get(index).get("kind"),
                    readback.json().path("saleContent").path("kind").asText(),
                    "BUSINESS: shape-specific sale kind is persisted");
            if (index == 1) {
                assertTrue(
                        readback.json()
                                .path("orderingConstraints")
                                .path("minItemQuantity")
                                .isNull(),
                        "BUSINESS: weighted sale keeps nullable ordering bounds");
                assertTrue(
                        readback.json()
                                .path("orderingConstraints")
                                .path("quantityStep")
                                .isNull(),
                        "BUSINESS: weighted sale keeps nullable quantity step");
                JsonNode expectedUnit = weighted.path("salesUnit");
                JsonNode actualUnit = readback.json().path("saleContent").path("salesUnit");
                assertTrue(expectedUnit.isObject(), "BUSINESS: weighted fixture exposes a Catalog sales unit");
                assertEquals(
                        expectedUnit.path("unitRef").asText(),
                        actualUnit.path("unitRef").asText(),
                        "BUSINESS: weighted sale reads the Catalog unit reference");
                assertEquals(
                        expectedUnit.path("code").asText(),
                        actualUnit.path("code").asText(),
                        "BUSINESS: weighted sale reads the Catalog unit code");
                assertEquals(
                        expectedUnit.path("name").asText(),
                        actualUnit.path("name").asText(),
                        "BUSINESS: weighted sale reads the Catalog unit name");
                assertEquals(
                        expectedUnit.path("unitDimension").asText(),
                        actualUnit.path("unitDimension").asText(),
                        "BUSINESS: weighted sale reads the Catalog unit dimension");
                assertEquals(
                        expectedUnit.path("precision").asInt(),
                        actualUnit.path("precision").asInt(),
                        "BUSINESS: weighted sale reads the Catalog unit precision");
            }
            if (index == 4) {
                assertTrue(
                        readback.json()
                                .path("saleContent")
                                .path("listedPriceCents")
                                .isNull(),
                        "BUSINESS: SKU selection does not expose a public parent price");
                assertEquals(
                        skuRef.toString(),
                        readback.json()
                                .path("saleContent")
                                .path("skuPrices")
                                .get(0)
                                .path("skuRef")
                                .asText(),
                        "BUSINESS: SKU sale keeps the owner SKU identity");
                assertEquals(
                        1599,
                        readback.json()
                                .path("saleContent")
                                .path("skuPrices")
                                .get(0)
                                .path("listedPriceCents")
                                .asInt(),
                        "BUSINESS: SKU sale keeps its per-SKU listed price");
            }
        }
        assertTrue(version > menu.version(), "BUSINESS: each shape update advances the menu aggregate CAS version");
    }

    @AcceptanceScenario(
            id = "sales-menu.sku-subset-selection-and-repeat-item",
            module = "SALES_MENU",
            operation = "updateOperationsSalesMenuItem")
    void skuSubsetSelectionAndRepeatItem(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 SKU subset");
        MenuState menu = createMenu(
                context, menus, "SM05 SKU subset menu", menus.channels().getFirst());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 SKU subset section", menu.version());
        JsonNode catalogItem = catalog.acceptanceCreateSkuItemWithTwoEnabledSkus(
                context, menus.fixture(), menus.session(), "SM05-SKU-SUBSET-" + suffix(), "SM05 SKU subset");
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        List<JsonNode> skuFacts = iterable(catalogItem.path("skus"));
        assertEquals(2, skuFacts.size(), "BUSINESS: SKU subset fixture has two owner SKU facts");
        for (JsonNode sku : skuFacts)
            assertEquals("ENABLED", sku.path("status").asText(), "BUSINESS: both SKU subset facts are enabled");

        long version = addItems(
                context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef, catalogRef));
        List<ItemState> items = findDraftItems(context, menus, menu.ref(), section.ref(), catalogRef);
        assertEquals(2, items.size(), "BUSINESS: one Catalog product can occur in two SalesItems");
        assertFalse(
                items.get(0).ref().equals(items.get(1).ref()),
                "BUSINESS: repeated SalesItems have distinct identities");
        JsonNode firstSku = skuFacts.get(0);
        JsonNode secondSku = skuFacts.get(1);
        version = updateItem(
                context,
                menus,
                menu.ref(),
                items.get(0),
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(firstSku, 1599L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateItem(
                context,
                menus,
                menu.ref(),
                items.get(1),
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(secondSku, 1799L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);

        JsonNode published = publishedItemsForFirstSection(
                context, menus, menu.ref(), menus.channels().getFirst());
        assertEquals(2, published.path("items").size(), "BUSINESS: both repeated SalesItems are published");
        Set<String> publishedSkuRefs = new LinkedHashSet<>();
        Map<String, Long> expectedPrices = Map.of(
                firstSku.path("productSkuRef").asText(), 1599L,
                secondSku.path("productSkuRef").asText(), 1799L);
        for (JsonNode row : published.path("items")) {
            assertEquals(
                    catalogRef.toString(),
                    row.path("catalogItemRef").asText(),
                    "BUSINESS: both rows retain Catalog identity");
            assertEquals(
                    "SKU_SELECTION",
                    row.path("saleContent").path("kind").asText(),
                    "BUSINESS: rows retain SKU sale kind");
            JsonNode prices = row.path("saleContent").path("skuPrices");
            assertEquals(1, prices.size(), "BUSINESS: each SalesItem publishes one selected SKU subset");
            JsonNode price = prices.get(0);
            String skuRef = price.path("skuRef").asText();
            assertTrue(publishedSkuRefs.add(skuRef), "BUSINESS: repeated SalesItems publish disjoint SKU subsets");
            assertEquals(
                    expectedPrices.get(skuRef),
                    price.path("listedPriceCents").asLong(),
                    "BUSINESS: each SKU keeps its independent listed price");
            assertTrue(
                    row.path("saleContent").path("selectedOrderOptions").isArray(),
                    "CONTRACT: SKU row carries an explicit empty option snapshot");
            assertEquals(
                    0,
                    row.path("saleContent").path("selectedOrderOptions").size(),
                    "BUSINESS: SKU sale has no option snapshot");
        }
        assertEquals(2, publishedSkuRefs.size(), "BUSINESS: selected SKU subsets cover both distinct owner SKUs");
        assertTrue(version > menu.version(), "BUSINESS: SKU subset publication advances the menu version");
    }

    @AcceptanceScenario(
            id = "sales-menu.order-option-subset-selection",
            module = "SALES_MENU",
            operation = "updateOperationsSalesMenuItem")
    void orderOptionSubsetSelection(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 option subset");
        MenuState menu = createMenu(
                context, menus, "SM05 option subset menu", menus.channels().getFirst());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 option subset section", menu.version());
        JsonNode catalogItem = catalog.acceptanceCreateOrderOptionItem(
                context, menus.fixture(), menus.session(), "SM05-OPTION-SUBSET-" + suffix(), "SM05 option subset");
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        JsonNode required = catalogItem.path("orderOptionConfigs").get(0);
        JsonNode optional = catalogItem.path("orderOptionConfigs").get(1);
        assertTrue(required.path("required").asBoolean(), "BUSINESS: option fixture exposes a required group");
        assertFalse(optional.path("required").asBoolean(), "BUSINESS: option fixture exposes an optional group");

        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState item = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        List<Map<String, Object>> selections =
                List.of(optionSelection(required, List.of(1)), optionSelection(optional, List.of()));
        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("DIRECT", 2400L, List.of(), selections),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        JsonNode draft = context.get(
                        OPERATIONS_SALES_MENU_DRAFT_ITEM,
                        draftItemPath(menus, menu.ref(), item.ref()),
                        menus.session().cookie(),
                        Set.of(200))
                .json();
        JsonNode draftOptions = draft.path("saleContent").path("selectedOrderOptions");
        assertEquals(2, draftOptions.size(), "BUSINESS: draft readback preserves every option group");
        assertEquals(
                1,
                optionByDefinition(draftOptions, required).path("values").size(),
                "BUSINESS: required subset keeps one selected value");
        assertEquals(
                0,
                optionByDefinition(draftOptions, optional).path("values").size(),
                "BUSINESS: optional group can be saved with zero selected values");
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);
        JsonNode published = publishedItem(
                context, menus, menu.ref(), item.ref(), menus.channels().getFirst());
        JsonNode selected = published.path("saleContent").path("selectedOrderOptions");
        assertEquals(2, selected.size(), "BUSINESS: publication preserves the option group snapshot");
        assertEquals(
                1,
                optionByDefinition(selected, required).path("values").size(),
                "BUSINESS: published required option subset is exact");
        assertEquals(
                required.path("values").get(1).path("definitionValueRef").asText(),
                optionByDefinition(selected, required)
                        .path("values")
                        .get(0)
                        .path("definitionValueRef")
                        .asText(),
                "BUSINESS: published required selection keeps the selected owner value identity");
        assertEquals(
                0,
                optionByDefinition(selected, optional).path("values").size(),
                "BUSINESS: published optional zero selection stays empty");
        assertEquals(
                2400,
                published.path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: ordinary item keeps its menu price");
        assertTrue(version > menu.version(), "BUSINESS: option subset publication advances the menu version");
    }

    @AcceptanceScenario(
            id = "sales-menu.child-target-manual-status",
            module = "SALES_MENU",
            operation = "setOperationsSalesMenuItemSoldOut")
    void childTargetManualStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 child targets");
        MenuState menu = createMenu(
                context, menus, "SM05 child target menu", menus.channels().getFirst());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 child target section", menu.version());
        JsonNode skuCatalog = catalog.acceptanceCreateSkuItemWithTwoEnabledSkus(
                context, menus.fixture(), menus.session(), "SM05-CHILD-SKU-" + suffix(), "SM05 child SKU");
        JsonNode optionCatalog = catalog.acceptanceCreateOrderOptionItem(
                context, menus.fixture(), menus.session(), "SM05-CHILD-OPTION-" + suffix(), "SM05 child option");
        UUID skuCatalogRef = UUID.fromString(skuCatalog.path("itemRef").asText());
        UUID optionCatalogRef = UUID.fromString(optionCatalog.path("itemRef").asText());
        long version = addItems(
                context,
                menus,
                menu.ref(),
                section.ref(),
                section.menuVersion(),
                List.of(skuCatalogRef, optionCatalogRef));
        List<ItemState> items = readAllDraftItemRows(context, menus, menu.ref(), section.ref()).stream()
                .map(SalesMenuAcceptanceScenarios::itemState)
                .toList();
        assertEquals(2, items.size(), "BUSINESS: child target fixture creates two SalesItems");
        ItemState skuItem = items.stream()
                .filter(item -> item.catalogRef().equals(skuCatalogRef))
                .findFirst()
                .orElseThrow();
        ItemState optionItem = items.stream()
                .filter(item -> item.catalogRef().equals(optionCatalogRef))
                .findFirst()
                .orElseThrow();
        JsonNode skuFact = skuCatalog.path("skus").get(0);
        JsonNode required = optionCatalog.path("orderOptionConfigs").get(0);
        version = updateItem(
                context,
                menus,
                menu.ref(),
                skuItem,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(skuFact, 1599L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateItem(
                context,
                menus,
                menu.ref(),
                optionItem,
                version,
                itemUpdateBody(
                        null,
                        saleContent(
                                "DIRECT",
                                2600L,
                                List.of(),
                                List.of(
                                        optionSelection(required, List.of(0)),
                                        optionSelection(
                                                optionCatalog
                                                        .path("orderOptionConfigs")
                                                        .get(1),
                                                List.of()))),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);

        JsonNode skuPublished = publishedItem(
                context, menus, menu.ref(), skuItem.ref(), menus.channels().getFirst());
        JsonNode optionPublished = publishedItem(
                context, menus, menu.ref(), optionItem.ref(), menus.channels().getFirst());
        UUID skuTargetRef = UUID.fromString(skuPublished
                .path("saleContent")
                .path("skuPrices")
                .get(0)
                .path("skuRef")
                .asText());
        UUID optionTargetRef = UUID.fromString(
                optionByDefinition(optionPublished.path("saleContent").path("selectedOrderOptions"), required)
                        .path("values")
                        .get(0)
                        .path("definitionValueRef")
                        .asText());
        JsonNode skuInventoryBefore = skuPublished.path("inventoryAvailability").deepCopy();
        JsonNode optionInventoryBefore =
                optionPublished.path("inventoryAvailability").deepCopy();
        assertEquals(
                "NORMAL",
                manualTargetStatus(skuPublished, "SKU", skuTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: selected SKU target starts normal");
        assertEquals(
                "NORMAL",
                manualTargetStatus(optionPublished, "ORDER_OPTION_VALUE", optionTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: selected option value target starts normal");

        BackendAcceptanceTest.Response skuSoldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, menu.ref(), skuItem.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("SKU", skuTargetRef, "规格暂停售卖", version),
                idempotencyHeaders("sales-menu-child-sku-sold-out"),
                Set.of(200));
        version = assertCommand(skuSoldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), skuTargetRef);
        skuPublished = publishedItem(
                context, menus, menu.ref(), skuItem.ref(), menus.channels().getFirst());
        assertEquals(
                "NORMAL",
                skuPublished.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: SKU target stop does not change parent ITEM status");
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualTargetStatus(skuPublished, "SKU", skuTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: SKU target stop is read back on the child row");
        assertEquals(
                skuInventoryBefore,
                skuPublished.path("inventoryAvailability"),
                "BUSINESS: SKU target stop does not rewrite inventory availability");

        BackendAcceptanceTest.Response optionSoldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, menu.ref(), optionItem.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("ORDER_OPTION_VALUE", optionTargetRef, "加料暂停售卖", version),
                idempotencyHeaders("sales-menu-child-option-sold-out"),
                Set.of(200));
        version = assertCommand(optionSoldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), optionTargetRef);
        optionPublished = publishedItem(
                context, menus, menu.ref(), optionItem.ref(), menus.channels().getFirst());
        assertEquals(
                "NORMAL",
                optionPublished.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: option target stop does not change parent ITEM status");
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualTargetStatus(optionPublished, "ORDER_OPTION_VALUE", optionTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: option target stop is read back on the child row");
        assertEquals(
                optionInventoryBefore,
                optionPublished.path("inventoryAvailability"),
                "BUSINESS: option target stop does not rewrite inventory availability");

        BackendAcceptanceTest.Response optionRestored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(
                        menus, menu.ref(), optionItem.ref(), menus.channels().getFirst(), "manual-restore"),
                menus.session().cookie(),
                manualRestoreCommandBody("ORDER_OPTION_VALUE", optionTargetRef, version),
                idempotencyHeaders("sales-menu-child-option-restore"),
                Set.of(200));
        version = assertCommand(optionRestored, "restoreOperationsSalesMenuItemSale", menu.ref(), optionTargetRef);
        BackendAcceptanceTest.Response skuRestored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(
                        menus, menu.ref(), skuItem.ref(), menus.channels().getFirst(), "manual-restore"),
                menus.session().cookie(),
                manualRestoreCommandBody("SKU", skuTargetRef, version),
                idempotencyHeaders("sales-menu-child-sku-restore"),
                Set.of(200));
        version = assertCommand(skuRestored, "restoreOperationsSalesMenuItemSale", menu.ref(), skuTargetRef);
        assertEquals(
                "NORMAL",
                manualTargetStatus(
                                publishedItem(
                                        context,
                                        menus,
                                        menu.ref(),
                                        skuItem.ref(),
                                        menus.channels().getFirst()),
                                "SKU",
                                skuTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: SKU child restore is independent and exact");
        assertEquals(
                "NORMAL",
                manualTargetStatus(
                                publishedItem(
                                        context,
                                        menus,
                                        menu.ref(),
                                        optionItem.ref(),
                                        menus.channels().getFirst()),
                                "ORDER_OPTION_VALUE",
                                optionTargetRef)
                        .path("state")
                        .asText(),
                "BUSINESS: option child restore is independent and exact");

        BackendAcceptanceTest.Response records = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, menu.ref(), menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertTargetOperationRecord(records.json().path("items"), skuTargetRef, "SKU");
        assertTargetOperationRecord(records.json().path("items"), optionTargetRef, "ORDER_OPTION_VALUE");
        assertTrue(version > 0, "BUSINESS: child target commands preserve a versioned menu aggregate");
    }

    @AcceptanceScenario(
            id = "sales-menu.publish-detaches-removed-target-status",
            module = "SALES_MENU",
            operation = "publishOperationsSalesMenu")
    void publishDetachesRemovedTargetStatus(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 target detach");
        MenuState menu = createMenu(
                context, menus, "SM05 target detach menu", menus.channels().getFirst());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 target detach section", menu.version());
        JsonNode catalogItem = catalog.acceptanceCreateSkuItemWithTwoEnabledSkus(
                context, menus.fixture(), menus.session(), "SM05-DETACH-SKU-" + suffix(), "SM05 target detach SKU");
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        JsonNode firstSku = catalogItem.path("skus").get(0);
        JsonNode secondSku = catalogItem.path("skus").get(1);
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState item = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(firstSku, 1599L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);
        UUID firstSkuRef = UUID.fromString(firstSku.path("productSkuRef").asText());
        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, menu.ref(), item.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("SKU", firstSkuRef, "旧规格暂停售卖", version),
                idempotencyHeaders("sales-menu-detach-sold-out"),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), firstSkuRef);
        JsonNode firstPublished = publishedItem(
                context, menus, menu.ref(), item.ref(), menus.channels().getFirst());
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualTargetStatus(firstPublished, "SKU", firstSkuRef)
                        .path("state")
                        .asText(),
                "BUSINESS: initial published SKU target is sold out");

        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(secondSku, 1799L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = publish(context, menus, menu.ref(), version);
        UUID secondSkuRef = UUID.fromString(secondSku.path("productSkuRef").asText());
        JsonNode secondPublished = publishedItem(
                context, menus, menu.ref(), item.ref(), menus.channels().getFirst());
        assertFalse(
                hasManualTargetStatus(secondPublished, "SKU", firstSkuRef),
                "BUSINESS: removing a child from the next publication removes its current status row");
        assertEquals(
                "NORMAL",
                manualTargetStatus(secondPublished, "SKU", secondSkuRef)
                        .path("state")
                        .asText(),
                "BUSINESS: a newly published child target starts normal");
        assertFalse(
                secondPublished.toString().contains("TARGET_DETACHED_BY_PUBLICATION"),
                "BUSINESS: publication does not create a detached-target event fact");

        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(firstSku, 1699L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = publish(context, menus, menu.ref(), version);
        JsonNode readded = publishedItem(
                context, menus, menu.ref(), item.ref(), menus.channels().getFirst());
        assertEquals(
                "NORMAL",
                manualTargetStatus(readded, "SKU", firstSkuRef).path("state").asText(),
                "BUSINESS: re-adding a previously removed child does not resurrect its old manual status");
        assertTrue(version > 0, "BUSINESS: target-detach publications preserve a versioned menu aggregate");
    }

    @AcceptanceScenario(
            id = "sales-menu.target-status-inventory-independence",
            module = "SALES_MENU",
            operation = "setOperationsSalesMenuItemSoldOut")
    void targetStatusInventoryIndependence(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Set<String> capabilities = new HashSet<>(STORE_CAPABILITIES);
        capabilities.add("EDIT_STORE_INVENTORY");
        MenuFixture menus = menuFixture(context, 1, "SM05 target inventory", capabilities);
        MenuState menu = createMenu(
                context, menus, "SM05 target inventory menu", menus.channels().getFirst());
        SectionState section =
                createSection(context, menus, menu.ref(), "SM05 target inventory section", menu.version());
        JsonNode inventoryCatalog = catalog.acceptanceCreateInventoryBackedPlainItem(
                context, menus.fixture(), menus.session(), "SM05-TARGET-INV-" + suffix(), "SM05 target inventory item");
        JsonNode skuCatalog = catalog.acceptanceCreateSkuItemWithTwoEnabledSkus(
                context, menus.fixture(), menus.session(), "SM05-TARGET-SKU-" + suffix(), "SM05 target SKU item");
        UUID inventoryCatalogRef =
                UUID.fromString(inventoryCatalog.path("itemRef").asText());
        UUID skuCatalogRef = UUID.fromString(skuCatalog.path("itemRef").asText());
        long version = addItems(
                context,
                menus,
                menu.ref(),
                section.ref(),
                section.menuVersion(),
                List.of(inventoryCatalogRef, skuCatalogRef));
        List<JsonNode> draftRows = readAllDraftItemRows(context, menus, menu.ref(), section.ref());
        ItemState inventoryItem = draftRows.stream()
                .map(SalesMenuAcceptanceScenarios::itemState)
                .filter(item -> item.catalogRef().equals(inventoryCatalogRef))
                .findFirst()
                .orElseThrow();
        ItemState skuItem = draftRows.stream()
                .map(SalesMenuAcceptanceScenarios::itemState)
                .filter(item -> item.catalogRef().equals(skuCatalogRef))
                .findFirst()
                .orElseThrow();
        version = updateItem(
                context,
                menus,
                menu.ref(),
                inventoryItem,
                version,
                itemUpdateBody(null, directSale(2200L), ordering(1, 1), inheritedMedia(), version));
        JsonNode skuFact = skuCatalog.path("skus").get(0);
        version = updateItem(
                context,
                menus,
                menu.ref(),
                skuItem,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(skuFact, 1600L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        catalog.acceptanceConfigureInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                inventoryCatalog,
                false,
                "0",
                "sales-menu-target-inv-config");
        catalog.acceptanceCountInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                inventoryCatalog,
                "1",
                false,
                "sales-menu-target-inv-available");
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);

        JsonNode available = publishedItem(
                context,
                menus,
                menu.ref(),
                inventoryItem.ref(),
                menus.channels().getFirst());
        UUID itemTargetRef = inventoryItem.ref();
        JsonNode availableInventory = available.path("inventoryAvailability").deepCopy();
        assertEquals(
                "AVAILABLE",
                availableInventory.path("state").asText(),
                "BUSINESS: inventory owner reports the item as available");
        BackendAcceptanceTest.Response itemSoldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, menu.ref(), inventoryItem.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("ITEM", itemTargetRef, "父销售项暂停售卖", version),
                idempotencyHeaders("sales-menu-target-item-sold-out"),
                Set.of(200));
        version = assertCommand(itemSoldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), itemTargetRef);
        JsonNode itemManual = publishedItem(
                context,
                menus,
                menu.ref(),
                inventoryItem.ref(),
                menus.channels().getFirst());
        assertEquals(
                "MANUAL_SOLD_OUT",
                itemManual.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: ITEM manual stop is its own fact");
        assertEquals(
                availableInventory,
                itemManual.path("inventoryAvailability"),
                "BUSINESS: ITEM manual stop does not rewrite inventory fact");

        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), inventoryCatalog, "0", true, "sales-menu-target-inv-out");
        JsonNode bothUnavailable = publishedItem(
                context,
                menus,
                menu.ref(),
                inventoryItem.ref(),
                menus.channels().getFirst());
        assertEquals(
                "AUTO_UNAVAILABLE",
                bothUnavailable.path("inventoryAvailability").path("state").asText(),
                "BUSINESS: inventory independently becomes auto unavailable");
        assertEquals(
                "MANUAL_SOLD_OUT",
                bothUnavailable.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: auto-unavailable does not replace ITEM manual stop");
        BackendAcceptanceTest.Response itemRestored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(
                        menus, menu.ref(), inventoryItem.ref(), menus.channels().getFirst(), "manual-restore"),
                menus.session().cookie(),
                manualRestoreCommandBody("ITEM", itemTargetRef, version),
                idempotencyHeaders("sales-menu-target-item-restore"),
                Set.of(200));
        version = assertCommand(itemRestored, "restoreOperationsSalesMenuItemSale", menu.ref(), itemTargetRef);
        JsonNode restoredItem = publishedItem(
                context,
                menus,
                menu.ref(),
                inventoryItem.ref(),
                menus.channels().getFirst());
        assertEquals(
                "NORMAL",
                restoredItem.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: ITEM restore changes only the manual fact");
        assertEquals(
                "AUTO_UNAVAILABLE",
                restoredItem.path("inventoryAvailability").path("state").asText(),
                "BUSINESS: ITEM restore does not auto-restore inventory");

        UUID skuTargetRef = UUID.fromString(publishedItem(
                        context,
                        menus,
                        menu.ref(),
                        skuItem.ref(),
                        menus.channels().getFirst())
                .path("saleContent")
                .path("skuPrices")
                .get(0)
                .path("skuRef")
                .asText());
        JsonNode skuBefore = publishedItem(
                context, menus, menu.ref(), skuItem.ref(), menus.channels().getFirst());
        BackendAcceptanceTest.Response skuSoldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, menu.ref(), skuItem.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("SKU", skuTargetRef, "规格暂停售卖", version),
                idempotencyHeaders("sales-menu-target-sku-sold-out"),
                Set.of(200));
        version = assertCommand(skuSoldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), skuTargetRef);
        JsonNode skuAfter = publishedItem(
                context, menus, menu.ref(), skuItem.ref(), menus.channels().getFirst());
        assertEquals(
                "NORMAL",
                skuAfter.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: SKU manual stop does not change parent ITEM manual fact");
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualTargetStatus(skuAfter, "SKU", skuTargetRef).path("state").asText(),
                "BUSINESS: SKU manual stop is a child fact");
        assertEquals(
                skuBefore.path("inventoryAvailability"),
                skuAfter.path("inventoryAvailability"),
                "BUSINESS: SKU manual stop does not rewrite inventory fact");
        assertTrue(version > 0, "BUSINESS: target and inventory facts keep an authoritative version");
    }

    @AcceptanceScenario(
            id = "sales-menu.selection-negative-boundaries",
            module = "SALES_MENU",
            operation = "updateOperationsSalesMenuItem")
    void selectionNegativeBoundaries(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 selection negatives");
        MenuState menu = createMenu(
                context, menus, "SM05 selection negative menu", menus.channels().getFirst());
        SectionState section =
                createSection(context, menus, menu.ref(), "SM05 selection negative section", menu.version());
        JsonNode catalogItem = catalog.acceptanceCreateOrderOptionItem(
                context,
                menus.fixture(),
                menus.session(),
                "SM05-SELECTION-NEGATIVE-" + suffix(),
                "SM05 selection negative");
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        JsonNode required = catalogItem.path("orderOptionConfigs").get(0);
        JsonNode optional = catalogItem.path("orderOptionConfigs").get(1);
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState item = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        JsonNode before = context.get(
                        OPERATIONS_SALES_MENU_DRAFT_ITEM,
                        draftItemPath(menus, menu.ref(), item.ref()),
                        menus.session().cookie(),
                        Set.of(200))
                .json()
                .deepCopy();
        Map<String, Object> requiredSelected = optionSelection(required, List.of(0));
        Map<String, Object> optionalEmpty = optionSelection(optional, List.of());
        Map<String, List<Map<String, Object>>> mutations = new LinkedHashMap<>();
        mutations.put("required-empty", List.of(optionSelection(required, List.of()), optionalEmpty));
        mutations.put("missing-definition", List.of(requiredSelected));
        mutations.put(
                "extra-definition",
                List.of(requiredSelected, optionalEmpty, optionSelection(UUID.randomUUID(), List.of())));
        mutations.put("duplicate-definition", List.of(requiredSelected, requiredSelected, optionalEmpty));
        mutations.put("duplicate-value", List.of(optionSelection(required, List.of(0, 0)), optionalEmpty));
        mutations.put(
                "unknown-value",
                List.of(
                        optionSelection(
                                UUID.fromString(required.path("definitionRef").asText()),
                                List.of(
                                        UUID.fromString(required.path("values")
                                                .get(0)
                                                .path("definitionValueRef")
                                                .asText()),
                                        UUID.randomUUID())),
                        optionalEmpty));
        Map<String, String> expectedMutationCodes = new LinkedHashMap<>();
        expectedMutationCodes.put("required-empty", "SALES_MENU_ORDER_OPTION_SELECTION_INVALID");
        expectedMutationCodes.put("missing-definition", "SALES_MENU_ORDER_OPTION_SELECTION_INVALID");
        expectedMutationCodes.put("extra-definition", "SALES_MENU_ORDER_OPTION_SELECTION_INVALID");
        expectedMutationCodes.put("duplicate-definition", "SALES_MENU_ORDER_OPTION_SELECTION_INVALID");
        expectedMutationCodes.put("duplicate-value", "SALES_MENU_ORDER_OPTION_SELECTION_INVALID");
        expectedMutationCodes.put("unknown-value", "SALES_MENU_ORDER_OPTION_REFERENCE_INVALID");
        for (Map.Entry<String, List<Map<String, Object>>> mutation : mutations.entrySet()) {
            BackendAcceptanceTest.Response rejected = context.put(
                    OPERATIONS_SALES_MENU_ITEM_UPDATE,
                    draftItemPath(menus, menu.ref(), item.ref()),
                    menus.session().cookie(),
                    itemUpdateBody(
                            null,
                            saleContent("DIRECT", 2300L, List.of(), mutation.getValue()),
                            ordering(1, 1),
                            inheritedMedia(),
                            version),
                    idempotencyHeaders("sales-menu-selection-" + mutation.getKey()),
                    Set.of(422));
            assertEquals(
                    expectedMutationCodes.get(mutation.getKey()),
                    rejected.problemCode(),
                    "BUSINESS: " + mutation.getKey() + " uses the typed option-selection problem");
            assertEquals(
                    before,
                    context.get(
                                    OPERATIONS_SALES_MENU_DRAFT_ITEM,
                                    draftItemPath(menus, menu.ref(), item.ref()),
                                    menus.session().cookie(),
                                    Set.of(200))
                            .json(),
                    "BUSINESS: " + mutation.getKey() + " does not mutate the draft item");
            assertEquals(
                    version,
                    readMenu(context, menus, menu.ref(), menus.channels().getFirst())
                            .json()
                            .path("version")
                            .asLong(),
                    "BUSINESS: " + mutation.getKey() + " does not advance the menu version");
        }

        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("DIRECT", 2300L, List.of(), List.of(requiredSelected, optionalEmpty)),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        JsonNode saved = context.get(
                        OPERATIONS_SALES_MENU_DRAFT_ITEM,
                        draftItemPath(menus, menu.ref(), item.ref()),
                        menus.session().cookie(),
                        Set.of(200))
                .json();
        JsonNode savedOptions = saved.path("saleContent").path("selectedOrderOptions");
        assertEquals(
                1,
                optionByDefinition(savedOptions, required).path("values").size(),
                "BUSINESS: valid required selection is saved after negative probes");
        assertEquals(
                0,
                optionByDefinition(savedOptions, optional).path("values").size(),
                "BUSINESS: valid optional empty selection is accepted");
        assertTrue(version > 0, "BUSINESS: valid option selection advances the menu version");
    }

    @AcceptanceScenario(
            id = "sales-menu.disabled-sku-is-not-selectable",
            module = "SALES_MENU",
            operation = "updateOperationsSalesMenuItem")
    void disabledSkuIsNotSelectable(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 disabled SKU");
        MenuState menu = createMenu(
                context, menus, "SM05 disabled SKU menu", menus.channels().getFirst());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 disabled SKU section", menu.version());
        String catalogCode = "SM05-DISABLED-SKU-" + suffix();
        JsonNode catalogItem = catalog.acceptanceCreateSkuItemWithTwoEnabledSkus(
                context, menus.fixture(), menus.session(), catalogCode, "SM05 disabled SKU");
        JsonNode firstSku = catalogItem.path("skus").get(0);
        JsonNode secondSku = catalogItem.path("skus").get(1);
        String firstSkuCode = firstSku.path("skuCode").asText();
        String secondSkuCode = secondSku.path("skuCode").asText();
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        catalogItem = catalog.acceptanceSetSkuStatus(
                context, menus.fixture(), menus.session(), catalogCode, secondSkuCode, "VOIDED");
        assertFalse(
                iterable(catalogItem.path("skus")).stream()
                        .anyMatch(
                                sku -> secondSkuCode.equals(sku.path("skuCode").asText())),
                "BUSINESS: Catalog VOIDED SKU is absent from active item readback after its owner transition");
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState item = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        JsonNode firstDraft = context.get(
                        OPERATIONS_SALES_MENU_DRAFT_ITEM,
                        draftItemPath(menus, menu.ref(), item.ref()),
                        menus.session().cookie(),
                        Set.of(200))
                .json();
        assertTrue(
                containsRef(
                        firstDraft.path("skuCandidates"),
                        "skuRef",
                        UUID.fromString(firstSku.path("productSkuRef").asText())),
                "BUSINESS: ENABLED SKU remains a candidate");
        assertFalse(
                containsRef(
                        firstDraft.path("skuCandidates"),
                        "skuRef",
                        UUID.fromString(secondSku.path("productSkuRef").asText())),
                "BUSINESS: VOIDED SKU is omitted from candidates");
        version = updateItem(
                context,
                menus,
                menu.ref(),
                item,
                version,
                itemUpdateBody(
                        null,
                        saleContent("SKU_SELECTION", null, List.of(skuPrice(firstSku, 1599L)), List.of()),
                        ordering(1, 1),
                        inheritedMedia(),
                        version));
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        catalogItem = catalog.acceptanceSetSkuStatus(
                context, menus.fixture(), menus.session(), catalogCode, firstSkuCode, "DISABLED");
        assertEquals(
                "DISABLED",
                skuByCode(catalogItem, firstSkuCode).path("status").asText(),
                "BUSINESS: Catalog DISABLED SKU is a real owner fact");
        JsonNode staleDraft = context.get(
                        OPERATIONS_SALES_MENU_DRAFT_ITEM,
                        draftItemPath(menus, menu.ref(), item.ref()),
                        menus.session().cookie(),
                        Set.of(200))
                .json();
        assertEquals(
                0, staleDraft.path("skuCandidates").size(), "BUSINESS: no disabled or voided SKU remains selectable");
        assertTrue(
                containsScalarRef(
                        staleDraft.path("staleSelectedSkuRefs"),
                        UUID.fromString(firstSku.path("productSkuRef").asText())),
                "BUSINESS: the saved disabled SKU is exposed only as stale readback");
        JsonNode beforeRejectedSave = staleDraft.deepCopy();
        for (JsonNode rejectedSku : List.of(firstSku, secondSku)) {
            BackendAcceptanceTest.Response rejected = context.put(
                    OPERATIONS_SALES_MENU_ITEM_UPDATE,
                    draftItemPath(menus, menu.ref(), item.ref()),
                    menus.session().cookie(),
                    itemUpdateBody(
                            null,
                            saleContent("SKU_SELECTION", null, List.of(skuPrice(rejectedSku, 1699L)), List.of()),
                            ordering(1, 1),
                            inheritedMedia(),
                            version),
                    idempotencyHeaders(
                            "sales-menu-disabled-" + rejectedSku.path("skuCode").asText()),
                    Set.of(422));
            assertEquals(
                    "SALES_MENU_SKU_REFERENCE_INVALID",
                    rejected.problemCode(),
                    "BUSINESS: " + rejectedSku.path("status").asText() + " SKU save is typed-rejected");
            assertEquals(
                    beforeRejectedSave,
                    context.get(
                                    OPERATIONS_SALES_MENU_DRAFT_ITEM,
                                    draftItemPath(menus, menu.ref(), item.ref()),
                                    menus.session().cookie(),
                                    Set.of(200))
                            .json(),
                    "BUSINESS: invalid SKU save has no partial write");
        }
        BackendAcceptanceTest.Response publishRejected = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/publications",
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                idempotencyHeaders("sales-menu-disabled-publish"),
                Set.of(422));
        assertEquals(
                "SALES_MENU_SKU_REFERENCE_INVALID",
                publishRejected.problemCode(),
                "BUSINESS: publish revalidates the disabled saved SKU");
        assertTrue(
                readMenu(context, menus, menu.ref(), menus.channels().getFirst())
                        .json()
                        .path("latestPublishedRevision")
                        .isNull(),
                "BUSINESS: failed disabled-SKU publish creates no publication snapshot");
    }

    @AcceptanceScenario(
            id = "sales-menu.display-media-owner-transaction",
            module = "SALES_MENU",
            operation = "stageOperationsSalesMenuAsset")
    void displayMediaOwnerTransaction(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PreparedMenu prepared = preparePlainMenu(context, "SM05 media");
        MenuFixture menus = prepared.fixture();
        UUID menuRef = prepared.menu().ref();
        UUID itemRef = prepared.item().ref();
        String itemPath = draftItemPath(menus, menuRef, itemRef);

        BackendAcceptanceTest.Response staged = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath + "/assets/stage",
                menus.session().cookie(),
                prepared.item().itemVersion(),
                "sm05-primary.png",
                "image/png",
                sha256(PNG),
                PNG,
                Set.of(201));
        String assetRef = requiredJsonNode(
                        staged.json(), "/assetRef", JsonNodeType.STRING, "BUSINESS: sales-menu stage assetRef")
                .asText();
        String bindGrant = requiredJsonNode(
                        staged.json(), "/bindGrant", JsonNodeType.STRING, "BUSINESS: sales-menu stage bindGrant")
                .asText();
        assertEquals(
                "STAGED",
                staged.json().path("status").asText(),
                "BUSINESS: staged media is not active before the owner claim");
        assertEquals(
                "SALES_MENU_ITEM_IMAGE",
                staged.json().path("target").path("usage").asText(),
                "BUSINESS: staged media is bound to the menu-image usage");
        assertEquals(
                menus.fixture().groupWorkspaceKey(),
                staged.json().path("target").path("groupWorkspaceKey").asText(),
                "BUSINESS: stage readback returns the owning workspace target");
        assertEquals(
                menus.fixture().storeId().toString(),
                staged.json().path("target").path("storeRef").asText(),
                "BUSINESS: stage readback returns the owning store target");
        assertEquals(
                menuRef.toString(),
                staged.json().path("target").path("salesMenuRef").asText(),
                "BUSINESS: stage readback returns the owning menu target");
        assertEquals(
                itemRef.toString(),
                staged.json().path("target").path("salesItemRef").asText(),
                "BUSINESS: stage readback returns the owning item target");
        assertEquals(
                prepared.item().itemVersion(),
                staged.json().path("target").path("expectedDraftVersion").asLong(),
                "BUSINESS: stage readback returns the addressed draft item version");

        long version = prepared.menuVersion();
        Map<String, String> grants =
                Map.of("X-Sales-Menu-Asset-Bind-Grants", "{\"" + assetRef + "\":\"" + bindGrant + "\"}");
        version = updateItem(
                context,
                menus,
                menuRef,
                prepared.item(),
                version,
                itemUpdateBody(null, directSale(2400), ordering(1, 1), customMedia(UUID.fromString(assetRef)), version),
                grants);
        ItemState claimedItem = readDraftItemState(context, menus, menuRef, itemRef);
        BackendAcceptanceTest.Response claimedRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                "CUSTOM",
                claimedRead.json().path("displayMedia").path("mode").asText(),
                "BUSINESS: owner transaction commits custom media only with a valid bind grant");
        assertEquals(
                assetRef,
                claimedRead.json().path("displayMedia").path("primaryAssetRef").asText(),
                "BUSINESS: owner transaction reads back the primary image identity");

        UUID channelRef = menus.channels().getFirst();
        version = setActivation(context, menus, menuRef, channelRef, "ENABLED", version);
        version = publish(context, menus, menuRef, version);
        BackendAcceptanceTest.Response publishedOriginal = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, channelRef),
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                publishedOriginal
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .toString()
                        .contains(assetRef),
                "BUSINESS: the claimed image enters the immutable published view");

        BackendAcceptanceTest.Fixture sibling =
                host.siblingStoreFixtureSameBrand(menus.fixture(), Set.of(SALES_MENU_CAPABILITY));
        host.completeInvitation(context, sibling);
        BackendAcceptanceTest.Session siblingSession = selectStore(context, sibling, host.login(context, sibling));
        long crossStoreAssetCountBefore = salesMenuImageCount(menus.fixture());
        BackendAcceptanceTest.Response crossStore = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                menuRoot(sibling) + "/" + menuRef + "/draft/items/" + itemRef + "/assets/stage",
                siblingSession.cookie(),
                claimedItem.itemVersion(),
                "sm05-cross-store.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(403, 404));
        assertEquals(
                "SALES_MENU_NOT_FOUND",
                crossStore.problemCode(),
                "BUSINESS: a menu image target cannot cross the selected store");
        assertNoSalesMenuMediaMutation(
                context,
                menus,
                menuRef,
                itemRef,
                version,
                claimedItem.itemVersion(),
                crossStoreAssetCountBefore,
                "cross-store stage rejection");

        BackendAcceptanceTest.Response secondMenu = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", menus.channels().getFirst(), "name", "SM05 media second menu"),
                Set.of(201));
        UUID secondMenuRef = UUID.fromString(
                requiredJsonNode(secondMenu.json(), "/salesMenuRef", JsonNodeType.STRING, "BUSINESS: second menu ref")
                        .asText());
        long crossMenuAssetCountBefore = salesMenuImageCount(menus.fixture());
        BackendAcceptanceTest.Response crossMenu = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                menuRoot(menus.fixture()) + "/" + secondMenuRef + "/draft/items/" + itemRef + "/assets/stage",
                menus.session().cookie(),
                claimedItem.itemVersion(),
                "sm05-cross-menu.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(404));
        assertEquals(
                "SALES_MENU_ITEM_NOT_FOUND",
                crossMenu.problemCode(),
                "BUSINESS: a menu image target must contain the addressed item in that menu");
        assertNoSalesMenuMediaMutation(
                context,
                menus,
                menuRef,
                itemRef,
                version,
                claimedItem.itemVersion(),
                crossMenuAssetCountBefore,
                "cross-menu stage rejection");
        long crossItemAssetCountBefore = salesMenuImageCount(menus.fixture());
        BackendAcceptanceTest.Response crossItem = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath.replace(itemRef.toString(), UUID.randomUUID().toString()) + "/assets/stage",
                menus.session().cookie(),
                claimedItem.itemVersion(),
                "sm05-cross-item.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(404));
        assertEquals(
                "SALES_MENU_ITEM_NOT_FOUND",
                crossItem.problemCode(),
                "BUSINESS: a menu image target must contain the addressed item identity");
        assertNoSalesMenuMediaMutation(
                context,
                menus,
                menuRef,
                itemRef,
                version,
                claimedItem.itemVersion(),
                crossItemAssetCountBefore,
                "cross-item stage rejection");

        BackendAcceptanceTest.Response catalogStaged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                menus.fixture(),
                menus.session().cookie(),
                menus.fixture().storeId().toString(),
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(200));
        String wrongUsageAssetRef = requiredJsonNode(
                        catalogStaged.json().path("result"),
                        "/assetRef",
                        JsonNodeType.STRING,
                        "BUSINESS: wrong-usage catalog assetRef")
                .asText();
        String wrongUsageAssetStateBefore = assetLifecycleState(UUID.fromString(wrongUsageAssetRef));
        BackendAcceptanceTest.Response wrongUsage = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + wrongUsageAssetRef + "/release",
                menus.session().cookie(),
                Map.of(
                        "expectedAssetVersion",
                        catalogStaged.json().path("result").path("version").asLong()),
                Set.of(403));
        assertEquals(
                "SALES_MENU_ASSET_TARGET_MISMATCH",
                wrongUsage.problemCode(),
                "BUSINESS: a catalog asset cannot be used as a sales-menu image");
        assertEquals(
                wrongUsageAssetStateBefore,
                assetLifecycleState(UUID.fromString(wrongUsageAssetRef)),
                "BUSINESS: wrong-usage release leaves the catalog asset lifecycle unchanged");
        BackendAcceptanceTest.Response afterWrongUsage = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                assetRef,
                afterWrongUsage
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: wrong-usage release leaves the menu binding unchanged");
        assertEquals(
                claimedItem.itemVersion(),
                afterWrongUsage.json().path("version").asLong(),
                "BUSINESS: wrong-usage release leaves the item version unchanged");
        assertEquals(
                version,
                readMenu(context, menus, menuRef, channelRef)
                        .json()
                        .path("version")
                        .asLong(),
                "BUSINESS: wrong-usage release leaves the menu version unchanged");
        context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + wrongUsageAssetRef + "/release",
                menus.session().cookie(),
                Map.of(
                        "assetRef", wrongUsageAssetRef,
                        "expectedVersion",
                                catalogStaged
                                        .json()
                                        .path("result")
                                        .path("version")
                                        .asLong(),
                        "dataNodeRef", menus.fixture().storeId().toString()),
                Set.of(200));

        String claimedAssetStateBefore = assetLifecycleState(UUID.fromString(assetRef));
        BackendAcceptanceTest.Response releaseClaimed = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + assetRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", staged.json().path("version").asLong()),
                Set.of(409));
        assertEquals(
                "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
                releaseClaimed.problemCode(),
                "BUSINESS: an actively claimed image cannot be released as an unclaimed stage");
        assertEquals(
                claimedAssetStateBefore,
                assetLifecycleState(UUID.fromString(assetRef)),
                "BUSINESS: a rejected claimed-image release does not mutate the asset lifecycle");
        BackendAcceptanceTest.Response afterClaimedRelease = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                assetRef,
                afterClaimedRelease
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: a rejected claimed-image release leaves the menu binding unchanged");
        assertEquals(
                claimedItem.itemVersion(),
                afterClaimedRelease.json().path("version").asLong(),
                "BUSINESS: a rejected claimed-image release leaves the item version unchanged");
        assertEquals(
                version,
                readMenu(context, menus, menuRef, channelRef)
                        .json()
                        .path("version")
                        .asLong(),
                "BUSINESS: a rejected claimed-image release leaves the menu version unchanged");

        BackendAcceptanceTest.Response secondStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath + "/assets/stage",
                menus.session().cookie(),
                claimedItem.itemVersion(),
                "sm05-replacement.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(201));
        String replacementRef = requiredJsonNode(
                        secondStage.json(), "/assetRef", JsonNodeType.STRING, "BUSINESS: replacement assetRef")
                .asText();
        String replacementBindGrant = requiredJsonNode(
                        secondStage.json(), "/bindGrant", JsonNodeType.STRING, "BUSINESS: replacement bindGrant")
                .asText();
        assertSalesMenuAssetTarget(
                secondStage.json(), menus, menuRef, itemRef, claimedItem.itemVersion(), "replacement stage");
        String replacementStateBeforeInvalid = assetLifecycleState(UUID.fromString(replacementRef));
        long menuVersionBeforeInvalid = version;
        BackendAcceptanceTest.Response invalidGrant = context.put(
                OPERATIONS_SALES_MENU_ITEM_UPDATE,
                itemPath,
                menus.session().cookie(),
                itemUpdateBody(
                        null, directSale(2500), ordering(1, 1), customMedia(UUID.fromString(replacementRef)), version),
                Map.of("X-Sales-Menu-Asset-Bind-Grants", "{\"" + replacementRef + "\":\"wrong-grant\"}"),
                Set.of(422));
        assertEquals(
                "SALES_MENU_ASSET_INVALID",
                invalidGrant.problemCode(),
                "BUSINESS: an invalid bind grant on a staged image is typed and rejected atomically");
        BackendAcceptanceTest.Response unchanged = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                assetRef,
                unchanged.json().path("displayMedia").path("primaryAssetRef").asText(),
                "BUSINESS: invalid media claim leaves the prior custom binding unchanged");
        assertEquals(
                replacementStateBeforeInvalid,
                assetLifecycleState(UUID.fromString(replacementRef)),
                "BUSINESS: invalid media claim leaves the staged replacement lifecycle unchanged");
        assertEquals(
                claimedItem.itemVersion(),
                unchanged.json().path("version").asLong(),
                "BUSINESS: invalid media claim leaves the item version unchanged");
        assertEquals(
                menuVersionBeforeInvalid,
                readMenu(context, menus, menuRef, channelRef)
                        .json()
                        .path("version")
                        .asLong(),
                "BUSINESS: invalid media claim leaves the menu version unchanged");

        version = updateItem(
                context,
                menus,
                menuRef,
                claimedItem,
                version,
                itemUpdateBody(
                        null, directSale(2600), ordering(1, 1), customMedia(UUID.fromString(replacementRef)), version),
                Map.of(
                        "X-Sales-Menu-Asset-Bind-Grants",
                        "{\"" + replacementRef + "\":\"" + replacementBindGrant + "\"}"));
        ItemState replacedItem = readDraftItemState(context, menus, menuRef, itemRef);
        BackendAcceptanceTest.Response replacementRead = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                replacementRef,
                replacementRead
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: a valid replacement claim reads back the new draft image");
        assertTrue(
                replacedItem.itemVersion() > claimedItem.itemVersion(),
                "BUSINESS: a valid replacement claim advances the item draft version");
        BackendAcceptanceTest.Response publishedAfterReplacement = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, channelRef),
                menus.session().cookie(),
                Set.of(200));
        boolean originalStillPublished = false;
        boolean replacementPublished = false;
        for (JsonNode ref :
                publishedAfterReplacement.json().path("displayMedia").path("assetRefs")) {
            originalStillPublished |= assetRef.equals(ref.asText());
            replacementPublished |= replacementRef.equals(ref.asText());
        }
        assertTrue(
                originalStillPublished,
                "BUSINESS: a draft image replacement does not remove the frozen published image");
        assertFalse(replacementPublished, "BUSINESS: a draft image replacement does not enter the prior publication");

        BackendAcceptanceTest.Response releaseStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath + "/assets/stage",
                menus.session().cookie(),
                replacedItem.itemVersion(),
                "sm05-release.png",
                "image/png",
                sha256(PNG),
                PNG,
                Set.of(201));
        String releasedAssetRef = requiredJsonNode(
                        releaseStage.json(), "/assetRef", JsonNodeType.STRING, "BUSINESS: release assetRef")
                .asText();
        assertSalesMenuAssetTarget(
                releaseStage.json(), menus, menuRef, itemRef, replacedItem.itemVersion(), "release stage");
        long releasedAssetVersion = requiredJsonNode(
                        releaseStage.json(), "/version", JsonNodeType.NUMBER, "BUSINESS: release asset version")
                .asLong();
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + releasedAssetRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", releasedAssetVersion),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("status").asText(),
                "BUSINESS: a separate unclaimed stage can be released through the owner route");
        assertSalesMenuAssetTarget(
                released.json(), menus, menuRef, itemRef, replacedItem.itemVersion(), "release readback");
        String releasedAssetState = assetLifecycleState(UUID.fromString(releasedAssetRef));
        BackendAcceptanceTest.Response releaseReleased = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + releasedAssetRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", released.json().path("version").asLong()),
                Set.of(409));
        assertEquals(
                "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
                releaseReleased.problemCode(),
                "BUSINESS: an already released image cannot be released again");
        assertEquals(
                releasedAssetState,
                assetLifecycleState(UUID.fromString(releasedAssetRef)),
                "BUSINESS: a rejected released-image operation does not mutate the asset lifecycle");
        BackendAcceptanceTest.Response afterReleasedAgain = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                replacementRef,
                afterReleasedAgain
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: a rejected released-image operation leaves the menu binding unchanged");

        BackendAcceptanceTest.Response staleStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath + "/assets/stage",
                menus.session().cookie(),
                replacedItem.itemVersion(),
                "sm05-stale-version.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(201));
        String staleRef = requiredJsonNode(
                        staleStage.json(), "/assetRef", JsonNodeType.STRING, "BUSINESS: stale-version assetRef")
                .asText();
        long staleVersion = requiredJsonNode(
                        staleStage.json(), "/version", JsonNodeType.NUMBER, "BUSINESS: stale-version asset version")
                .asLong();
        BackendAcceptanceTest.Response staleRelease = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + staleRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", staleVersion + 1),
                Set.of(409));
        assertEquals(
                "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
                staleRelease.problemCode(),
                "BUSINESS: an image release with a stale asset version is rejected");
        BackendAcceptanceTest.Response staleReleased = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + staleRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", staleVersion),
                Set.of(200));
        assertEquals(
                "RELEASED",
                staleReleased.json().path("status").asText(),
                "BUSINESS: the unchanged staged asset can be released after a stale-version rejection");
        assertSalesMenuAssetTarget(
                staleReleased.json(),
                menus,
                menuRef,
                itemRef,
                replacedItem.itemVersion(),
                "stale-version release readback");

        BackendAcceptanceTest.Fixture noCapability = host.storeUserFixture(menus.fixture(), Set.of());
        host.completeInvitation(context, noCapability);
        BackendAcceptanceTest.Session deniedSession =
                selectStore(context, noCapability, host.login(context, noCapability));
        long salesMenuImageCountBeforeDenied = host.count(
                "SELECT count(*) FROM platform_asset.staged_asset WHERE workspace_uuid=? "
                        + "AND usage='SALES_MENU_ITEM_IMAGE'",
                menus.fixture().workspaceUuid());
        BackendAcceptanceTest.Response deniedStage = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                itemPath + "/assets/stage",
                deniedSession.cookie(),
                replacedItem.itemVersion(),
                "sm05-denied.png",
                "image/png",
                sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(403));
        assertEquals(
                "PLATFORM_COMMON_ACCESS_DENIED",
                deniedStage.problemCode(),
                "BUSINESS: media staging honors the sales-menu capability boundary");
        assertEquals(
                salesMenuImageCountBeforeDenied,
                host.count(
                        "SELECT count(*) FROM platform_asset.staged_asset WHERE workspace_uuid=? "
                                + "AND usage='SALES_MENU_ITEM_IMAGE'",
                        menus.fixture().workspaceUuid()),
                "BUSINESS: a capability-denied stage does not write a sales-menu asset");
        BackendAcceptanceTest.Response afterDeniedStage = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                replacementRef,
                afterDeniedStage
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: a capability-denied stage leaves the menu binding unchanged");
        assertEquals(
                replacedItem.itemVersion(),
                afterDeniedStage.json().path("version").asLong(),
                "BUSINESS: a capability-denied stage leaves the item version unchanged");
        assertEquals(
                version,
                readMenu(context, menus, menuRef, channelRef)
                        .json()
                        .path("version")
                        .asLong(),
                "BUSINESS: a capability-denied stage leaves the menu version unchanged");

        String publishedAssetStateBeforeArchive = assetLifecycleState(UUID.fromString(assetRef));
        version = archiveMenu(context, menus, menuRef, version);
        MenuReadResult archivedDetail = readMenu(context, menus, menuRef, channelRef);
        assertTrue(
                archivedDetail.json().path("archived").asBoolean(false),
                "BUSINESS: archiving a published menu preserves its historical owner state");
        BackendAcceptanceTest.Response publishedAfterArchive = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, channelRef),
                menus.session().cookie(),
                Set.of(200));
        boolean originalStillPublishedAfterArchive = false;
        boolean replacementPublishedAfterArchive = false;
        for (JsonNode ref : publishedAfterArchive.json().path("displayMedia").path("assetRefs")) {
            originalStillPublishedAfterArchive |= assetRef.equals(ref.asText());
            replacementPublishedAfterArchive |= replacementRef.equals(ref.asText());
        }
        assertTrue(
                originalStillPublishedAfterArchive,
                "BUSINESS: archiving preserves the immutable published image identity");
        assertFalse(
                replacementPublishedAfterArchive,
                "BUSINESS: archiving does not promote the draft replacement into the publication");
        BackendAcceptanceTest.Response publishedBoundRelease = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + assetRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", staged.json().path("version").asLong() + 1),
                Set.of(409));
        assertTrue(
                publishedBoundRelease.problemCode().contains("ASSET")
                        || publishedBoundRelease.problemCode().contains("CLAIM"),
                "BUSINESS: a published-bound active image remains unreleasable after archive");
        assertEquals(
                publishedAssetStateBeforeArchive,
                assetLifecycleState(UUID.fromString(assetRef)),
                "BUSINESS: a published-bound release rejection leaves the asset lifecycle unchanged");
        BackendAcceptanceTest.Response archivedDraftItem = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                replacementRef,
                archivedDraftItem
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: archive does not change the draft image binding");
    }

    @AcceptanceScenario(
            id = "sales-menu.publish-frozen-effective-view",
            module = "SALES_MENU",
            operation = "publishOperationsSalesMenu")
    void publishFrozenEffectiveView(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        PreparedMenu prepared = preparePlainMenu(context, "SM05 frozen");
        MenuFixture menus = prepared.fixture();
        UUID menuRef = prepared.menu().ref();
        UUID itemRef = prepared.item().ref();
        long version = prepared.menuVersion();
        version = updateSchedule(context, menus, menuRef, version, dailySchedule());
        version = updateItem(
                context,
                menus,
                menuRef,
                prepared.item(),
                version,
                itemUpdateBody(null, directSale(2700), ordering(1, 1), inheritedMedia(), version));
        ItemState currentItem = readDraftItemState(context, menus, menuRef, itemRef);
        BackendAcceptanceTest.Response preview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(menus, menuRef, menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                0,
                preview.json().path("violations").size(),
                "BUSINESS: valid draft preview has no publication blockers");
        version = publish(context, menus, menuRef, version);
        BackendAcceptanceTest.Response publishedSections = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menuRef + "/published/sections",
                menus.session().cookie(),
                Set.of(200));
        UUID publishedSection = UUID.fromString(publishedSections
                .json()
                .path("items")
                .get(0)
                .path("salesSectionRef")
                .asText());
        JsonNode frozenSection = publishedSections.json().path("items").get(0).deepCopy();
        assertPublishedSectionReadModel(frozenSection, "BUSINESS: first publication section readback");
        BackendAcceptanceTest.Response publishedItems = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                publishedItemsPath(
                                menus,
                                menuRef,
                                publishedSection,
                                menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(1, publishedItems.json().path("items").size(), "BUSINESS: publish creates one effective item row");
        JsonNode frozen = publishedItems.json().path("items").get(0).deepCopy();
        assertPublishedItemReadModel(frozen, "BUSINESS: first publication item readback");
        assertEquals(
                2700,
                frozen.path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: the first publication freezes its price");
        BackendAcceptanceTest.Response frozenDetail = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        JsonNode frozenDetailFacts = frozenDetail.json().deepCopy();
        assertPublishedItemReadModel(frozenDetailFacts, "BUSINESS: first publication detail readback");
        assertEquals(
                frozen,
                frozenDetailFacts,
                "BUSINESS: published item page and detail expose the same frozen effective tuple");
        MenuReadResult firstPublicationMenu =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        JsonNode firstPublishedSchedule =
                firstPublicationMenu.json().path("latestPublishedSchedule").deepCopy();
        assertScheduleReadModel(firstPublishedSchedule, dailySchedule(), "BUSINESS: first publication schedule");
        long firstDraftRevision =
                firstPublicationMenu.json().path("draftRevision").asLong();
        assertEquals(
                1,
                firstPublicationMenu.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: first publication has its own immutable publication revision");
        assertFalse(
                firstPublicationMenu.json().path("draftDirty").asBoolean(true),
                "BUSINESS: current draft equals the first publication source revision");

        String renamedCatalogName = "SM05 frozen catalog renamed";
        JsonNode renamedCatalog = catalog.acceptanceRenamePlainItem(
                context, menus.fixture(), menus.session(), prepared.catalogItemCode(), renamedCatalogName);
        assertEquals(
                renamedCatalogName,
                renamedCatalog.path("name").asText(),
                "BUSINESS: publish-frozen fixture mutates the real Catalog owner fact");

        version = updateItem(
                context,
                menus,
                menuRef,
                currentItem,
                version,
                itemUpdateBody(null, directSale(3900), ordering(1, 1), inheritedMedia(), version));
        currentItem = readDraftItemState(context, menus, menuRef, itemRef);
        MenuReadResult dirtyMenu =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        assertTrue(
                dirtyMenu.json().path("draftRevision").asLong() > firstDraftRevision,
                "BUSINESS: a draft command advances the current draft revision");
        assertTrue(
                dirtyMenu.json().path("draftDirty").asBoolean(false),
                "BUSINESS: a draft command makes the menu dirty against the publication source revision");
        BackendAcceptanceTest.Response dirtyPreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(menus, menuRef, menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                dirtyPreview.json().path("hasChanges").asBoolean(false),
                "BUSINESS: draft mutation is visible as an unpublished change");
        assertPublishedSectionUnchanged(
                frozenSection,
                context.get(
                                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                                menuRoot(menus.fixture()) + "/" + menuRef + "/published/sections",
                                menus.session().cookie(),
                                Set.of(200))
                        .json()
                        .path("items")
                        .get(0),
                "BUSINESS: draft and Catalog mutations do not rewrite the old publication section");
        BackendAcceptanceTest.Response frozenItemsAfterMutation = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                publishedItemsPath(
                                menus,
                                menuRef,
                                publishedSection,
                                menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                frozenItemsAfterMutation.json().path("items").size(),
                "BUSINESS: draft and Catalog mutations preserve the published item row count");
        assertPublishedItemUnchanged(
                frozen,
                frozenItemsAfterMutation.json().path("items").get(0),
                "BUSINESS: draft and Catalog mutations do not rewrite the old publication item");
        assertPublishedItemUnchanged(
                frozen,
                publishedItem(context, menus, menuRef, itemRef, menus.channels().getFirst()),
                "BUSINESS: published item detail remains frozen before republish");

        version = updateSchedule(context, menus, menuRef, version, allDaySchedule());
        MenuReadResult scheduleChangedMenu =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        assertScheduleReadModel(
                scheduleChangedMenu.json().path("draftSchedule"),
                allDaySchedule(),
                "BUSINESS: current draft schedule changes before the second publication");
        assertEquals(
                firstPublishedSchedule,
                scheduleChangedMenu.json().path("latestPublishedSchedule"),
                "BUSINESS: draft schedule mutation does not rewrite the first publication schedule");
        BackendAcceptanceTest.Response republished = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(menus.fixture()) + "/" + menuRef + "/publications",
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                Set.of(201));
        assertFalse(
                republished.json().has("terminalAck"),
                "CONTRACT: publish readback contains no terminal acknowledgement field");
        version = assertCommand(republished, "publishOperationsSalesMenu", menuRef, menuRef);
        BackendAcceptanceTest.Response latest = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        assertPublishedItemReadModel(latest.json(), "BUSINESS: second publication item readback");
        assertEquals(
                renamedCatalogName,
                latest.json().path("displayName").asText(),
                "BUSINESS: a new publication resolves the latest Catalog name");
        assertEquals(
                frozen.path("itemCode"),
                latest.json().path("itemCode"),
                "BUSINESS: a new publication keeps the Catalog item identity");
        assertEquals(
                frozen.path("productShape"),
                latest.json().path("productShape"),
                "BUSINESS: a new publication keeps the Catalog product shape");
        assertEquals(
                frozen.path("orderingConstraints"),
                latest.json().path("orderingConstraints"),
                "BUSINESS: a new publication carries the latest draft ordering constraints");
        assertEquals(
                frozen.path("displayMedia"),
                latest.json().path("displayMedia"),
                "BUSINESS: a new publication carries the latest draft display media");
        assertEquals(
                3900,
                latest.json().path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: a new publication exposes the latest draft value");
        assertEquals(
                latest.json(),
                publishedItem(context, menus, menuRef, itemRef, menus.channels().getFirst()),
                "BUSINESS: published item page and detail expose the same latest effective tuple");
        MenuReadResult latestDetail =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        assertEquals(
                2,
                latestDetail.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: publication revision advances without mutating revision one");
        assertScheduleReadModel(
                latestDetail.json().path("latestPublishedSchedule"),
                allDaySchedule(),
                "BUSINESS: the second publication exposes the latest schedule");
        assertFalse(
                latestDetail.json().path("draftDirty").asBoolean(true),
                "BUSINESS: the second publication source revision matches the current draft revision");
        assertTrue(
                version > 0 && currentItem.itemVersion() > 0,
                "BUSINESS: frozen-view commands retain authoritative versions");
    }

    @AcceptanceScenario(
            id = "sales-menu.publish-blockers",
            module = "SALES_MENU",
            operation = "publishOperationsSalesMenu")
    void publishBlockers(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture malformed = menuFixture(context, 1, "SM05 blockers malformed");
        MenuState malformedMenu = createMenu(
                context, malformed, "SM05 malformed", malformed.channels().getFirst());
        JsonNode malformedCatalog = catalog.acceptanceCreatePlainItem(
                context, malformed.fixture(), malformed.session(), "SM05-BLOCK-" + suffix(), "SM05 blocker item");
        SectionState malformedSection =
                createSection(context, malformed, malformedMenu.ref(), "SM05 blocker section", malformedMenu.version());
        long malformedVersion = addItems(
                context,
                malformed,
                malformedMenu.ref(),
                malformedSection.ref(),
                malformedSection.menuVersion(),
                List.of(UUID.fromString(malformedCatalog.path("itemRef").asText())));
        ItemState malformedItem = findDraftItem(
                context,
                malformed,
                malformedMenu.ref(),
                malformedSection.ref(),
                UUID.fromString(malformedCatalog.path("itemRef").asText()));
        BackendAcceptanceTest.Response pricePreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(malformed, malformedMenu.ref(), malformed.channels().getFirst()),
                malformed.session().cookie(),
                Set.of(200));
        assertSinglePublicationBlocker(
                pricePreview.json(),
                "LISTED_PRICE_MISSING",
                malformedItem.ref(),
                "salesMenu.listedPrice.required",
                "BUSINESS: unconfigured direct pricing is the exact typed preview violation");
        JsonNode malformedMenuBeforeFailedPublish = readMenu(
                        context,
                        malformed,
                        malformedMenu.ref(),
                        malformed.channels().getFirst())
                .json()
                .deepCopy();
        BackendAcceptanceTest.Response pricePublish = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(malformed.fixture()) + "/" + malformedMenu.ref() + "/publications",
                malformed.session().cookie(),
                Map.of("expectedVersion", malformedVersion),
                Set.of(422));
        assertEquals(
                "SALES_MENU_PRICE_REQUIRED",
                pricePublish.problemCode(),
                "BUSINESS: publish maps the price blocker to the owner error code");
        assertEquals(
                "PUBLICATION_NOT_FOUND",
                context.get(
                                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                                menuRoot(malformed.fixture()) + "/" + malformedMenu.ref() + "/published/sections",
                                malformed.session().cookie(),
                                Set.of(404))
                        .problemCode(),
                "BUSINESS: failed publish creates no effective publication");
        assertEquals(
                malformedMenuBeforeFailedPublish,
                readMenu(
                                context,
                                malformed,
                                malformedMenu.ref(),
                                malformed.channels().getFirst())
                        .json(),
                "BUSINESS: malformed price publish rejection leaves menu version and publication state unchanged");

        PreparedMenu disabledActivation = preparePlainMenu(context, "SM05 blockers disabled activation");
        long disabledVersion = updateItem(
                context,
                disabledActivation.fixture(),
                disabledActivation.menu().ref(),
                disabledActivation.item(),
                disabledActivation.menuVersion(),
                itemUpdateBody(
                        null, directSale(2100), ordering(1, 1), inheritedMedia(), disabledActivation.menuVersion()));
        BackendAcceptanceTest.Response disabledPublish = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(disabledActivation.fixture().fixture()) + "/"
                        + disabledActivation.menu().ref() + "/publications",
                disabledActivation.fixture().session().cookie(),
                Map.of("expectedVersion", disabledVersion),
                Set.of(201));
        assertCommand(
                disabledPublish,
                "publishOperationsSalesMenu",
                disabledActivation.menu().ref(),
                disabledActivation.menu().ref());
        assertEquals(
                "DISABLED",
                readMenu(
                                context,
                                disabledActivation.fixture(),
                                disabledActivation.menu().ref(),
                                disabledActivation.fixture().channels().getFirst())
                        .json()
                        .path("activation")
                        .path("status")
                        .asText(),
                "BUSINESS: a disabled menu activation does not block a valid draft publication");

        MenuFixture disabledChannel = menuFixture(context, 1, "SM05 blockers channel");
        PreparedMenu channelPrepared = preparePlainMenu(context, disabledChannel, "SM05 channel blocked");
        long channelVersion = updateItem(
                context,
                disabledChannel,
                channelPrepared.menu().ref(),
                channelPrepared.item(),
                channelPrepared.menuVersion(),
                itemUpdateBody(
                        null, directSale(2200), ordering(1, 1), inheritedMedia(), channelPrepared.menuVersion()));
        channelVersion = setActivation(
                context,
                disabledChannel,
                channelPrepared.menu().ref(),
                disabledChannel.channels().getFirst(),
                "ENABLED",
                channelVersion);
        disableBusinessChannel(
                context, disabledChannel, disabledChannel.channels().getFirst());
        BackendAcceptanceTest.Response channelPreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(
                        disabledChannel,
                        channelPrepared.menu().ref(),
                        disabledChannel.channels().getFirst()),
                disabledChannel.session().cookie(),
                Set.of(200));
        assertSinglePublicationBlocker(
                channelPreview.json(),
                "CHANNEL_DISABLED",
                null,
                "salesMenu.channel.disabled",
                "BUSINESS: a disabled channel is the exact typed preview violation");
        JsonNode channelMenuBeforeFailedPublish = readMenu(
                        context,
                        disabledChannel,
                        channelPrepared.menu().ref(),
                        disabledChannel.channels().getFirst())
                .json()
                .deepCopy();
        BackendAcceptanceTest.Response channelPublish = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(disabledChannel.fixture()) + "/"
                        + channelPrepared.menu().ref() + "/publications",
                disabledChannel.session().cookie(),
                Map.of("expectedVersion", channelVersion),
                Set.of(422));
        assertEquals(
                "SALES_MENU_CHANNEL_DISABLED",
                channelPublish.problemCode(),
                "BUSINESS: disabled channel publish has a typed blocker");
        assertEquals(
                channelMenuBeforeFailedPublish,
                readMenu(
                                context,
                                disabledChannel,
                                channelPrepared.menu().ref(),
                                disabledChannel.channels().getFirst())
                        .json(),
                "BUSINESS: disabled channel publish rejection leaves menu version and publication state unchanged");

        MenuFixture disabledStore = menuFixture(context, 1, "SM05 blockers store");
        PreparedMenu storePrepared = preparePlainMenu(context, disabledStore, "SM05 store blocked");
        long storeVersion = updateItem(
                context,
                disabledStore,
                storePrepared.menu().ref(),
                storePrepared.item(),
                storePrepared.menuVersion(),
                itemUpdateBody(null, directSale(2300), ordering(1, 1), inheritedMedia(), storePrepared.menuVersion()));
        storeVersion = setActivation(
                context,
                disabledStore,
                storePrepared.menu().ref(),
                disabledStore.channels().getFirst(),
                "ENABLED",
                storeVersion);
        disableStoreThroughOwner(context, disabledStore.fixture());
        BackendAcceptanceTest.Response storePreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(
                        disabledStore,
                        storePrepared.menu().ref(),
                        disabledStore.channels().getFirst()),
                disabledStore.session().cookie(),
                Set.of(200));
        assertSinglePublicationBlocker(
                storePreview.json(),
                "STORE_DISABLED",
                null,
                "salesMenu.store.disabled",
                "BUSINESS: a disabled store is the exact typed preview violation");
        JsonNode storeMenuBeforeFailedPublish = readMenu(
                        context,
                        disabledStore,
                        storePrepared.menu().ref(),
                        disabledStore.channels().getFirst())
                .json()
                .deepCopy();
        BackendAcceptanceTest.Response storePublish = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(disabledStore.fixture()) + "/" + storePrepared.menu().ref() + "/publications",
                disabledStore.session().cookie(),
                Map.of("expectedVersion", storeVersion),
                Set.of(422));
        assertEquals(
                "SALES_MENU_STORE_DISABLED",
                storePublish.problemCode(),
                "BUSINESS: disabled store publish has a typed blocker");
        assertEquals(
                storeMenuBeforeFailedPublish,
                readMenu(
                                context,
                                disabledStore,
                                storePrepared.menu().ref(),
                                disabledStore.channels().getFirst())
                        .json(),
                "BUSINESS: disabled store publish rejection leaves menu version and publication state unchanged");
    }

    @AcceptanceScenario(
            id = "sales-menu.inventory-availability-matrix",
            module = "SALES_MENU",
            operation = "getOperationsSalesMenuPublishedItems")
    void inventoryAvailabilityMatrix(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Set<String> capabilities = new HashSet<>(STORE_CAPABILITIES);
        capabilities.add("EDIT_STORE_INVENTORY");
        MenuFixture menus = menuFixture(context, 1, "SM05 inventory", capabilities);
        MenuState menu = createMenu(
                context, menus, "SM05 inventory menu", menus.channels().getFirst());
        long version = menu.version();
        SectionState section = createSection(context, menus, menu.ref(), "SM05 inventory section", version);
        version = section.menuVersion();
        String suffix = suffix();
        JsonNode noTarget = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-INV-NO-TARGET-" + suffix, "SM05 inventory no target");
        JsonNode normal = catalog.acceptanceCreateInventoryBackedPlainItem(
                context, menus.fixture(), menus.session(), "SM05-INV-NORMAL-" + suffix, "SM05 inventory normal");
        JsonNode low = catalog.acceptanceCreateInventoryBackedPlainItem(
                context, menus.fixture(), menus.session(), "SM05-INV-LOW-" + suffix, "SM05 inventory low");
        JsonNode outOfStock = catalog.acceptanceCreateInventoryBackedPlainItem(
                context, menus.fixture(), menus.session(), "SM05-INV-OUT-" + suffix, "SM05 inventory out");
        JsonNode negativeAllowed = catalog.acceptanceCreateInventoryBackedPlainItem(
                context,
                menus.fixture(),
                menus.session(),
                "SM05-INV-NEGATIVE-ALLOWED-" + suffix,
                "SM05 inventory negative allowed");
        JsonNode negativeDenied = catalog.acceptanceCreateInventoryBackedPlainItem(
                context,
                menus.fixture(),
                menus.session(),
                "SM05-INV-NEGATIVE-DENIED-" + suffix,
                "SM05 inventory negative denied");
        List<JsonNode> catalogItems = List.of(noTarget, normal, low, outOfStock, negativeAllowed, negativeDenied);
        List<UUID> catalogRefs = catalogItems.stream()
                .map(item -> UUID.fromString(item.path("itemRef").asText()))
                .toList();
        version = addItems(context, menus, menu.ref(), section.ref(), version, catalogRefs);
        List<ItemState> items = new ArrayList<>();
        for (UUID catalogRef : catalogRefs) {
            items.add(findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef));
        }
        for (int index = 0; index < items.size(); index++) {
            ItemState item = items.get(index);
            version = updateItem(
                    context,
                    menus,
                    menu.ref(),
                    item,
                    version,
                    itemUpdateBody(null, directSale(1100L + index * 100L), ordering(1, 1), inheritedMedia(), version));
            items.set(index, readDraftItemState(context, menus, menu.ref(), item.ref()));
        }

        catalog.acceptanceConfigureInventoryTarget(
                context, menus.fixture(), menus.session(), normal, false, "0", "sales-menu-inventory-normal-config");
        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), normal, "1", false, "sales-menu-inventory-normal-count");
        catalog.acceptanceConfigureInventoryTarget(
                context, menus.fixture(), menus.session(), low, false, "2", "sales-menu-inventory-low-config");
        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), low, "1", false, "sales-menu-inventory-low-count");
        catalog.acceptanceConfigureInventoryTarget(
                context, menus.fixture(), menus.session(), outOfStock, false, "0", "sales-menu-inventory-out-config");
        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), outOfStock, "0", true, "sales-menu-inventory-out-count");
        catalog.acceptanceConfigureInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                negativeAllowed,
                true,
                "0",
                "sales-menu-inventory-negative-allowed-config");
        catalog.acceptanceAdjustInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                negativeAllowed,
                "DECREASE",
                "1",
                "CORRECTION",
                "sales-menu-inventory-negative-allowed-adjust");
        catalog.acceptanceConfigureInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                negativeDenied,
                true,
                "0",
                "sales-menu-inventory-negative-denied-allow-config");
        catalog.acceptanceAdjustInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                negativeDenied,
                "DECREASE",
                "1",
                "CORRECTION",
                "sales-menu-inventory-negative-denied-adjust");
        catalog.acceptanceConfigureInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                negativeDenied,
                false,
                "0",
                "sales-menu-inventory-negative-denied-block-config");
        version = publish(context, menus, menu.ref(), version);

        BackendAcceptanceTest.Response publishedSections = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/published/sections",
                menus.session().cookie(),
                Set.of(200));
        UUID publishedSection = UUID.fromString(publishedSections
                .json()
                .path("items")
                .get(0)
                .path("salesSectionRef")
                .asText());
        BackendAcceptanceTest.Response published = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                publishedItemsPath(
                                menus,
                                menu.ref(),
                                publishedSection,
                                menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                catalogItems.size(),
                published.json().path("items").size(),
                "BUSINESS: the published page contains every independently configured menu item");
        Map<String, AvailabilityExpectation> expectedByCatalogRef = Map.of(
                noTarget.path("itemRef").asText(),
                new AvailabilityExpectation("NOT_APPLICABLE", null, null),
                normal.path("itemRef").asText(),
                new AvailabilityExpectation("APPLICABLE", "AVAILABLE", null),
                low.path("itemRef").asText(),
                new AvailabilityExpectation("APPLICABLE", "AVAILABLE", null),
                outOfStock.path("itemRef").asText(),
                new AvailabilityExpectation("APPLICABLE", "AUTO_UNAVAILABLE", "OUT_OF_STOCK"),
                negativeAllowed.path("itemRef").asText(),
                new AvailabilityExpectation("APPLICABLE", "AVAILABLE", null),
                negativeDenied.path("itemRef").asText(),
                new AvailabilityExpectation("APPLICABLE", "AUTO_UNAVAILABLE", "NEGATIVE_NOT_ALLOWED"));
        Set<String> publishedCatalogRefs = new HashSet<>();
        for (JsonNode row : published.json().path("items")) {
            assertTrue(
                    publishedCatalogRefs.add(row.path("catalogItemRef").asText()),
                    "BUSINESS: inventory facts are not merged across menu rows");
            AvailabilityExpectation expected =
                    expectedByCatalogRef.get(row.path("catalogItemRef").asText());
            assertNotNull(expected, "BUSINESS: every published row belongs to the matrix fixture");
            JsonNode availability = requiredJsonNode(
                    row,
                    "/inventoryAvailability",
                    JsonNodeType.OBJECT,
                    "BUSINESS: published item carries a structured inventory fact");
            assertEquals(
                    expected.applicability(),
                    availability.path("applicability").asText(),
                    "BUSINESS: inventory applicability follows the owner target existence fact");
            if (expected.state() == null) {
                assertTrue(
                        availability.path("state").isNull()
                                && availability.path("reason").isNull(),
                        "BUSINESS: not-applicable inventory has no fabricated state or reason");
            } else {
                assertEquals(
                        expected.state(),
                        availability.path("state").asText(),
                        "BUSINESS: applicable inventory state is derived from the inventory owner");
                if (expected.reason() == null)
                    assertTrue(
                            availability.path("reason").isNull(),
                            "BUSINESS: available inventory has no fabricated reason");
                else
                    assertEquals(
                            expected.reason(),
                            availability.path("reason").asText(),
                            "BUSINESS: unavailable inventory preserves the owner reason");
            }
            JsonNode manual = requiredJsonNode(
                    row,
                    "/manualSaleStatus",
                    JsonNodeType.OBJECT,
                    "BUSINESS: published item carries a structured manual-sale fact");
            assertEquals(
                    "NORMAL",
                    manual.path("state").asText(),
                    "BUSINESS: untouched published items are normally for sale");
        }
        assertEquals(
                new HashSet<>(catalogRefs.stream().map(UUID::toString).toList()),
                publishedCatalogRefs,
                "BUSINESS: published rows retain exact catalog-item identity coverage");
        BackendAcceptanceInventoryFailureProbe.failNextRead();
        JsonNode unknown = publishedItem(
                context, menus, menu.ref(), items.get(1).ref(), menus.channels().getFirst());
        assertTrue(
                BackendAcceptanceInventoryFailureProbe.wasConsumed(),
                "BUSINESS: the controlled owner-read failure seam was consumed by a real published-item HTTP read");
        JsonNode unknownAvailability = requiredJsonNode(
                unknown,
                "/inventoryAvailability",
                JsonNodeType.OBJECT,
                "BUSINESS: failed inventory owner read still returns a structured availability fact");
        assertEquals(
                "APPLICABLE",
                unknownAvailability.path("applicability").asText(),
                "BUSINESS: inventory read failure remains applicable for an inventory-backed item");
        assertEquals(
                "UNKNOWN",
                unknownAvailability.path("state").asText(),
                "BUSINESS: inventory read failure is represented as UNKNOWN");
        assertEquals(
                "READ_UNAVAILABLE",
                unknownAvailability.path("reason").asText(),
                "BUSINESS: unknown inventory has an explicit read-unavailable reason");
        assertEquals(
                "NORMAL",
                unknown.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: inventory read failure does not alter the independent manual sale status");
        BackendAcceptanceTest.Response repeat = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                publishedItemsPath(
                                menus,
                                menu.ref(),
                                publishedSection,
                                menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                published.json().path("items"),
                repeat.json().path("items"),
                "BUSINESS: repeated inventory reads do not rewrite menu rows");
        assertTrue(version > 0, "BUSINESS: inventory publication completed through the aggregate owner");
    }

    @AcceptanceScenario(
            id = "sales-menu.manual-sale-status-and-restore",
            module = "SALES_MENU",
            operation = "setOperationsSalesMenuItemSoldOut")
    void manualSaleStatusAndRestore(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        Set<String> capabilities = new HashSet<>(STORE_CAPABILITIES);
        capabilities.add("EDIT_STORE_INVENTORY");
        MenuFixture menus = menuFixture(context, 2, "SM05 manual", capabilities);
        MenuState menu =
                createMenu(context, menus, "SM05 manual menu", menus.channels().getFirst());
        JsonNode catalogItem = catalog.acceptanceCreateInventoryBackedPlainItem(
                context, menus.fixture(), menus.session(), "SM05-MANUAL-" + suffix(), "SM05 manual item");
        UUID catalogRef = UUID.fromString(catalogItem.path("itemRef").asText());
        SectionState section = createSection(context, menus, menu.ref(), "SM05 manual section", menu.version());
        long preparedVersion =
                addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState preparedItem = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        PreparedMenu prepared = new PreparedMenu(menus, menu, section, preparedItem, null, preparedVersion);
        long version = updateItem(
                context,
                menus,
                prepared.menu().ref(),
                prepared.item(),
                prepared.menuVersion(),
                itemUpdateBody(null, directSale(2600), ordering(1, 1), inheritedMedia(), prepared.menuVersion()));
        version = setActivation(
                context, menus, prepared.menu().ref(), menus.channels().get(0), "ENABLED", version);
        version = setActivation(
                context, menus, prepared.menu().ref(), menus.channels().get(1), "ENABLED", version);
        version = publish(context, menus, prepared.menu().ref(), version);
        UUID menuRef = prepared.menu().ref();
        UUID itemRef = prepared.item().ref();
        UUID firstChannel = menus.channels().get(0);
        UUID secondChannel = menus.channels().get(1);

        catalog.acceptanceCountInventoryTarget(
                context,
                menus.fixture(),
                menus.session(),
                catalogItem,
                "1",
                false,
                "sales-menu-manual-stock-available");
        JsonNode availableBeforeManualStop = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        assertEquals(
                "AVAILABLE",
                availableBeforeManualStop
                        .path("inventoryAvailability")
                        .path("state")
                        .asText(),
                "BUSINESS: a real inventory owner change makes the published item available");
        assertEquals(
                "NORMAL",
                availableBeforeManualStop.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: inventory availability and manual sale status start independently");

        String soldOutPath = publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-sold-out");
        String soldOutKey = "sm05-manual-sold-out-" + suffix();
        Map<String, Object> soldOutBody = manualTargetCommandBody("ITEM", itemRef, "午餐档位暂停售卖", version);
        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                soldOutPath,
                menus.session().cookie(),
                soldOutBody,
                Map.of("Idempotency-Key", soldOutKey),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", menuRef, itemRef);
        BackendAcceptanceTest.Response soldOutReplay = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                soldOutPath,
                menus.session().cookie(),
                soldOutBody,
                Map.of("Idempotency-Key", soldOutKey),
                Set.of(200));
        assertEquals(
                soldOut.json(),
                soldOutReplay.json(),
                "BUSINESS: repeated manual sold-out command replays the exact owner readback");
        JsonNode beforeWrongTargetReplay = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        BackendAcceptanceTest.Response wrongTargetReplay = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(menus, UUID.randomUUID(), itemRef, firstChannel, "manual-sold-out"),
                menus.session().cookie(),
                soldOutBody,
                Map.of("Idempotency-Key", soldOutKey),
                Set.of(404));
        assertEquals(
                "SALES_MENU_NOT_FOUND",
                wrongTargetReplay.problemCode(),
                "BUSINESS: replay cannot bypass the actual sales-menu target check");
        assertEquals(
                beforeWrongTargetReplay,
                publishedItem(context, menus, menuRef, itemRef, firstChannel),
                "BUSINESS: a wrong-target replay leaves the original published read model unchanged");
        BackendAcceptanceTest.Response soldOutConflict = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                soldOutPath,
                menus.session().cookie(),
                manualTargetCommandBody("ITEM", itemRef, "另一项停售意图", version),
                Map.of("Idempotency-Key", soldOutKey),
                Set.of(409));
        assertEquals(
                "IDEMPOTENCY_CONFLICT",
                soldOutConflict.problemCode(),
                "BUSINESS: reusing a manual sold-out key for another intent is rejected");
        JsonNode firstAfterSoldOut = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        JsonNode secondAfterSoldOut = publishedItem(context, menus, menuRef, itemRef, secondChannel);
        assertEquals(
                "MANUAL_SOLD_OUT",
                firstAfterSoldOut.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: manual stop applies to the requested channel");
        assertEquals(
                "午餐档位暂停售卖",
                firstAfterSoldOut.path("manualSaleStatus").path("reason").asText(),
                "BUSINESS: manual stop preserves its required reason");
        assertEquals(
                "NORMAL",
                secondAfterSoldOut.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: manual stop does not affect a second channel");

        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), catalogItem, "0", true, "sales-menu-manual-stock-out");
        JsonNode manualAndAutoUnavailable = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        assertEquals(
                "AUTO_UNAVAILABLE",
                manualAndAutoUnavailable
                        .path("inventoryAvailability")
                        .path("state")
                        .asText(),
                "BUSINESS: the inventory owner independently reports an out-of-stock item");
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualAndAutoUnavailable.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: inventory becoming unavailable does not restore manual sale status");
        assertEquals(
                "午餐档位暂停售卖",
                manualAndAutoUnavailable.path("manualSaleStatus").path("reason").asText(),
                "BUSINESS: inventory change preserves the manual stop reason");
        catalog.acceptanceCountInventoryTarget(
                context, menus.fixture(), menus.session(), catalogItem, "1", false, "sales-menu-manual-stock-return");
        JsonNode manualAfterStockReturn = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        assertEquals(
                "AVAILABLE",
                manualAfterStockReturn
                        .path("inventoryAvailability")
                        .path("state")
                        .asText(),
                "BUSINESS: derived inventory availability returns when stock returns");
        assertEquals(
                "MANUAL_SOLD_OUT",
                manualAfterStockReturn.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: stock returning does not auto-restore manual sale status");

        JsonNode beforeMissingReason = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        Map<String, Object> missingReason = manualTargetCommandBody("ITEM", itemRef, "", version);
        BackendAcceptanceTest.Response reasonRejected = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-sold-out"),
                menus.session().cookie(),
                missingReason,
                idempotencyHeaders("sales-menu-missing-reason"),
                Set.of(422));
        assertFalse(
                reasonRejected.problemCode().isBlank(),
                "BUSINESS: missing manual-stop reason is a typed validation rejection");
        assertEquals(
                "SALES_MENU_MANUAL_REASON_REQUIRED",
                reasonRejected.problemCode(),
                "BUSINESS: missing manual-stop reason uses the sales-menu problem code");
        assertEquals(
                beforeMissingReason,
                publishedItem(context, menus, menuRef, itemRef, firstChannel),
                "BUSINESS: missing reason does not change the complete published read model");
        assertEquals(
                "MANUAL_SOLD_OUT",
                publishedItem(context, menus, menuRef, itemRef, firstChannel)
                        .path("manualSaleStatus")
                        .path("state")
                        .asText(),
                "BUSINESS: missing reason leaves the existing manual status unchanged");

        version = updateItem(
                context,
                menus,
                menuRef,
                prepared.item(),
                version,
                itemUpdateBody(null, directSale(2900), ordering(1, 1), inheritedMedia(), version));
        version = publish(context, menus, menuRef, version);
        assertEquals(
                "MANUAL_SOLD_OUT",
                publishedItem(context, menus, menuRef, itemRef, firstChannel)
                        .path("manualSaleStatus")
                        .path("state")
                        .asText(),
                "BUSINESS: republishing does not automatically restore manual sale status");

        JsonNode beforeUnconfirmedRestore = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        Map<String, Object> notConfirmedBody = manualRestoreCommandBody("ITEM", itemRef, version);
        notConfirmedBody.put("confirm", false);
        BackendAcceptanceTest.Response notConfirmed = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-restore"),
                menus.session().cookie(),
                notConfirmedBody,
                idempotencyHeaders("sales-menu-unconfirmed-restore"),
                Set.of(422));
        assertEquals(
                "CONFIRMATION_REQUIRED",
                notConfirmed.problemCode(),
                "BUSINESS: restore requires explicit confirmation");
        assertEquals(
                beforeUnconfirmedRestore,
                publishedItem(context, menus, menuRef, itemRef, firstChannel),
                "BUSINESS: an unconfirmed restore leaves the complete published read model unchanged");
        String restorePath = publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-restore");
        String restoreKey = "sm05-manual-restore-" + suffix();
        Map<String, Object> restoreBody = manualRestoreCommandBody("ITEM", itemRef, version);
        BackendAcceptanceTest.Response restored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                restorePath,
                menus.session().cookie(),
                restoreBody,
                Map.of("Idempotency-Key", restoreKey),
                Set.of(200));
        version = assertCommand(restored, "restoreOperationsSalesMenuItemSale", menuRef, itemRef);
        JsonNode restoredItem = publishedItem(context, menus, menuRef, itemRef, firstChannel);
        assertEquals(
                "NORMAL",
                restoredItem.path("manualSaleStatus").path("state").asText(),
                "BUSINESS: confirmed restore returns the item to normal sale");
        assertTrue(
                restoredItem.path("manualSaleStatus").path("reason").isNull(),
                "BUSINESS: restore clears the manual stop reason");
        assertEquals(
                beforeUnconfirmedRestore.path("inventoryAvailability"),
                restoredItem.path("inventoryAvailability"),
                "BUSINESS: restoring manual sale does not rewrite inventory availability");
        BackendAcceptanceTest.Response restoreReplay = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                restorePath,
                menus.session().cookie(),
                restoreBody,
                Map.of("Idempotency-Key", restoreKey),
                Set.of(200));
        assertEquals(
                restored.json(),
                restoreReplay.json(),
                "BUSINESS: repeated manual restore command replays the exact owner readback");
        assertTrue(version > 0, "BUSINESS: published menu has a nonzero version for CAS validation");
        BackendAcceptanceTest.Response staleManualCommand = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                soldOutPath,
                menus.session().cookie(),
                manualTargetCommandBody("ITEM", itemRef, "过期版本停售", version - 1),
                Map.of("Idempotency-Key", "sm05-manual-stale-" + suffix()),
                Set.of(409));
        assertTrue(
                Set.of("VERSION_CONFLICT", "SALES_MENU_VERSION_CONFLICT").contains(staleManualCommand.problemCode()),
                "BUSINESS: stale manual-sale version is a typed CAS conflict");
        assertEquals(
                restoredItem,
                publishedItem(context, menus, menuRef, itemRef, firstChannel),
                "BUSINESS: stale manual-sale command leaves the complete read model unchanged");

        BackendAcceptanceTest.Response manualRecords = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, menuRef, firstChannel) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        int soldOutSuccesses = 0;
        int restoreSuccesses = 0;
        for (JsonNode record : manualRecords.json().path("items")) {
            if (!menuRef.toString().equals(record.path("salesMenuRef").asText())
                    || !itemRef.toString().equals(record.path("targetRef").asText())
                    || !"SUCCESS".equals(record.path("result").asText())) continue;
            assertFalse(
                    record.path("actorDisplayName").asText().isBlank(),
                    "BUSINESS: successful manual-sale history retains the actor display snapshot");
            if ("setOperationsSalesMenuItemSoldOut"
                    .equals(record.path("operationKind").asText())) soldOutSuccesses++;
            if ("restoreOperationsSalesMenuItemSale"
                    .equals(record.path("operationKind").asText())) restoreSuccesses++;
        }
        assertEquals(1, soldOutSuccesses, "BUSINESS: operation records retain the successful manual sold-out event");
        assertEquals(1, restoreSuccesses, "BUSINESS: operation records retain the successful manual restore event");
    }

    @AcceptanceScenario(
            id = "sales-menu.operation-record-cursor",
            module = "SALES_MENU",
            operation = "getOperationsSalesMenuOperationRecords")
    void operationRecordCursor(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 records");
        MenuState menu =
                createMenu(context, menus, "SM05 records menu", menus.channels().getFirst());
        long version = menu.version();
        SectionState first = createSection(context, menus, menu.ref(), "SM05 records section", version);
        version = first.menuVersion();
        JsonNode item = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-REC-" + suffix(), "SM05 records item");
        UUID catalogRef = UUID.fromString(item.path("itemRef").asText());
        version = addItems(context, menus, menu.ref(), first.ref(), version, List.of(catalogRef));
        for (int index = 0; index < 17; index++)
            version = createSection(context, menus, menu.ref(), "SM05 records empty " + index, version)
                    .menuVersion();
        BackendAcceptanceTest.Response failed = context.delete(
                OPERATIONS_SALES_MENU_SECTION_DELETE,
                sectionPath(menus, menu.ref(), first.ref()),
                menus.session().cookie(),
                Map.of("expectedVersion", version),
                Set.of(409));
        assertEquals(
                "SECTION_NOT_EMPTY",
                failed.problemCode(),
                "BUSINESS: records fixture creates a real failed owner operation");

        BackendAcceptanceTest.Response firstPage = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, menu.ref(), menus.channels().getFirst()) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                20,
                firstPage.json().path("items").size(),
                "BUSINESS: operation records fill the first fixed-size page");
        String cursor = nextCursor(firstPage.json());
        assertFalse(cursor.isBlank(), "BUSINESS: operation records expose a real continuation cursor");
        BackendAcceptanceTest.Response secondPage = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, menu.ref(), menus.channels().getFirst()) + "&pageSize=20&cursor=" + encode(cursor),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                secondPage.json().path("items").size(),
                "BUSINESS: operation records expose exactly the twenty-first tail record");
        assertTrue(
                nextCursor(secondPage.json()).isBlank(),
                "BUSINESS: the exact twenty-first record is the end of the cursor collection");
        Set<String> records = new HashSet<>();
        Map<String, Integer> expectedFacts = new LinkedHashMap<>();
        expectedFacts.merge(
                operationRecordFact("createOperationsSalesMenu", menu.ref(), "SUCCESS", null), 1, Integer::sum);
        expectedFacts.merge(
                operationRecordFact("addOperationsSalesMenuItems", menu.ref(), "SUCCESS", null), 1, Integer::sum);
        expectedFacts.merge(
                operationRecordFact("createOperationsSalesMenuSection", menu.ref(), "SUCCESS", null), 18, Integer::sum);
        expectedFacts.merge(
                operationRecordFact("deleteOperationsSalesMenuSection", menu.ref(), "FAILED", "SECTION_NOT_EMPTY"),
                1,
                Integer::sum);
        Map<String, Integer> actualFacts = new LinkedHashMap<>();
        boolean failedRecord = false;
        for (JsonNode row :
                concatNodes(firstPage.json().path("items"), secondPage.json().path("items"))) {
            String recordRef = requiredJsonNode(
                            row, "/operationRecordRef", JsonNodeType.STRING, "BUSINESS: operation record identity")
                    .asText();
            assertTrue(records.add(recordRef), "BUSINESS: operation-record pages contain no duplicates");
            assertEquals(
                    menu.ref().toString(),
                    row.path("salesMenuRef").asText(),
                    "BUSINESS: operation record retains its collection identity");
            assertFalse(
                    row.path("operationKind").asText().isBlank(),
                    "BUSINESS: operation record exposes the generated operation identity");
            assertTrue(
                    row.path("result").asText().equals("SUCCESS")
                            || row.path("result").asText().equals("FAILED"),
                    "BUSINESS: operation record result is typed");
            assertFalse(
                    row.has("rawPayload") || row.has("requestPayload") || row.has("diagnostic"),
                    "CONTRACT: operation record does not expose raw diagnostics");
            actualFacts.merge(
                    operationRecordFact(
                            row.path("operationKind").asText(),
                            UUID.fromString(row.path("salesMenuRef").asText()),
                            row.path("result").asText(),
                            row.path("failureCode").isNull()
                                    ? null
                                    : row.path("failureCode").asText()),
                    1,
                    Integer::sum);
            if ("FAILED".equals(row.path("result").asText())) {
                failedRecord = true;
                assertEquals(
                        "SECTION_NOT_EMPTY",
                        row.path("failureCode").asText(),
                        "BUSINESS: rejected delete has the exact owner failure code");
            }
        }
        assertTrue(failedRecord, "BUSINESS: rejected owner command is visible in the record cursor");
        assertEquals(21, records.size(), "BUSINESS: cursor traversal has exactly twenty-one distinct records");
        assertEquals(expectedFacts, actualFacts, "BUSINESS: cursor traversal has no omission and no unexpected record");
    }

    @AcceptanceScenario(
            id = "sales-menu.command-idempotency-and-cas",
            module = "SALES_MENU",
            operation = "createOperationsSalesMenu")
    void commandIdempotencyAndCas(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 idempotency");
        String root = menuRoot(menus.fixture());
        UUID channel = menus.channels().getFirst();
        String createKey = "sm05-create-key-" + suffix();
        Map<String, Object> createBody = Map.of("channelRef", channel, "name", "SM05 idempotent menu");
        BackendAcceptanceTest.Response first = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                root,
                menus.session().cookie(),
                createBody,
                Map.of("Idempotency-Key", createKey),
                Set.of(201));
        UUID firstRef = UUID.fromString(first.json().path("salesMenuRef").asText());
        BackendAcceptanceTest.Response replay = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                root,
                menus.session().cookie(),
                createBody,
                Map.of("Idempotency-Key", createKey),
                Set.of(201));
        assertEquals(
                first.json(),
                replay.json(),
                "BUSINESS: the same create idempotency key replays the exact owner readback");
        assertEquals(
                firstRef.toString(),
                replay.json().path("salesMenuRef").asText(),
                "BUSINESS: idempotent replay does not allocate another menu");

        BackendAcceptanceTest.Response conflict = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                root,
                menus.session().cookie(),
                Map.of("channelRef", channel, "name", "SM05 conflicting intent"),
                Map.of("Idempotency-Key", createKey),
                Set.of(409));
        assertEquals(
                "IDEMPOTENCY_CONFLICT",
                conflict.problemCode(),
                "BUSINESS: reusing a key for a new create intent is rejected");

        BackendAcceptanceTest.Response second = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                root,
                menus.session().cookie(),
                Map.of("channelRef", channel, "name", "SM05 second intent"),
                Map.of("Idempotency-Key", "sm05-create-new-" + suffix()),
                Set.of(201));
        UUID secondRef = UUID.fromString(second.json().path("salesMenuRef").asText());
        assertFalse(firstRef.equals(secondRef), "BUSINESS: a new idempotency key creates a new collection");
        BackendAcceptanceTest.Response list = context.get(
                OPERATIONS_SALES_MENUS,
                root + "?channelRef=" + channel + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(2, list.json().path("items").size(), "BUSINESS: replay is not counted as a duplicate collection");

        BackendAcceptanceTest.Response stale = context.patch(
                OPERATIONS_SALES_MENU_RENAME,
                root + "/" + firstRef + "/name",
                menus.session().cookie(),
                Map.of("name", "SM05 stale rename", "expectedVersion", 0),
                Set.of(409));
        assertTrue(
                Set.of("VERSION_CONFLICT", "SALES_MENU_VERSION_CONFLICT").contains(stale.problemCode()),
                "BUSINESS: stale aggregate version is a typed CAS conflict");
        assertEquals(
                "SM05 idempotent menu",
                readMenu(context, menus, firstRef, channel).json().path("name").asText(),
                "BUSINESS: stale CAS leaves the collection name unchanged");
        assertTrue(
                assertCommand(first, "createOperationsSalesMenu", firstRef, firstRef) > 0
                        && assertCommand(second, "createOperationsSalesMenu", secondRef, secondRef) > 0,
                "BUSINESS: both distinct intents return authoritative command readbacks");
    }

    @AcceptanceScenario(
            id = "sales-menu.generated-route-contract",
            module = "SALES_MENU",
            operation = "generatedSalesMenuRouteContract")
    void generatedRouteContract(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        MenuFixture menus = menuFixture(context, 1, "SM05 routes");
        UUID channel = menus.channels().getFirst();
        MenuState menu = createMenu(context, menus, "SM05 route menu", channel);
        BackendAcceptanceTest.Response menuList = context.get(
                OPERATIONS_SALES_MENUS,
                menuRoot(menus.fixture()) + "?channelRef=" + channel + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                menu.ref().toString(),
                menuList.json().path("items").get(0).path("salesMenuRef").asText(),
                "BUSINESS: generated menu-list route returns the created identity");
        assertEquals(
                menu.ref().toString(),
                readMenu(context, menus, menu.ref(), channel)
                        .json()
                        .path("salesMenuRef")
                        .asText(),
                "BUSINESS: generated menu-detail route returns the created identity");

        JsonNode item = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-ROUTE-" + suffix(), "SM05 route item");
        UUID catalogRef = UUID.fromString(item.path("itemRef").asText());
        BackendAcceptanceTest.Response candidates = context.get(
                OPERATIONS_SALES_MENU_CANDIDATES,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/item-candidates?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                containsRef(candidates.json().path("items"), "catalogItemRef", catalogRef),
                "BUSINESS: generated candidate route returns a real catalog candidate");
        SectionState section = createSection(context, menus, menu.ref(), "SM05 route section", menu.version());
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState draftItem = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        BackendAcceptanceTest.Response draftSections = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                1,
                draftSections.json().path("items").size(),
                "BUSINESS: generated draft-section route returns the owner section");
        BackendAcceptanceTest.Response draftItems = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menu.ref(), section.ref()) + "?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                containsRef(draftItems.json().path("items"), "salesItemRef", draftItem.ref()),
                "BUSINESS: generated draft-item page route returns the owner item");
        assertEquals(
                draftItem.ref().toString(),
                context.get(
                                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                                draftItemPath(menus, menu.ref(), draftItem.ref()),
                                menus.session().cookie(),
                                Set.of(200))
                        .json()
                        .path("salesItemRef")
                        .asText(),
                "BUSINESS: generated draft-item detail route returns the owner item");

        BackendAcceptanceTest.Response blockedPreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(menus, menu.ref(), channel),
                menus.session().cookie(),
                Set.of(200));
        assertSinglePublicationBlocker(
                blockedPreview.json(),
                "LISTED_PRICE_MISSING",
                draftItem.ref(),
                "salesMenu.listedPrice.required",
                "BUSINESS: generated preview route returns the exact business violation");
        version = updateItem(
                context,
                menus,
                menu.ref(),
                draftItem,
                version,
                itemUpdateBody(null, directSale(1800), ordering(1, 1), inheritedMedia(), version));
        version = updateSchedule(context, menus, menu.ref(), version, allDaySchedule());
        version = publish(context, menus, menu.ref(), version);
        BackendAcceptanceTest.Response publishedSections = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menu.ref() + "/published/sections",
                menus.session().cookie(),
                Set.of(200));
        UUID publishedSection = UUID.fromString(publishedSections
                .json()
                .path("items")
                .get(0)
                .path("salesSectionRef")
                .asText());
        BackendAcceptanceTest.Response publishedItems = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                publishedItemsPath(menus, menu.ref(), publishedSection, channel) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                containsRef(publishedItems.json().path("items"), "salesItemRef", draftItem.ref()),
                "BUSINESS: generated published-item page route returns the frozen owner item");
        assertEquals(
                draftItem.ref().toString(),
                context.get(
                                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                                publishedItemPath(menus, menu.ref(), draftItem.ref(), channel),
                                menus.session().cookie(),
                                Set.of(200))
                        .json()
                        .path("salesItemRef")
                        .asText(),
                "BUSINESS: generated published-item detail route returns the frozen identity");
        version = setActivation(context, menus, menu.ref(), channel, "ENABLED", version);
        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(menus, menu.ref(), draftItem.ref(), channel, "manual-sold-out"),
                menus.session().cookie(),
                manualTargetCommandBody("ITEM", draftItem.ref(), "SM05 route check", version),
                idempotencyHeaders("sales-menu-route-sold-out"),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), draftItem.ref());
        BackendAcceptanceTest.Response restored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(menus, menu.ref(), draftItem.ref(), channel, "manual-restore"),
                menus.session().cookie(),
                manualRestoreCommandBody("ITEM", draftItem.ref(), version),
                idempotencyHeaders("sales-menu-route-restore"),
                Set.of(200));
        version = assertCommand(restored, "restoreOperationsSalesMenuItemSale", menu.ref(), draftItem.ref());
        BackendAcceptanceTest.Response records = context.get(
                OPERATIONS_SALES_MENU_RECORDS,
                recordsPath(menus, menu.ref(), channel) + "&pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        assertTrue(
                records.json().path("items").size() >= 1,
                "BUSINESS: generated operation-record route returns command history");
        assertTrue(version > 0, "BUSINESS: generated sales-menu routes preserve a real aggregate version");
    }

    private MenuFixture menuFixture(BackendAcceptanceTest.ScenarioContext context, int channelCount, String label)
            throws Exception {
        return menuFixture(context, channelCount, label, STORE_CAPABILITIES);
    }

    private MenuFixture menuFixture(
            BackendAcceptanceTest.ScenarioContext context, int channelCount, String label, Set<String> capabilities)
            throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", capabilities);
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = selectStore(context, fixture, host.login(context, fixture));
        List<UUID> channelRefs =
                channels.acceptanceCreateSalesMenuEligibleStoreChannels(context, fixture, session, channelCount, label);
        return new MenuFixture(fixture, session, channelRefs);
    }

    private PreparedMenu preparePlainMenu(BackendAcceptanceTest.ScenarioContext context, String label)
            throws Exception {
        return preparePlainMenu(context, menuFixture(context, 1, label), label);
    }

    private PreparedMenu preparePlainMenu(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, String label) throws Exception {
        MenuState menu =
                createMenu(context, menus, label + " menu", menus.channels().getFirst());
        String catalogItemCode = "SM05-PREP-" + suffix();
        JsonNode item = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), catalogItemCode, label + " item");
        UUID catalogRef = UUID.fromString(item.path("itemRef").asText());
        SectionState section = createSection(context, menus, menu.ref(), label + " section", menu.version());
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState draftItem = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        return new PreparedMenu(menus, menu, section, draftItem, catalogItemCode, version);
    }

    private MenuState createMenu(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, String name, UUID channelRef)
            throws Exception {
        BackendAcceptanceTest.Response response = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", channelRef, "name", name),
                Set.of(201));
        UUID menuRef = UUID.fromString(requiredJsonNode(
                        response.json(), "/salesMenuRef", JsonNodeType.STRING, "BUSINESS: create menu reference")
                .asText());
        long version = assertCommand(response, "createOperationsSalesMenu", menuRef, menuRef);
        return new MenuState(menuRef, version);
    }

    private SectionState createSection(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            String name,
            long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response created = context.post(
                OPERATIONS_SALES_MENU_SECTION_CREATE,
                menuRoot(menus.fixture()) + "/" + menuRef + "/draft/sections",
                menus.session().cookie(),
                Map.of("name", name, "expectedVersion", expectedVersion),
                Set.of(201));
        long menuVersion = assertCommand(created, "createOperationsSalesMenuSection", menuRef, null);
        BackendAcceptanceTest.Response sections = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot(menus.fixture()) + "/" + menuRef + "/draft/sections",
                menus.session().cookie(),
                Set.of(200));
        for (JsonNode row : sections.json().path("items")) {
            if (name.equals(row.path("name").asText()))
                return new SectionState(
                        UUID.fromString(row.path("salesSectionRef").asText()), menuVersion);
        }
        throw new AssertionError("BUSINESS: created section is absent from the owner readback");
    }

    private long addItems(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            long expectedVersion,
            List<UUID> catalogRefs)
            throws Exception {
        BackendAcceptanceTest.Response added = context.post(
                OPERATIONS_SALES_MENU_ITEMS_ADD,
                draftItemsPath(menus, menuRef, sectionRef),
                menus.session().cookie(),
                Map.of("catalogItemRefs", catalogRefs, "expectedVersion", expectedVersion),
                Set.of(201));
        return assertCommand(added, "addOperationsSalesMenuItems", menuRef, menuRef);
    }

    private ItemState findDraftItem(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            UUID catalogRef)
            throws Exception {
        BackendAcceptanceTest.Response page = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                draftItemsPath(menus, menuRef, sectionRef) + "?pageSize=20",
                menus.session().cookie(),
                Set.of(200));
        for (JsonNode row : page.json().path("items")) {
            if (catalogRef.toString().equals(row.path("catalogItemRef").asText())) return itemState(row);
        }
        String cursor = nextCursor(page.json());
        while (!cursor.isBlank()) {
            page = context.get(
                    OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                    draftItemsPath(menus, menuRef, sectionRef) + "?pageSize=20&cursor=" + encode(cursor),
                    menus.session().cookie(),
                    Set.of(200));
            for (JsonNode row : page.json().path("items")) {
                if (catalogRef.toString().equals(row.path("catalogItemRef").asText())) return itemState(row);
            }
            cursor = nextCursor(page.json());
        }
        throw new AssertionError("BUSINESS: draft item is absent from the owner page");
    }

    private List<ItemState> findDraftItems(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            UUID catalogRef)
            throws Exception {
        return readAllDraftItemRows(context, menus, menuRef, sectionRef).stream()
                .filter(row ->
                        catalogRef.toString().equals(row.path("catalogItemRef").asText()))
                .map(SalesMenuAcceptanceScenarios::itemState)
                .toList();
    }

    private List<JsonNode> readAllDraftItemRows(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, UUID sectionRef)
            throws Exception {
        List<JsonNode> rows = new ArrayList<>();
        String cursor = "";
        while (true) {
            String path = draftItemsPath(menus, menuRef, sectionRef) + "?pageSize=20"
                    + (cursor.isBlank() ? "" : "&cursor=" + encode(cursor));
            BackendAcceptanceTest.Response page = context.get(
                    OPERATIONS_SALES_MENU_DRAFT_ITEMS, path, menus.session().cookie(), Set.of(200));
            rows.addAll(iterable(page.json().path("items")));
            cursor = nextCursor(page.json());
            if (cursor.isBlank()) return rows;
        }
    }

    private static List<String> sectionFacts(JsonNode page) {
        List<String> facts = new ArrayList<>();
        for (JsonNode row : page.path("items")) {
            facts.add(sectionFact(
                    UUID.fromString(row.path("salesSectionRef").asText()),
                    row.path("name").asText(),
                    row.path("displayOrder").asLong(),
                    row.path("itemCount").asLong(),
                    row.path("canMoveUp").asBoolean(),
                    row.path("canMoveDown").asBoolean()));
        }
        return facts;
    }

    private static String sectionFact(
            UUID sectionRef, String name, long displayOrder, long itemCount, boolean canMoveUp, boolean canMoveDown) {
        return sectionRef + "|" + name + "|" + displayOrder + "|" + itemCount + "|" + canMoveUp + "|" + canMoveDown;
    }

    private ItemState readDraftItemState(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, UUID itemRef)
            throws Exception {
        BackendAcceptanceTest.Response response = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, menuRef, itemRef),
                menus.session().cookie(),
                Set.of(200));
        return itemState(response.json());
    }

    private static ItemState itemState(JsonNode row) {
        return new ItemState(
                UUID.fromString(row.path("salesItemRef").asText()),
                UUID.fromString(row.path("catalogItemRef").asText()),
                row.path("version").asLong());
    }

    private long updateItem(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            ItemState item,
            long expectedVersion,
            Map<String, Object> body)
            throws Exception {
        return updateItem(context, menus, menuRef, item, expectedVersion, body, Map.of());
    }

    private long updateItem(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            ItemState item,
            long expectedVersion,
            Map<String, Object> body,
            Map<String, String> headers)
            throws Exception {
        BackendAcceptanceTest.Response updated = context.put(
                OPERATIONS_SALES_MENU_ITEM_UPDATE,
                draftItemPath(menus, menuRef, item.ref()),
                menus.session().cookie(),
                body,
                headers,
                Set.of(200));
        return assertCommand(updated, "updateOperationsSalesMenuItem", menuRef, item.ref());
    }

    private long renameMenu(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            long expectedVersion,
            String name)
            throws Exception {
        BackendAcceptanceTest.Response renamed = context.patch(
                OPERATIONS_SALES_MENU_RENAME,
                menuRoot(menus.fixture()) + "/" + menuRef + "/name",
                menus.session().cookie(),
                Map.of("name", name, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(renamed, "renameOperationsSalesMenu", menuRef, menuRef);
    }

    private long archiveMenu(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response archived = context.post(
                OPERATIONS_SALES_MENU_ARCHIVE,
                menuRoot(menus.fixture()) + "/" + menuRef + "/archive",
                menus.session().cookie(),
                Map.of("expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(archived, "archiveOperationsSalesMenu", menuRef, menuRef);
    }

    private long setActivation(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID channelRef,
            String status,
            long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response activation = context.put(
                OPERATIONS_SALES_MENU_ACTIVATION,
                menuRoot(menus.fixture()) + "/" + menuRef + "/channels/" + channelRef + "/activation",
                menus.session().cookie(),
                Map.of("status", status, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(activation, "setOperationsSalesMenuActivation", menuRef, menuRef);
    }

    private long updateSchedule(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            long expectedVersion,
            Map<String, Object> schedule)
            throws Exception {
        BackendAcceptanceTest.Response updated = context.put(
                OPERATIONS_SALES_MENU_SCHEDULE,
                menuRoot(menus.fixture()) + "/" + menuRef + "/draft/schedule",
                menus.session().cookie(),
                Map.of("schedule", schedule, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(updated, "updateOperationsSalesMenuSchedule", menuRef, menuRef);
    }

    private long publish(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response published = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot(menus.fixture()) + "/" + menuRef + "/publications",
                menus.session().cookie(),
                Map.of("expectedVersion", expectedVersion),
                Set.of(201));
        return assertCommand(published, "publishOperationsSalesMenu", menuRef, menuRef);
    }

    private long renameSection(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            long expectedVersion,
            String name)
            throws Exception {
        BackendAcceptanceTest.Response renamed = context.patch(
                OPERATIONS_SALES_MENU_SECTION_RENAME,
                sectionPath(menus, menuRef, sectionRef) + "/name",
                menus.session().cookie(),
                Map.of("name", name, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(renamed, "renameOperationsSalesMenuSection", menuRef, menuRef);
    }

    private long moveSection(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            long expectedVersion,
            String direction)
            throws Exception {
        BackendAcceptanceTest.Response moved = context.post(
                OPERATIONS_SALES_MENU_SECTION_MOVE,
                sectionPath(menus, menuRef, sectionRef) + "/move",
                menus.session().cookie(),
                Map.of("direction", direction, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(moved, "moveOperationsSalesMenuSection", menuRef, menuRef);
    }

    private long deleteSection(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID sectionRef,
            long expectedVersion)
            throws Exception {
        BackendAcceptanceTest.Response deleted = context.delete(
                OPERATIONS_SALES_MENU_SECTION_DELETE,
                sectionPath(menus, menuRef, sectionRef),
                menus.session().cookie(),
                Map.of("expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(deleted, "deleteOperationsSalesMenuSection", menuRef, menuRef);
    }

    private long moveItem(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID itemRef,
            long expectedVersion,
            String direction)
            throws Exception {
        BackendAcceptanceTest.Response moved = context.post(
                OPERATIONS_SALES_MENU_ITEM_MOVE,
                draftItemPath(menus, menuRef, itemRef) + "/move",
                menus.session().cookie(),
                Map.of("direction", direction, "expectedVersion", expectedVersion),
                Set.of(200));
        return assertCommand(moved, "moveOperationsSalesMenuItem", menuRef, itemRef);
    }

    private MenuReadResult readMenu(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, UUID channelRef)
            throws Exception {
        return new MenuReadResult(context.get(
                        OPERATIONS_SALES_MENU,
                        menuRoot(menus.fixture()) + "/" + menuRef + "?channelRef=" + channelRef,
                        menus.session().cookie(),
                        Set.of(200))
                .json());
    }

    private JsonNode publishedItem(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID itemRef,
            UUID channelRef)
            throws Exception {
        return context.get(
                        OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                        publishedItemPath(menus, menuRef, itemRef, channelRef),
                        menus.session().cookie(),
                        Set.of(200))
                .json();
    }

    private long assertCommand(
            BackendAcceptanceTest.Response response, String operation, UUID expectedMenuRef, UUID expectedTargetRef) {
        JsonNode json = response.json();
        assertTrue(json.isObject() && json.size() > 0, "CONTRACT: command response is a structured object");
        assertEquals(
                operation,
                requiredJsonNode(json, "/operationKind", JsonNodeType.STRING, "BUSINESS: command operation identity")
                        .asText(),
                "BUSINESS: command operation identity is exact");
        UUID menuRef = UUID.fromString(
                requiredJsonNode(json, "/salesMenuRef", JsonNodeType.STRING, "BUSINESS: command menu identity")
                        .asText());
        if (expectedMenuRef != null) {
            assertEquals(expectedMenuRef, menuRef, "BUSINESS: command menu identity is scoped");
        }
        if (expectedTargetRef != null)
            assertEquals(
                    expectedTargetRef.toString(),
                    requiredJsonNode(json, "/targetRef", JsonNodeType.STRING, "BUSINESS: command target identity")
                            .asText(),
                    "BUSINESS: command target identity is exact");
        long version = requiredJsonNode(json, "/version", JsonNodeType.NUMBER, "BUSINESS: command aggregate version")
                .asLong();
        assertTrue(version > 0, "BUSINESS: command aggregate version is positive");
        assertFalse(
                requiredJsonNode(json, "/readbackStatus", JsonNodeType.STRING, "BUSINESS: command readback status")
                        .asText()
                        .isBlank(),
                "BUSINESS: command readback status is explicit");
        return version;
    }

    private static Map<String, Object> itemUpdateBody(
            String displayNameOverride,
            Map<String, Object> saleContent,
            Map<String, Object> ordering,
            Map<String, Object> displayMedia,
            long expectedVersion) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("displayNameOverride", displayNameOverride);
        body.put("saleContent", saleContent);
        body.put("orderingConstraints", ordering);
        body.put("displayMedia", displayMedia);
        body.put("expectedVersion", expectedVersion);
        return body;
    }

    private static Map<String, Object> directSale(long price) {
        return saleContent("DIRECT", price, List.of());
    }

    private static Map<String, Object> saleContent(
            String kind, Long listedPriceCents, List<Map<String, Object>> skuPrices) {
        return saleContent(kind, listedPriceCents, skuPrices, List.of());
    }

    private static Map<String, Object> saleContent(
            String kind,
            Long listedPriceCents,
            List<Map<String, Object>> skuPrices,
            List<Map<String, Object>> orderOptionSelections) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("kind", kind);
        content.put("listedPriceCents", listedPriceCents);
        content.put("skuPrices", skuPrices);
        content.put("orderOptionSelections", orderOptionSelections);
        return content;
    }

    private static Map<String, Object> skuPrice(JsonNode sku, long listedPriceCents) {
        return skuPrice(
                UUID.fromString(sku.path("productSkuRef").asText()),
                sku.path("skuName").asText(),
                sku.path("skuCode").asText(),
                sku.path("standardSalePrice").asLong(),
                listedPriceCents);
    }

    private static Map<String, Object> optionSelection(JsonNode config, List<Integer> valueIndexes) {
        List<UUID> valueRefs = new ArrayList<>();
        for (Integer index : valueIndexes) {
            valueRefs.add(UUID.fromString(
                    config.path("values").get(index).path("definitionValueRef").asText()));
        }
        return optionSelection(UUID.fromString(config.path("definitionRef").asText()), valueRefs);
    }

    private static Map<String, Object> optionSelection(UUID definitionRef, List<UUID> selectedValueRefs) {
        Map<String, Object> selection = new LinkedHashMap<>();
        selection.put("definitionRef", definitionRef);
        selection.put("selectedValueRefs", selectedValueRefs);
        return selection;
    }

    private static Map<String, Object> manualTargetCommandBody(
            String targetKind, UUID targetRef, String reason, long expectedVersion) {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("targetKind", targetKind);
        target.put("targetRef", targetRef);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("target", target);
        body.put("reason", reason);
        body.put("expectedVersion", expectedVersion);
        return body;
    }

    private static Map<String, Object> manualRestoreCommandBody(
            String targetKind, UUID targetRef, long expectedVersion) {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("targetKind", targetKind);
        target.put("targetRef", targetRef);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("target", target);
        body.put("confirm", true);
        body.put("expectedVersion", expectedVersion);
        return body;
    }

    private static Map<String, String> idempotencyHeaders(String operation) {
        return Map.of("Idempotency-Key", "sales-menu-" + operation + "-" + suffix());
    }

    private static Map<String, Object> skuPrice(
            UUID skuRef, String skuName, String skuCode, long standardPriceCents, long listedPriceCents) {
        Map<String, Object> price = new LinkedHashMap<>();
        price.put("skuRef", skuRef);
        price.put("skuName", skuName);
        price.put("skuCode", skuCode);
        price.put("standardPriceCents", standardPriceCents);
        price.put("listedPriceCents", listedPriceCents);
        return price;
    }

    private static Map<String, Object> ordering(Integer minimum, Integer step) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("minItemQuantity", minimum);
        result.put("quantityStep", step);
        return result;
    }

    private static Map<String, Object> inheritedMedia() {
        return media("INHERIT_CATALOG", List.of(), null);
    }

    private static Map<String, Object> customMedia(UUID assetRef) {
        return media("CUSTOM", List.of(assetRef), assetRef);
    }

    private static Map<String, Object> media(String mode, List<UUID> assetRefs, UUID primaryAssetRef) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", mode);
        result.put("assetRefs", assetRefs);
        result.put("primaryAssetRef", primaryAssetRef);
        return result;
    }

    private static Map<String, Object> dailySchedule() {
        Map<String, Object> schedule = new LinkedHashMap<>();
        schedule.put("kind", "DAILY_TIME_RANGE");
        schedule.put("startLocalTime", "09:00");
        schedule.put("endLocalTime", "22:00");
        return schedule;
    }

    private static Map<String, Object> allDaySchedule() {
        Map<String, Object> schedule = new LinkedHashMap<>();
        schedule.put("kind", "ALL_DAY");
        schedule.put("startLocalTime", null);
        schedule.put("endLocalTime", null);
        return schedule;
    }

    private static void assertPublishedSectionReadModel(JsonNode actual, String message) {
        assertTrue(actual.isObject(), message + ": section is an object");
        for (String field : List.of("salesSectionRef", "name", "displayOrder", "itemCount", "canMoveUp", "canMoveDown"))
            assertTrue(actual.has(field), message + ": section field is present: " + field);
    }

    private static void assertPublishedItemReadModel(JsonNode actual, String message) {
        assertTrue(actual.isObject(), message + ": item is an object");
        for (String field : List.of(
                "salesItemRef",
                "catalogItemRef",
                "itemCode",
                "displayName",
                "productShape",
                "saleContent",
                "orderingConstraints",
                "displayMedia",
                "displayOrder",
                "inventoryAvailability",
                "manualSaleStatus",
                "version")) assertTrue(actual.has(field), message + ": item field is present: " + field);
        for (String field : List.of("kind", "listedPriceCents", "skuPrices", "selectedOrderOptions", "salesUnit"))
            assertTrue(actual.path("saleContent").has(field), message + ": sale content field is present: " + field);
        assertTrue(actual.has("manualSaleTargetStatuses"), message + ": child manual-sale target statuses are present");
        for (String field : List.of("minItemQuantity", "quantityStep"))
            assertTrue(
                    actual.path("orderingConstraints").has(field), message + ": ordering field is present: " + field);
        for (String field : List.of("mode", "assetRefs", "primaryAssetRef"))
            assertTrue(actual.path("displayMedia").has(field), message + ": display media field is present: " + field);
        for (String field : List.of("applicability", "state", "reason"))
            assertTrue(
                    actual.path("inventoryAvailability").has(field),
                    message + ": inventory field is present: " + field);
        for (String field : List.of("state", "reason", "changedAt", "changedByDisplayName"))
            assertTrue(
                    actual.path("manualSaleStatus").has(field), message + ": manual status field is present: " + field);
    }

    private static void assertPublishedSectionUnchanged(JsonNode expected, JsonNode actual, String message) {
        assertPublishedSectionReadModel(actual, message);
        assertEquals(expected, actual, message + ": full section tuple is unchanged");
    }

    private static void assertPublishedItemUnchanged(JsonNode expected, JsonNode actual, String message) {
        assertPublishedItemReadModel(actual, message);
        assertEquals(expected, actual, message + ": full item tuple is unchanged");
    }

    private static void assertScheduleReadModel(JsonNode actual, Map<String, Object> expected, String message) {
        assertTrue(actual.isObject(), message + ": schedule is an object");
        assertTrue(actual.has("kind"), message + ": schedule kind is present");
        assertTrue(actual.has("startLocalTime"), message + ": schedule start is present");
        assertTrue(actual.has("endLocalTime"), message + ": schedule end is present");
        assertEquals(expected.get("kind"), actual.path("kind").asText(), message + ": schedule kind");
        assertNullableScheduleValue(actual.path("startLocalTime"), expected.get("startLocalTime"), message + ": start");
        assertNullableScheduleValue(actual.path("endLocalTime"), expected.get("endLocalTime"), message + ": end");
    }

    private static void assertNullableScheduleValue(JsonNode actual, Object expected, String message) {
        if (expected == null) assertTrue(actual.isNull(), message + " is null");
        else assertEquals(expected, actual.asText(), message);
    }

    private UUID createProjectOwnedChannel(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session,
            String label)
            throws Exception {
        String token = suffix();
        Map<String, Object> templateBody = new LinkedHashMap<>();
        templateBody.put("projectRef", fixture.projectId());
        templateBody.put("templateName", label + " template");
        templateBody.put("templateCode", "SM05-PROJECT-" + token);
        templateBody.put("accessKind", "INTERNAL");
        templateBody.put("operatorKind", "PROJECT");
        templateBody.put("orderKind", "TAKEAWAY");
        templateBody.put("dineInForm", null);
        templateBody.put("providerCode", null);
        templateBody.put("storeVisibilityScope", null);
        templateBody.put("visibleStoreRefs", List.of());
        BackendAcceptanceTest.Response template = context.post(
                BUSINESS_CHANNEL_TEMPLATE_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channel-templates",
                session.cookie(),
                templateBody,
                Set.of(200));
        String templateRef = template.json().path("templateRef").asText();
        assertFalse(templateRef.isBlank(), "BUSINESS: ineligible project fixture obtains a real template");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("templateRef", UUID.fromString(templateRef));
        body.put("ownerNodeType", "PROJECT");
        body.put("ownerNodeRef", fixture.projectId());
        body.put("channelCode", "SM05-PROJECT-CHANNEL-" + token);
        body.put("channelName", label + " channel");
        body.put("bindingRef", null);
        BackendAcceptanceTest.Response channel = context.post(
                BUSINESS_CHANNEL_CREATE,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/business-channels",
                session.cookie(),
                body,
                Set.of(200));
        UUID channelRef = UUID.fromString(channel.json().path("channelRef").asText());
        assertEquals(
                "PROJECT",
                channel.json().path("ownerNodeType").asText(),
                "BUSINESS: ineligible channel is project-owned");
        return channelRef;
    }

    private void disableBusinessChannel(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID channelRef) throws Exception {
        BackendAcceptanceTest.Response detail = context.get(
                BUSINESS_CHANNEL_DETAIL,
                "/api/operations/group-workspaces/" + menus.fixture().groupWorkspaceKey() + "/business-channels/"
                        + channelRef,
                menus.session().cookie(),
                Set.of(200));
        BackendAcceptanceTest.Response disabled = context.post(
                BUSINESS_CHANNEL_STATUS,
                "/api/operations/group-workspaces/" + menus.fixture().groupWorkspaceKey() + "/business-channels/"
                        + channelRef,
                menus.session().cookie(),
                Map.of(
                        "status",
                        "DISABLED",
                        "expectedVersion",
                        detail.json().path("version").asLong()),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabled.json().path("status").asText(),
                "BUSINESS: channel owner status transition is read back");
    }

    private void disableStoreThroughOwner(
            BackendAcceptanceTest.ScenarioContext context, BackendAcceptanceTest.Fixture fixture) throws Exception {
        BackendAcceptanceTest.Fixture projectOwner =
                host.projectUserFixture(fixture, Set.of("BC-BUSINESS-CHANNEL-PROJECT-EDIT", "BC-ORG-STORE-STATUS"));
        host.completeInvitation(context, projectOwner);
        BackendAcceptanceTest.Session session = host.login(context, projectOwner);
        BackendAcceptanceTest.Response disabled = context.post(
                OPERATIONS_ORGANIZATION_STORE_STATUS,
                "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey()
                        + "/organization/stores/" + fixture.storeId()
                        + "/status",
                session.cookie(),
                Map.of("targetStatus", "DISABLED", "expectedVersion", 1),
                Set.of(200));
        assertEquals(
                "DISABLED",
                disabled.json().path("status").asText(),
                "BUSINESS: store owner status transition is real HTTP state");
    }

    private JsonNode readCatalogItem(
            BackendAcceptanceTest.ScenarioContext context,
            BackendAcceptanceTest.Fixture fixture,
            BackendAcceptanceTest.Session session,
            String itemCode)
            throws Exception {
        return context.get(
                        OPERATIONS_CATALOG_ITEM_READ,
                        "/api/operations/catalog-inventory/items/" + itemCode + "?dataNodeRef=" + fixture.storeId(),
                        session.cookie(),
                        Set.of(200))
                .json()
                .path("data")
                .path("item");
    }

    private static Map<String, Object> catalogDraftFromReadback(JsonNode current) {
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", current.path("name").asText());
        draft.put("shapeKey", current.path("shapeKey").asText());
        draft.put("images", textArray(current.path("images")));
        draft.put("tagRefs", textArray(current.path("tagRefs")));
        draft.put("categoryRef", textOrNull(current, "categoryRef"));
        draft.put("productionTagRef", textOrNull(current, "productionTagRef"));
        draft.put("salesUnitRef", textOrNull(current, "salesUnitRef"));
        draft.put("baseMeasureUnitRef", textOrNull(current, "baseMeasureUnitRef"));
        draft.put("identifiers", List.of());
        draft.put("preparationProfile", current.has("preparationProfile") ? current.path("preparationProfile") : null);
        draft.put("skus", List.of());
        draft.put("skuVariantDimensions", current.path("skuVariantDimensions"));
        draft.put("attributeAssignments", current.path("attributeAssignments"));
        draft.put("orderOptionConfigs", List.of());
        draft.put("compositeGroups", current.path("compositeGroups"));
        return draft;
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private static List<String> textArray(JsonNode node) {
        List<String> result = new ArrayList<>();
        if (node != null && node.isArray()) for (JsonNode value : node) result.add(value.asText());
        return result;
    }

    private static String menuRoot(BackendAcceptanceTest.Fixture fixture) {
        return "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/" + fixture.storeId()
                + "/sales-menus";
    }

    private static String sectionPath(MenuFixture menus, UUID menuRef, UUID sectionRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/draft/sections/" + sectionRef;
    }

    private static String draftItemsPath(MenuFixture menus, UUID menuRef, UUID sectionRef) {
        return sectionPath(menus, menuRef, sectionRef) + "/items";
    }

    private static String draftItemPath(MenuFixture menus, UUID menuRef, UUID itemRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/draft/items/" + itemRef;
    }

    private static String publishedItemPath(MenuFixture menus, UUID menuRef, UUID itemRef, UUID channelRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/published/items/" + itemRef + "?channelRef=" + channelRef;
    }

    private static String publishedItemCommandPath(
            MenuFixture menus, UUID menuRef, UUID itemRef, UUID channelRef, String command) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/published/items/" + itemRef + "/channels/" + channelRef
                + "/" + command;
    }

    private static String publishedItemsPath(MenuFixture menus, UUID menuRef, UUID sectionRef, UUID channelRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/published/sections/" + sectionRef + "/items?channelRef="
                + channelRef;
    }

    private static String previewPath(MenuFixture menus, UUID menuRef, UUID channelRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/draft/publication-preview?channelRef=" + channelRef;
    }

    private static String recordsPath(MenuFixture menus, UUID menuRef, UUID channelRef) {
        return menuRoot(menus.fixture()) + "/" + menuRef + "/sales-menu-operation-records?channelRef=" + channelRef;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String nextCursor(JsonNode page) {
        JsonNode cursor = page.path("nextCursor");
        return cursor.isMissingNode() || cursor.isNull() ? "" : cursor.asText("");
    }

    private static String operationRecordFact(String operationKind, UUID targetRef, String result, String failureCode) {
        return String.join("|", operationKind, targetRef.toString(), result, failureCode == null ? "" : failureCode);
    }

    private String assetLifecycleState(UUID assetRef) {
        return host.text(
                "SELECT status || ':' || version::text FROM platform_asset.staged_asset WHERE asset_ref=?", assetRef);
    }

    private String assetPhysicalFacts(UUID assetRef) {
        return host.text(
                "SELECT bucket_name || ':' || object_key || ':' || sha256 || ':' || status || ':' || version::text "
                        + "FROM platform_asset.staged_asset WHERE asset_ref=?",
                assetRef);
    }

    private static void assertSalesMenuAssetTarget(
            JsonNode response,
            MenuFixture menus,
            UUID menuRef,
            UUID itemRef,
            long expectedDraftVersion,
            String message) {
        JsonNode target = response.path("target");
        assertEquals(
                menus.fixture().groupWorkspaceKey(),
                target.path("groupWorkspaceKey").asText(),
                "BUSINESS: " + message + " returns the owning workspace target");
        assertEquals(
                menus.fixture().storeId().toString(),
                target.path("storeRef").asText(),
                "BUSINESS: " + message + " returns the owning store target");
        assertEquals(
                menuRef.toString(),
                target.path("salesMenuRef").asText(),
                "BUSINESS: " + message + " returns the owning menu target");
        assertEquals(
                itemRef.toString(),
                target.path("salesItemRef").asText(),
                "BUSINESS: " + message + " returns the owning item target");
        assertEquals(
                "SALES_MENU_ITEM_IMAGE",
                target.path("usage").asText(),
                "BUSINESS: " + message + " returns the fixed image usage");
        assertEquals(
                expectedDraftVersion,
                target.path("expectedDraftVersion").asLong(),
                "BUSINESS: " + message + " returns the addressed draft item version");
    }

    private void assertNoSalesMenuMediaMutation(
            BackendAcceptanceTest.ScenarioContext context,
            MenuFixture menus,
            UUID menuRef,
            UUID itemRef,
            long expectedMenuVersion,
            long expectedItemVersion,
            long expectedAssetCount,
            String message)
            throws Exception {
        assertEquals(
                expectedAssetCount,
                salesMenuImageCount(menus.fixture()),
                "BUSINESS: " + message + " creates no sales-menu asset row");
        BackendAcceptanceTest.Response item = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                draftItemPath(menus, menuRef, itemRef),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                expectedItemVersion,
                item.json().path("version").asLong(),
                "BUSINESS: " + message + " leaves the item version unchanged");
        assertEquals(
                expectedMenuVersion,
                readMenu(context, menus, menuRef, menus.channels().getFirst())
                        .json()
                        .path("version")
                        .asLong(),
                "BUSINESS: " + message + " leaves the menu version unchanged");
    }

    private long salesMenuImageCount(BackendAcceptanceTest.Fixture fixture) {
        return host.count(
                "SELECT count(*) FROM platform_asset.staged_asset WHERE workspace_uuid=? "
                        + "AND usage='SALES_MENU_ITEM_IMAGE'",
                fixture.workspaceUuid());
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
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
                Set.of(200));
        assertEquals(
                fixture.storeId().toString(),
                selected.json()
                        .path("scopeContext")
                        .path("store")
                        .path("dataNodeRef")
                        .asText(),
                "BUSINESS: sales-menu fixture selects the intended store scope");
        return new BackendAcceptanceTest.Session(
                session.cookie(),
                selected.json(),
                selected.json().path("contextVersion").asLong());
    }

    private static void assertAccessProblem(BackendAcceptanceTest.Response response, String message) {
        String code = response.problemCode();
        assertFalse(code.isBlank(), message + ": typed problem code");
        assertTrue(
                code.contains("ACCESS")
                        || code.contains("SCOPE")
                        || code.contains("CAPABILITY")
                        || code.contains("DENIED")
                        || code.equals("GRANT_INVALID"),
                message + ": access problem code=" + code);
    }

    private static Set<String> nodeRefs(JsonNode nodes, String field) {
        Set<String> refs = new LinkedHashSet<>();
        for (JsonNode node : nodes) refs.add(node.path(field).asText());
        return refs;
    }

    private static boolean disjoint(Set<String> left, Set<String> right) {
        for (String value : left) if (right.contains(value)) return false;
        return true;
    }

    private JsonNode publishedItemsForFirstSection(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, UUID channelRef)
            throws Exception {
        JsonNode sections = context.get(
                        OPERATIONS_SALES_MENU_PUBLISHED_SECTIONS,
                        menuRoot(menus.fixture()) + "/" + menuRef + "/published/sections",
                        menus.session().cookie(),
                        Set.of(200))
                .json();
        UUID sectionRef = UUID.fromString(
                sections.path("items").get(0).path("salesSectionRef").asText());
        return context.get(
                        OPERATIONS_SALES_MENU_PUBLISHED_ITEMS,
                        publishedItemsPath(menus, menuRef, sectionRef, channelRef) + "&pageSize=20",
                        menus.session().cookie(),
                        Set.of(200))
                .json();
    }

    private static JsonNode optionByDefinition(JsonNode options, JsonNode config) {
        return optionByDefinition(
                options, UUID.fromString(config.path("definitionRef").asText()));
    }

    private static JsonNode optionByDefinition(JsonNode options, UUID definitionRef) {
        for (JsonNode option : options) {
            if (definitionRef.toString().equals(option.path("definitionRef").asText())) return option;
        }
        throw new AssertionError("BUSINESS: option definition is absent from the readback");
    }

    private static JsonNode manualTargetStatus(JsonNode item, String targetKind, UUID targetRef) {
        for (JsonNode status : item.path("manualSaleTargetStatuses")) {
            if (targetKind.equals(status.path("targetKind").asText())
                    && targetRef.toString().equals(status.path("targetRef").asText())) return status;
        }
        throw new AssertionError("BUSINESS: manual target status is absent from the published snapshot");
    }

    private static boolean hasManualTargetStatus(JsonNode item, String targetKind, UUID targetRef) {
        for (JsonNode status : item.path("manualSaleTargetStatuses")) {
            if (targetKind.equals(status.path("targetKind").asText())
                    && targetRef.toString().equals(status.path("targetRef").asText())) return true;
        }
        return false;
    }

    private static void assertTargetOperationRecord(JsonNode records, UUID targetRef, String targetKind) {
        for (JsonNode record : records) {
            if (!targetRef.toString().equals(record.path("targetRef").asText())) continue;
            assertEquals(
                    targetKind,
                    record.path("targetKind").asText(),
                    "BUSINESS: child operation record target kind is exact");
            assertFalse(
                    record.path("targetDisplaySnapshot").asText().isBlank(),
                    "BUSINESS: child operation record preserves the display snapshot");
            return;
        }
        throw new AssertionError("BUSINESS: child target operation record is absent");
    }

    private static JsonNode skuByCode(JsonNode catalogItem, String skuCode) {
        for (JsonNode sku : catalogItem.path("skus")) {
            if (skuCode.equals(sku.path("skuCode").asText())) return sku;
        }
        throw new AssertionError("BUSINESS: SKU fixture code is absent");
    }

    private static void assertSinglePublicationBlocker(
            JsonNode preview,
            String expectedKind,
            UUID expectedSalesItemRef,
            String expectedMessageKey,
            String message) {
        JsonNode violations =
                requiredJsonNode(preview, "/violations", JsonNodeType.ARRAY, message + ": violations are typed");
        assertEquals(1, violations.size(), message + ": exactly one blocker is returned");
        JsonNode blocker = violations.get(0);
        assertEquals(expectedKind, blocker.path("kind").asText(), message + ": blocker kind");
        if (expectedSalesItemRef == null)
            assertTrue(blocker.path("salesItemRef").isNull(), message + ": blocker has no item target");
        else
            assertEquals(
                    expectedSalesItemRef.toString(),
                    blocker.path("salesItemRef").asText(),
                    message + ": blocker item target");
        assertEquals(expectedMessageKey, blocker.path("messageKey").asText(), message + ": blocker message key");
    }

    private static boolean containsRef(JsonNode nodes, String field, UUID value) {
        for (JsonNode node : nodes) if (value.toString().equals(node.path(field).asText())) return true;
        return false;
    }

    private static boolean containsScalarRef(JsonNode nodes, UUID value) {
        for (JsonNode node : nodes) if (value.toString().equals(node.asText())) return true;
        return false;
    }

    private static List<JsonNode> iterable(JsonNode nodes) {
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode node : nodes) result.add(node);
        return result;
    }

    private static List<JsonNode> concatNodes(JsonNode first, JsonNode second) {
        List<JsonNode> result = iterable(first);
        result.addAll(iterable(second));
        return result;
    }
}
