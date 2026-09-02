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

    private record AvailabilityExpectation(String applicability, String state, String reason) {}

    private record PreparedMenu(
            MenuFixture fixture, MenuState menu, SectionState section, ItemState item, long menuVersion) {}

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

        BackendAcceptanceTest.Response detail = readMenu(context, menus, menu.ref(), channelRef);
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
        BackendAcceptanceTest.Response activeDetail = readMenu(context, menus, active.ref(), firstChannel);
        assertEquals(
                "SM05 lifecycle renamed",
                activeDetail.json().path("name").asText(),
                "BUSINESS: an active collection can still be renamed and published");
        assertEquals(
                "ENABLED",
                activeDetail.json().path("activation").path("status").asText(),
                "BUSINESS: the first channel activation is read back");
        assertEquals(
                1,
                activeDetail.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: a disabled/active lifecycle menu has an immutable first publication");
        assertTrue(
                version > 0 && draftItem.itemVersion() > 0,
                "BUSINESS: lifecycle commands return authoritative aggregate and item versions");

        MenuState archived = created.getLast();
        long archivedVersion = archiveMenu(context, menus, archived.ref(), archived.version());
        BackendAcceptanceTest.Response archivedDetail = readMenu(context, menus, archived.ref(), firstChannel);
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
        version = updateItem(
                context,
                menus,
                source.ref(),
                item,
                version,
                itemUpdateBody("源菜单展示名", directSale(2800), ordering(1, 1), inheritedMedia(), version));
        item = readDraftItemState(context, menus, source.ref(), item.ref());
        version = updateSchedule(context, menus, source.ref(), version, dailySchedule());
        version = setActivation(context, menus, source.ref(), menus.channels().getFirst(), "ENABLED", version);
        version = publish(context, menus, source.ref(), version);
        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(
                        menus, source.ref(), item.ref(), menus.channels().getFirst(), "manual-sold-out"),
                menus.session().cookie(),
                Map.of("reason", "源菜单手工停售", "expectedVersion", version),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", source.ref(), item.ref());
        version = updateItem(
                context,
                menus,
                source.ref(),
                item,
                version,
                itemUpdateBody("源菜单当前草稿", directSale(3100), ordering(1, 1), inheritedMedia(), version));
        item = readDraftItemState(context, menus, source.ref(), item.ref());

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
                        ordering(1, 1),
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

        String sourceName = readMenu(
                        context, menus, source.ref(), menus.channels().getFirst())
                .json()
                .path("name")
                .asText();
        BackendAcceptanceTest.Response copied = context.post(
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

        BackendAcceptanceTest.Response copyDetail =
                readMenu(context, menus, copy.ref(), menus.channels().getFirst());
        assertEquals(
                sourceName + " 副本",
                copyDetail.json().path("name").asText(),
                "BUSINESS: copy names the new collection from the source");
        assertEquals(
                "DAILY_TIME_RANGE",
                copyDetail.json().path("draftSchedule").path("kind").asText(),
                "BUSINESS: copy carries the current draft schedule");
        assertTrue(
                copyDetail.json().path("activation").isNull(),
                "BUSINESS: copy has no activation relation and is therefore default disabled");
        assertTrue(
                copyDetail.json().path("latestPublishedRevision").isNull(),
                "BUSINESS: copy has no copied publication revision");

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
        JsonNode copiedSection = copyDraftSections.json().path("items").get(0);
        assertNotNull(copiedSection, "BUSINESS: copy contains the current draft section");
        UUID copiedSectionRef =
                UUID.fromString(copiedSection.path("salesSectionRef").asText());
        ItemState copiedItem = findDraftItem(context, menus, copy.ref(), copiedSectionRef, item.catalogRef());
        assertFalse(
                copiedItem.ref().equals(item.ref()),
                "BUSINESS: copied draft item has an independent sales-item identity");
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

        BackendAcceptanceTest.Fixture sibling =
                host.siblingStoreFixtureSameBrand(menus.fixture(), Set.of(SALES_MENU_CAPABILITY));
        host.completeInvitation(context, sibling);
        BackendAcceptanceTest.Session siblingSession = selectStore(context, sibling, host.login(context, sibling));
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

        BackendAcceptanceTest.Response secondMenu = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot(menus.fixture()),
                menus.session().cookie(),
                Map.of("channelRef", menus.channels().getFirst(), "name", "SM05 media second menu"),
                Set.of(201));
        UUID secondMenuRef = UUID.fromString(
                requiredJsonNode(secondMenu.json(), "/salesMenuRef", JsonNodeType.STRING, "BUSINESS: second menu ref")
                        .asText());
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
        long replacementVersion = requiredJsonNode(
                        secondStage.json(), "/version", JsonNodeType.NUMBER, "BUSINESS: replacement asset version")
                .asLong();
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

        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + replacementRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", replacementVersion),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("status").asText(),
                "BUSINESS: a separate unclaimed stage can be released through the owner route");
        String releasedAssetState = assetLifecycleState(UUID.fromString(replacementRef));
        BackendAcceptanceTest.Response releaseReleased = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                itemPath + "/assets/stage/" + replacementRef + "/release",
                menus.session().cookie(),
                Map.of("expectedAssetVersion", released.json().path("version").asLong()),
                Set.of(409));
        assertEquals(
                "SALES_MENU_ASSET_LIFECYCLE_CONFLICT",
                releaseReleased.problemCode(),
                "BUSINESS: an already released image cannot be released again");
        assertEquals(
                releasedAssetState,
                assetLifecycleState(UUID.fromString(replacementRef)),
                "BUSINESS: a rejected released-image operation does not mutate the asset lifecycle");
        BackendAcceptanceTest.Response afterReleasedAgain = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM, itemPath, menus.session().cookie(), Set.of(200));
        assertEquals(
                assetRef,
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
                claimedItem.itemVersion(),
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
                claimedItem.itemVersion(),
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
                assetRef,
                afterDeniedStage
                        .json()
                        .path("displayMedia")
                        .path("primaryAssetRef")
                        .asText(),
                "BUSINESS: a capability-denied stage leaves the menu binding unchanged");
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
        JsonNode frozen = publishedItems.json().path("items").get(0);
        assertEquals(
                2700,
                frozen.path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: the first publication freezes its price");
        BackendAcceptanceTest.Response frozenDetail = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                publishedItemPath(menus, menuRef, itemRef, menus.channels().getFirst()),
                menus.session().cookie(),
                Set.of(200));
        assertEquals(
                2700,
                frozenDetail.json().path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: published item detail reads the same frozen effective value");
        BackendAcceptanceTest.Response firstPublicationMenu =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        long firstDraftRevision =
                firstPublicationMenu.json().path("draftRevision").asLong();
        assertEquals(
                1,
                firstPublicationMenu.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: first publication has its own immutable publication revision");
        assertFalse(
                firstPublicationMenu.json().path("draftDirty").asBoolean(true),
                "BUSINESS: current draft equals the first publication source revision");

        version = updateItem(
                context,
                menus,
                menuRef,
                currentItem,
                version,
                itemUpdateBody(null, directSale(3900), ordering(1, 1), inheritedMedia(), version));
        currentItem = readDraftItemState(context, menus, menuRef, itemRef);
        BackendAcceptanceTest.Response dirtyMenu =
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
        assertEquals(
                2700,
                context.get(
                                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                                publishedItemPath(
                                        menus,
                                        menuRef,
                                        itemRef,
                                        menus.channels().getFirst()),
                                menus.session().cookie(),
                                Set.of(200))
                        .json()
                        .path("saleContent")
                        .path("listedPriceCents")
                        .asInt(),
                "BUSINESS: draft mutation does not rewrite the old publication");

        version = updateSchedule(context, menus, menuRef, version, allDaySchedule());
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
        assertEquals(
                3900,
                latest.json().path("saleContent").path("listedPriceCents").asInt(),
                "BUSINESS: a new publication exposes the latest draft value");
        BackendAcceptanceTest.Response latestDetail =
                readMenu(context, menus, menuRef, menus.channels().getFirst());
        assertEquals(
                2,
                latestDetail.json().path("latestPublishedRevision").asInt(),
                "BUSINESS: publication revision advances without mutating revision one");
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
            operation = "getOperationsSalesMenuPublicationPreview")
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
        BackendAcceptanceTest.Response pricePreview = context.get(
                OPERATIONS_SALES_MENU_PREVIEW,
                previewPath(malformed, malformedMenu.ref(), malformed.channels().getFirst()),
                malformed.session().cookie(),
                Set.of(200));
        assertTrue(
                containsKind(pricePreview.json().path("violations"), "LISTED_PRICE_MISSING"),
                "BUSINESS: unconfigured direct pricing is reported as a typed preview violation");
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
        assertTrue(
                containsKind(channelPreview.json().path("violations"), "CHANNEL_DISABLED"),
                "BUSINESS: a disabled channel is visible in publication preview");
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
        assertTrue(
                containsKind(storePreview.json().path("violations"), "STORE_DISABLED"),
                "BUSINESS: a disabled store is visible in publication preview");
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
        PreparedMenu prepared = new PreparedMenu(menus, menu, section, preparedItem, preparedVersion);
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

        BackendAcceptanceTest.Response soldOut = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-sold-out"),
                menus.session().cookie(),
                Map.of("reason", "午餐档位暂停售卖", "expectedVersion", version),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", menuRef, itemRef);
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

        Map<String, Object> missingReason = new LinkedHashMap<>();
        missingReason.put("reason", null);
        missingReason.put("expectedVersion", version);
        BackendAcceptanceTest.Response reasonRejected = context.post(
                OPERATIONS_SALES_MENU_SOLD_OUT,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-sold-out"),
                menus.session().cookie(),
                missingReason,
                Set.of(422));
        assertFalse(
                reasonRejected.problemCode().isBlank(),
                "BUSINESS: missing manual-stop reason is a typed validation rejection");
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

        BackendAcceptanceTest.Response notConfirmed = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-restore"),
                menus.session().cookie(),
                Map.of("confirm", false, "expectedVersion", version),
                Set.of(422));
        assertEquals(
                "CONFIRMATION_REQUIRED",
                notConfirmed.problemCode(),
                "BUSINESS: restore requires explicit confirmation");
        BackendAcceptanceTest.Response restored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(menus, menuRef, itemRef, firstChannel, "manual-restore"),
                menus.session().cookie(),
                Map.of("confirm", true, "expectedVersion", version),
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
        assertTrue(
                containsKind(blockedPreview.json().path("violations"), "LISTED_PRICE_MISSING"),
                "BUSINESS: generated preview route returns a business violation, not only 2xx");
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
                Map.of("reason", "SM05 route check", "expectedVersion", version),
                Set.of(200));
        version = assertCommand(soldOut, "setOperationsSalesMenuItemSoldOut", menu.ref(), draftItem.ref());
        BackendAcceptanceTest.Response restored = context.post(
                OPERATIONS_SALES_MENU_RESTORE,
                publishedItemCommandPath(menus, menu.ref(), draftItem.ref(), channel, "manual-restore"),
                menus.session().cookie(),
                Map.of("confirm", true, "expectedVersion", version),
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
        JsonNode item = catalog.acceptanceCreatePlainItem(
                context, menus.fixture(), menus.session(), "SM05-PREP-" + suffix(), label + " item");
        UUID catalogRef = UUID.fromString(item.path("itemRef").asText());
        SectionState section = createSection(context, menus, menu.ref(), label + " section", menu.version());
        long version = addItems(context, menus, menu.ref(), section.ref(), section.menuVersion(), List.of(catalogRef));
        ItemState draftItem = findDraftItem(context, menus, menu.ref(), section.ref(), catalogRef);
        return new PreparedMenu(menus, menu, section, draftItem, version);
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

    private BackendAcceptanceTest.Response readMenu(
            BackendAcceptanceTest.ScenarioContext context, MenuFixture menus, UUID menuRef, UUID channelRef)
            throws Exception {
        return context.get(
                OPERATIONS_SALES_MENU,
                menuRoot(menus.fixture()) + "/" + menuRef + "?channelRef=" + channelRef,
                menus.session().cookie(),
                Set.of(200));
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
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("kind", kind);
        content.put("listedPriceCents", listedPriceCents);
        content.put("skuPrices", skuPrices);
        return content;
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

    private static boolean containsKind(JsonNode nodes, String kind) {
        for (JsonNode node : nodes) if (kind.equals(node.path("kind").asText())) return true;
        return false;
    }

    private static boolean containsRef(JsonNode nodes, String field, UUID value) {
        for (JsonNode node : nodes) if (value.toString().equals(node.path(field).asText())) return true;
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
