package com.catering.v2s.app.acceptance;

import static com.catering.v2s.app.acceptance.BackendAcceptanceTest.*;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

final class AssetAcceptanceScenarios {
    private final BackendAcceptanceTest host;

    AssetAcceptanceScenarios(BackendAcceptanceTest host) {
        this.host = host;
    }

    @AcceptanceScenario(id = "asset.catalog-stage-release", module = "ASSET", operation = "catalogAssetLifecycle")
    void catalogAssetStageAndRelease(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        String digest = BackendAcceptanceTest.sha256(PNG);
        String wrongTarget = fixture.projectId().toString();
        BackendAcceptanceTest.Response denied = context.multipartAsset(
                OPERATIONS_ASSET_STAGE, fixture, session.cookie(), wrongTarget, digest, Set.of(403));
        assertTrue(
                denied.problemCode().contains("SCOPE") || denied.problemCode().contains("ACCESS"),
                "CONTRACT: asset stage rejects a data node outside the selected store");
        BackendAcceptanceTest.Response staged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                digest,
                Set.of(200));
        JsonNode stagedResult = staged.json().path("result");
        String assetRef = stagedResult.path("assetRef").asText();
        assertTrue(!assetRef.isBlank(), "BUSINESS: staged asset returns an opaque asset reference");
        assertEquals("STAGED", stagedResult.path("status").asText(), "BUSINESS: asset lifecycle starts at STAGED");
        assertEquals("image/png", stagedResult.path("mediaType").asText(), "BUSINESS: media type is read back");
        assertEquals(digest, stagedResult.path("contentDigest").asText(), "BUSINESS: content digest is read back");
        assertEquals(1, stagedResult.path("version").asInt(), "BUSINESS: staged asset starts at version one");
        String bindGrant = stagedResult.path("bindGrant").asText();
        assertTrue(!bindGrant.isBlank(), "BUSINESS: transient bind proof is returned only to the uploader");
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        1,
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("result").path("disposition").asText(),
                "BUSINESS: unreferenced staged asset releases");
        assertEquals(
                2,
                released.json().path("result").path("version").asInt(),
                "BUSINESS: release advances the asset version");
    }

    @AcceptanceScenario(
            id = "asset.release-scope-denial-preserves-staged-claim",
            module = "ASSET",
            operation = "assetReleaseScopeDenial")
    void assetReleaseScopeDenialPreservesStagedClaim(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture("STORE", Set.of("EDIT_STORE_CATALOG"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = host.login(context, fixture);
        String digest = BackendAcceptanceTest.sha256(PNG);
        BackendAcceptanceTest.Response staged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                digest,
                Set.of(200));
        JsonNode stagedResult = staged.json().path("result");
        String assetRef = stagedResult.path("assetRef").asText();
        long stagedVersion = stagedResult.path("version").asLong();
        assertTrue(
                !assetRef.isBlank() && stagedVersion > 0,
                "BUSINESS: staged asset readback supplies the current opaque reference and lifecycle version");
        BackendAcceptanceTest.Response denied = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        stagedVersion,
                        "dataNodeRef",
                        fixture.projectId().toString()),
                Set.of(403));
        assertTrue(
                denied.problemCode().contains("SCOPE") || denied.problemCode().contains("ACCESS"),
                "BUSINESS: release rechecks the explicit target scope");
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + assetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef",
                        assetRef,
                        "expectedVersion",
                        stagedVersion,
                        "dataNodeRef",
                        fixture.storeId().toString()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("result").path("disposition").asText(),
                "BUSINESS: a denied release leaves the staged claim releasable");
        assertEquals(
                stagedVersion + 1,
                released.json().path("result").path("version").asLong(),
                "BUSINESS: only the authorized release advances the asset version");
    }

    @AcceptanceScenario(
            id = "asset.sales-menu-image-lifecycle",
            module = "ASSET",
            operation = "salesMenuImageLifecycle")
    void salesMenuImageLifecycle(BackendAcceptanceTest.ScenarioContext context) throws Exception {
        BackendAcceptanceTest.Fixture fixture = host.fixture(
                "STORE", Set.of("EDIT_STORE_SALES_MENU", "EDIT_STORE_CATALOG", "BC-BUSINESS-CHANNEL-STORE-EDIT"));
        host.completeInvitation(context, fixture);
        BackendAcceptanceTest.Session session = selectStore(context, fixture, host.login(context, fixture));

        UUID channelRef = new BusinessChannelAcceptanceScenarios(host)
                .acceptanceCreateSalesMenuEligibleStoreChannels(
                        context, fixture, session, 1, "Sales menu asset lifecycle")
                .getFirst();
        JsonNode catalogItem = new CatalogAcceptanceScenarios(host)
                .acceptanceCreatePlainItem(
                        context,
                        fixture,
                        session,
                        "ACC-SALES-MENU-ASSET-" + UUID.randomUUID().toString().substring(0, 8),
                        "Sales menu asset item");
        UUID catalogItemRef = UUID.fromString(catalogItem.path("itemRef").asText());

        String menuRoot = "/api/operations/group-workspaces/" + fixture.groupWorkspaceKey() + "/stores/"
                + fixture.storeId() + "/sales-menus";
        BackendAcceptanceTest.Response createdMenu = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot,
                session.cookie(),
                Map.of("channelRef", channelRef, "name", "Sales menu asset lifecycle"),
                Set.of(201));
        UUID menuRef = UUID.fromString(createdMenu.json().path("salesMenuRef").asText());
        long menuVersion = createdMenu.json().path("version").asLong();

        BackendAcceptanceTest.Response createdSection = context.post(
                OPERATIONS_SALES_MENU_SECTION_CREATE,
                menuRoot + "/" + menuRef + "/draft/sections",
                session.cookie(),
                Map.of("name", "图片", "expectedVersion", menuVersion),
                Set.of(201));
        long sectionVersion = createdSection.json().path("version").asLong();
        BackendAcceptanceTest.Response sections = context.get(
                OPERATIONS_SALES_MENU_DRAFT_SECTIONS,
                menuRoot + "/" + menuRef + "/draft/sections",
                session.cookie(),
                Set.of(200));
        JsonNode imageSection = null;
        for (JsonNode row : sections.json().path("items")) {
            if ("图片".equals(row.path("name").asText())) {
                imageSection = row;
                break;
            }
        }
        assertNotNull(imageSection, "BUSINESS: image section is present in the authoritative draft-section readback");
        UUID sectionRef = UUID.fromString(imageSection.path("salesSectionRef").asText());
        BackendAcceptanceTest.Response added = context.post(
                OPERATIONS_SALES_MENU_ITEMS_ADD,
                menuRoot + "/" + menuRef + "/draft/sections/" + sectionRef + "/items",
                session.cookie(),
                Map.of("catalogItemRefs", List.of(catalogItemRef), "expectedVersion", sectionVersion),
                Set.of(201));
        long addMenuVersion = added.json().path("version").asLong();
        assertTrue(addMenuVersion > sectionVersion, "BUSINESS: adding an item returns the advanced menu version");
        BackendAcceptanceTest.Response draftItems = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEMS,
                menuRoot + "/" + menuRef + "/draft/sections/" + sectionRef + "/items?pageSize=20",
                session.cookie(),
                Set.of(200));
        JsonNode draftItem = draftItems.json().path("items").get(0);
        assertNotNull(draftItem, "BUSINESS: sales-menu asset fixture creates a draft item");
        UUID salesItemRef = UUID.fromString(draftItem.path("salesItemRef").asText());
        long itemVersion = draftItem.path("version").asLong();
        assertEquals(
                catalogItemRef.toString(),
                draftItem.path("catalogItemRef").asText(),
                "BUSINESS: asset target is bound to the selected catalog item");

        String stagePath = menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef + "/assets/stage";
        BackendAcceptanceTest.Response staged = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                stagePath,
                session.cookie(),
                itemVersion,
                "sales-menu.png",
                "image/png",
                BackendAcceptanceTest.sha256(PNG),
                PNG,
                Set.of(201));
        JsonNode stagedJson = staged.json();
        String claimedAssetRef = stagedJson.path("assetRef").asText();
        String bindGrant = stagedJson.path("bindGrant").asText();
        assertTrue(!claimedAssetRef.isBlank(), "BUSINESS: sales-menu stage returns an opaque asset reference");
        assertTrue(!bindGrant.isBlank(), "BUSINESS: sales-menu stage returns a transient bind grant");
        assertEquals("STAGED", stagedJson.path("status").asText(), "BUSINESS: sales-menu image starts STAGED");
        assertEquals(
                fixture.groupWorkspaceKey(),
                stagedJson.path("target").path("groupWorkspaceKey").asText(),
                "BUSINESS: stage readback returns the server-owned workspace target");
        assertEquals(
                fixture.storeId().toString(),
                stagedJson.path("target").path("storeRef").asText(),
                "BUSINESS: stage readback returns the server-owned store target");
        assertEquals(
                menuRef.toString(),
                stagedJson.path("target").path("salesMenuRef").asText(),
                "BUSINESS: stage readback returns the server-owned menu target");
        assertEquals(
                salesItemRef.toString(),
                stagedJson.path("target").path("salesItemRef").asText(),
                "BUSINESS: stage readback returns the server-owned item target");
        assertEquals(
                "SALES_MENU_ITEM_IMAGE",
                stagedJson.path("target").path("usage").asText(),
                "BUSINESS: stage readback fixes the asset usage");
        assertEquals(
                itemVersion,
                stagedJson.path("target").path("expectedDraftVersion").asLong(),
                "BUSINESS: stage target records the item draft version");

        BackendAcceptanceTest.Fixture noCapability = host.storeUserFixture(fixture, Set.of());
        host.completeInvitation(context, noCapability);
        BackendAcceptanceTest.Session noCapabilitySession =
                selectStore(context, noCapability, host.login(context, noCapability));
        BackendAcceptanceTest.Response deniedByCapability = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                stagePath,
                noCapabilitySession.cookie(),
                itemVersion,
                "sales-menu-denied.png",
                "image/png",
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(403));
        assertAccessProblem(deniedByCapability, "BUSINESS: same-store actor without capability cannot stage image");

        BackendAcceptanceTest.Fixture siblingStore =
                host.siblingStoreFixtureSameBrand(fixture, Set.of("EDIT_STORE_SALES_MENU"));
        host.completeInvitation(context, siblingStore);
        BackendAcceptanceTest.Session siblingSession =
                selectStore(context, siblingStore, host.login(context, siblingStore));
        BackendAcceptanceTest.Response crossStore = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                "/api/operations/group-workspaces/" + siblingStore.groupWorkspaceKey() + "/stores/"
                        + siblingStore.storeId() + "/sales-menus/" + menuRef + "/draft/items/" + salesItemRef
                        + "/assets/stage",
                siblingSession.cookie(),
                itemVersion,
                "sales-menu-cross-store.png",
                "image/png",
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(403, 404));
        assertTrue(
                crossStore.problemCode().contains("SCOPE")
                        || crossStore.problemCode().contains("ACCESS")
                        || crossStore.problemCode().contains("NOT_FOUND"),
                "BUSINESS: a menu asset path cannot cross the selected store");

        BackendAcceptanceTest.Response secondMenu = context.post(
                OPERATIONS_SALES_MENU_CREATE,
                menuRoot,
                session.cookie(),
                Map.of("channelRef", channelRef, "name", "Sales menu asset second target"),
                Set.of(201));
        UUID secondMenuRef =
                UUID.fromString(secondMenu.json().path("salesMenuRef").asText());
        BackendAcceptanceTest.Response crossMenu = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                menuRoot + "/" + secondMenuRef + "/draft/items/" + salesItemRef + "/assets/stage",
                session.cookie(),
                itemVersion,
                "sales-menu-cross-menu.png",
                "image/png",
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(404));
        assertEquals(
                "SALES_MENU_ITEM_NOT_FOUND",
                crossMenu.problemCode(),
                "BUSINESS: a menu asset target must contain an item in that menu");
        BackendAcceptanceTest.Response crossItem = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                menuRoot + "/" + menuRef + "/draft/items/" + UUID.randomUUID() + "/assets/stage",
                session.cookie(),
                itemVersion,
                "sales-menu-cross-item.png",
                "image/png",
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(404));
        assertEquals(
                "SALES_MENU_ITEM_NOT_FOUND",
                crossItem.problemCode(),
                "BUSINESS: a menu asset target must contain the addressed item");

        BackendAcceptanceTest.Response catalogStaged = context.multipartAsset(
                OPERATIONS_ASSET_STAGE,
                fixture,
                session.cookie(),
                fixture.storeId().toString(),
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(200));
        String wrongUsageAssetRef =
                catalogStaged.json().path("result").path("assetRef").asText();
        assertTrue(!wrongUsageAssetRef.isBlank(), "BUSINESS: wrong-usage probe obtains a real catalog asset");
        BackendAcceptanceTest.Response wrongUsage = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef + "/assets/stage/" + wrongUsageAssetRef
                        + "/release",
                session.cookie(),
                Map.of("expectedAssetVersion", 1),
                Set.of(403));
        assertAccessProblem(wrongUsage, "BUSINESS: a catalog asset cannot be released as a sales-menu image");
        context.post(
                OPERATIONS_ASSET_RELEASE,
                "/api/operations/catalog-inventory/assets/" + wrongUsageAssetRef + "/release",
                session.cookie(),
                Map.of(
                        "assetRef", wrongUsageAssetRef,
                        "expectedVersion",
                                catalogStaged
                                        .json()
                                        .path("result")
                                        .path("version")
                                        .asLong(),
                        "dataNodeRef", fixture.storeId().toString()),
                Set.of(200));

        Map<String, Object> customUpdate = new LinkedHashMap<>();
        customUpdate.put("displayNameOverride", null);
        Map<String, Object> saleContent = new LinkedHashMap<>();
        saleContent.put("kind", "DIRECT");
        saleContent.put("listedPriceCents", 4600);
        saleContent.put("skuPrices", List.of());
        saleContent.put("orderOptionSelections", List.of());
        customUpdate.put("saleContent", saleContent);
        customUpdate.put("orderingConstraints", Map.of("minItemQuantity", 1, "quantityStep", 1));
        customUpdate.put(
                "displayMedia",
                Map.of(
                        "mode", "CUSTOM",
                        "assetRefs", List.of(UUID.fromString(claimedAssetRef)),
                        "primaryAssetRef", UUID.fromString(claimedAssetRef)));
        customUpdate.put("expectedVersion", addMenuVersion);
        BackendAcceptanceTest.Response claimed = context.put(
                OPERATIONS_SALES_MENU_ITEM_UPDATE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef,
                session.cookie(),
                customUpdate,
                Map.of("X-Sales-Menu-Asset-Bind-Grants", "{\"" + claimedAssetRef + "\":\"" + bindGrant + "\"}"),
                Set.of(200));
        assertTrue(
                claimed.json().path("version").asLong() > 0,
                "BUSINESS: custom image claim returns the authoritative menu version");
        BackendAcceptanceTest.Response claimedItem = context.get(
                OPERATIONS_SALES_MENU_DRAFT_ITEM,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef,
                session.cookie(),
                Set.of(200));
        assertTrue(
                claimedItem.json().path("version").asLong() > itemVersion,
                "BUSINESS: custom image claim is committed with the item CAS");
        BackendAcceptanceTest.Response claimedRelease = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef + "/assets/stage/" + claimedAssetRef
                        + "/release",
                session.cookie(),
                Map.of("expectedAssetVersion", 1),
                Set.of(409));
        assertTrue(
                claimedRelease.problemCode().contains("ASSET")
                        || claimedRelease.problemCode().contains("CLAIM"),
                "BUSINESS: an ACTIVE claimed image cannot be released as an unclaimed stage");

        long currentItemVersion = claimedItem.json().path("version").asLong();
        BackendAcceptanceTest.Response stagedForRelease = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                stagePath,
                session.cookie(),
                currentItemVersion,
                "sales-menu-release.png",
                "image/png",
                BackendAcceptanceTest.sha256(PNG),
                PNG,
                Set.of(201));
        String releasedAssetRef = stagedForRelease.json().path("assetRef").asText();
        assertEquals(
                "STAGED",
                stagedForRelease.json().path("status").asText(),
                "BUSINESS: replacement image is a separate STAGED lifecycle row");
        BackendAcceptanceTest.Response released = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef + "/assets/stage/" + releasedAssetRef
                        + "/release",
                session.cookie(),
                Map.of(
                        "expectedAssetVersion",
                        stagedForRelease.json().path("version").asLong()),
                Set.of(200));
        assertEquals(
                "RELEASED",
                released.json().path("status").asText(),
                "BUSINESS: exact sales-menu target release returns RELEASED");
        assertEquals(
                currentItemVersion,
                released.json().path("target").path("expectedDraftVersion").asLong(),
                "BUSINESS: release readback returns the stored target draft version");
        BackendAcceptanceTest.Response releasedAgain = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef + "/assets/stage/" + releasedAssetRef
                        + "/release",
                session.cookie(),
                Map.of("expectedAssetVersion", released.json().path("version").asLong()),
                Set.of(409));
        assertTrue(
                releasedAgain.problemCode().contains("ASSET")
                        || releasedAgain.problemCode().contains("CLAIM"),
                "BUSINESS: an already RELEASED image cannot be released again");

        long currentMenuVersion = claimed.json().path("version").asLong();
        BackendAcceptanceTest.Response activation = context.put(
                OPERATIONS_SALES_MENU_ACTIVATION,
                menuRoot + "/" + menuRef + "/channels/" + channelRef + "/activation",
                session.cookie(),
                Map.of("status", "ENABLED", "expectedVersion", currentMenuVersion),
                Set.of(200));
        assertEquals(
                "setOperationsSalesMenuActivation",
                activation.json().path("operationKind").asText(),
                "BUSINESS: published-bound fixture enables the target channel explicitly");
        currentMenuVersion = activation.json().path("version").asLong();
        BackendAcceptanceTest.Response publication = context.post(
                OPERATIONS_SALES_MENU_PUBLISH,
                menuRoot + "/" + menuRef + "/publications",
                session.cookie(),
                Map.of("expectedVersion", currentMenuVersion),
                Set.of(201));
        assertEquals(
                "publishOperationsSalesMenu",
                publication.json().path("operationKind").asText(),
                "BUSINESS: the claimed image enters an immutable publication");
        currentMenuVersion = publication.json().path("version").asLong();
        BackendAcceptanceTest.Response publishedItem = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                menuRoot + "/" + menuRef + "/published/items/" + salesItemRef + "?channelRef=" + channelRef,
                session.cookie(),
                Set.of(200));
        boolean publishedOriginal = false;
        for (JsonNode ref : publishedItem.json().path("displayMedia").path("assetRefs")) {
            if (claimedAssetRef.equals(ref.asText())) {
                publishedOriginal = true;
                break;
            }
        }
        assertTrue(publishedOriginal, "BUSINESS: the immutable publication retains the claimed image identity");

        BackendAcceptanceTest.Response stagedReplacement = context.multipartSalesMenuAsset(
                OPERATIONS_SALES_MENU_ASSET_STAGE,
                stagePath,
                session.cookie(),
                currentItemVersion,
                "sales-menu-published-replacement.png",
                "image/png",
                BackendAcceptanceTest.sha256(OTHER_PNG),
                OTHER_PNG,
                Set.of(201));
        String replacementAssetRef = requiredJsonNode(
                        stagedReplacement.json(),
                        "/assetRef",
                        com.fasterxml.jackson.databind.node.JsonNodeType.STRING,
                        "BUSINESS: published-bound replacement assetRef")
                .asText();
        String replacementBindGrant = requiredJsonNode(
                        stagedReplacement.json(),
                        "/bindGrant",
                        com.fasterxml.jackson.databind.node.JsonNodeType.STRING,
                        "BUSINESS: published-bound replacement bindGrant")
                .asText();
        Map<String, Object> replacementUpdate = new LinkedHashMap<>();
        replacementUpdate.put("displayNameOverride", null);
        replacementUpdate.put(
                "saleContent",
                Map.of(
                        "kind", "DIRECT",
                        "listedPriceCents", 4700,
                        "skuPrices", List.of(),
                        "orderOptionSelections", List.of()));
        replacementUpdate.put("orderingConstraints", Map.of("minItemQuantity", 1, "quantityStep", 1));
        replacementUpdate.put(
                "displayMedia",
                Map.of(
                        "mode", "CUSTOM",
                        "assetRefs", List.of(UUID.fromString(replacementAssetRef)),
                        "primaryAssetRef", UUID.fromString(replacementAssetRef)));
        replacementUpdate.put("expectedVersion", currentMenuVersion);
        BackendAcceptanceTest.Response replaced = context.put(
                OPERATIONS_SALES_MENU_ITEM_UPDATE,
                menuRoot + "/" + menuRef + "/draft/items/" + salesItemRef,
                session.cookie(),
                replacementUpdate,
                Map.of(
                        "X-Sales-Menu-Asset-Bind-Grants",
                        "{\"" + replacementAssetRef + "\":\"" + replacementBindGrant + "\"}"),
                Set.of(200));
        currentMenuVersion = replaced.json().path("version").asLong();
        BackendAcceptanceTest.Response publishedAfterDraftReplacement = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                menuRoot + "/" + menuRef + "/published/items/" + salesItemRef + "?channelRef=" + channelRef,
                session.cookie(),
                Set.of(200));
        boolean originalStillPublished = false;
        boolean replacementPublished = false;
        for (JsonNode ref :
                publishedAfterDraftReplacement.json().path("displayMedia").path("assetRefs")) {
            originalStillPublished |= claimedAssetRef.equals(ref.asText());
            replacementPublished |= replacementAssetRef.equals(ref.asText());
        }
        assertTrue(
                originalStillPublished && !replacementPublished,
                "BUSINESS: a draft image replacement cannot rewrite the frozen publication");

        BackendAcceptanceTest.Response archived = context.post(
                OPERATIONS_SALES_MENU_ARCHIVE,
                menuRoot + "/" + menuRef + "/archive",
                session.cookie(),
                Map.of("expectedVersion", currentMenuVersion),
                Set.of(200));
        assertEquals(
                "archiveOperationsSalesMenu",
                archived.json().path("operationKind").asText(),
                "BUSINESS: archive returns the authoritative menu command");
        BackendAcceptanceTest.Response archivedDetail = context.get(
                OPERATIONS_SALES_MENU,
                menuRoot + "/" + menuRef + "?channelRef=" + channelRef,
                session.cookie(),
                Set.of(200));
        assertTrue(
                archivedDetail.json().path("archived").asBoolean(false),
                "BUSINESS: the published-bound fixture archives the menu without deleting its history");
        BackendAcceptanceTest.Response publishedBoundRelease = context.post(
                OPERATIONS_SALES_MENU_ASSET_RELEASE,
                stagePath + "/" + claimedAssetRef + "/release",
                session.cookie(),
                Map.of("expectedAssetVersion", staged.json().path("version").asLong() + 1),
                Set.of(409));
        assertTrue(
                publishedBoundRelease.problemCode().contains("ASSET")
                        || publishedBoundRelease.problemCode().contains("CLAIM"),
                "BUSINESS: a published-bound ACTIVE image remains unreleasable after draft replacement and archive");
        BackendAcceptanceTest.Response publishedAfterArchive = context.get(
                OPERATIONS_SALES_MENU_PUBLISHED_ITEM,
                menuRoot + "/" + menuRef + "/published/items/" + salesItemRef + "?channelRef=" + channelRef,
                session.cookie(),
                Set.of(200));
        assertTrue(
                publishedAfterArchive
                        .json()
                        .path("displayMedia")
                        .path("assetRefs")
                        .toString()
                        .contains(claimedAssetRef),
                "BUSINESS: archive preserves the immutable published image reference");
    }

    private BackendAcceptanceTest.Session selectStore(
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
                "BUSINESS: asset scenario selects the intended store scope");
        return new BackendAcceptanceTest.Session(
                session.cookie(),
                selected.json(),
                selected.json().path("contextVersion").asLong());
    }

    private static void assertAccessProblem(BackendAcceptanceTest.Response response, String message) {
        assertTrue(
                response.problemCode().contains("ACCESS")
                        || response.problemCode().contains("SCOPE")
                        || response.problemCode().contains("CAPABILITY")
                        || response.problemCode().contains("ASSET"),
                message + ": typed problem code");
    }
}
