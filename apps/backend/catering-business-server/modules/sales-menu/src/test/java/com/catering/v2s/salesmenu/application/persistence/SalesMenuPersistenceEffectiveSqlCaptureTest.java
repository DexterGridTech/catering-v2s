package com.catering.v2s.salesmenu.application.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import com.catering.v2s.platform.foundation.collection.OpaqueCollectionCursor;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.application.SalesMenuReadModels;
import com.catering.v2s.salesmenu.domain.SalesMenuDisplayMediaMode;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuMoveDirection;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuPageRequest;
import com.catering.v2s.salesmenu.domain.SalesMenuSchedule;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** Captures the production JdbcTemplate boundary for every public typed persistence method. */
class SalesMenuPersistenceEffectiveSqlCaptureTest {
    private static final UUID WORKSPACE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID MENU = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID VERSION = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID SECTION = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID ITEM = UUID.fromString("00000000-0000-0000-0000-000000000005");
    private static final UUID SKU = UUID.fromString("00000000-0000-0000-0000-000000000006");
    private static final UUID ASSET = UUID.fromString("00000000-0000-0000-0000-000000000007");
    private static final UUID CHANNEL = UUID.fromString("00000000-0000-0000-0000-000000000008");
    private static final UUID OTHER_ITEM = UUID.fromString("00000000-0000-0000-0000-000000000015");
    private static final UUID OTHER_CATALOG_ITEM = UUID.fromString("00000000-0000-0000-0000-000000000016");
    private static final UUID OTHER_SKU = UUID.fromString("00000000-0000-0000-0000-000000000017");
    private static final UUID OTHER_ASSET = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final Set<String> EXPECTED_BRANCH_CASE_IDS = Set.of(
            "sales-menu/persistence/list-menu-rows/no-cursor",
            "sales-menu/persistence/list-menu-rows/cursor",
            "sales-menu/persistence/insert-version/source-draft-null",
            "sales-menu/persistence/insert-version/source-draft-present",
            "sales-menu/persistence/insert-published-items/empty",
            "sales-menu/persistence/insert-published-items/one",
            "sales-menu/persistence/insert-published-items/many",
            "sales-menu/persistence/insert-published-skus/empty",
            "sales-menu/persistence/insert-published-skus/one",
            "sales-menu/persistence/insert-published-skus/many",
            "sales-menu/persistence/insert-published-media/empty",
            "sales-menu/persistence/insert-published-media/one",
            "sales-menu/persistence/insert-published-media/many",
            "sales-menu/persistence/read-order-option-groups/empty",
            "sales-menu/persistence/read-order-option-groups/one",
            "sales-menu/persistence/read-order-option-groups/many",
            "sales-menu/persistence/read-order-option-values/empty",
            "sales-menu/persistence/read-order-option-values/one",
            "sales-menu/persistence/read-order-option-values/many",
            "sales-menu/persistence/read-sku-rows/empty",
            "sales-menu/persistence/read-sku-rows/one",
            "sales-menu/persistence/read-sku-rows/many",
            "sales-menu/persistence/read-media-items/empty",
            "sales-menu/persistence/read-media-items/one",
            "sales-menu/persistence/read-media-items/many",
            "sales-menu/persistence/find-adjacent/section/up/no-section",
            "sales-menu/persistence/find-adjacent/section/up/section",
            "sales-menu/persistence/find-adjacent/section/down/no-section",
            "sales-menu/persistence/find-adjacent/section/down/section",
            "sales-menu/persistence/find-adjacent/item/up/no-section",
            "sales-menu/persistence/find-adjacent/item/up/section",
            "sales-menu/persistence/find-adjacent/item/down/no-section",
            "sales-menu/persistence/find-adjacent/item/down/section",
            "sales-menu/persistence/max-display-order/section/no-section",
            "sales-menu/persistence/max-display-order/section/section",
            "sales-menu/persistence/max-display-order/item/no-section",
            "sales-menu/persistence/max-display-order/item/section",
            "sales-menu/persistence/set-display-order/section",
            "sales-menu/persistence/set-display-order/item",
            "sales-menu/persistence/read-operation-record-rows/no-cursor",
            "sales-menu/persistence/read-operation-record-rows/cursor",
            "sales-menu/persistence/read-operation-record-rows/invalid-cursor",
            "sales-menu/persistence/read-manual-item-rows/no-section/no-item",
            "sales-menu/persistence/read-manual-item-rows/no-section/item",
            "sales-menu/persistence/read-manual-item-rows/section/no-item",
            "sales-menu/persistence/read-manual-item-rows/section/item",
            "sales-menu/persistence/find-item-adjacent/up/no-section",
            "sales-menu/persistence/find-item-adjacent/up/section",
            "sales-menu/persistence/find-item-adjacent/down/no-section",
            "sales-menu/persistence/find-item-adjacent/down/section",
            "sales-menu/persistence/max-item-display-order/no-section",
            "sales-menu/persistence/max-item-display-order/section",
            "sales-menu/persistence/read-version-item-page/no-frontier",
            "sales-menu/persistence/read-version-item-page/frontier",
            "sales-menu/persistence/read-version-item-rows/no-section/no-item",
            "sales-menu/persistence/read-version-item-rows/no-section/item",
            "sales-menu/persistence/read-version-item-rows/section/no-item",
            "sales-menu/persistence/read-version-item-rows/section/item",
            "sales-menu/persistence/read-item-order-option-groups/empty",
            "sales-menu/persistence/read-item-order-option-groups/one",
            "sales-menu/persistence/read-item-order-option-groups/many",
            "sales-menu/persistence/read-item-order-option-values/empty",
            "sales-menu/persistence/read-item-order-option-values/one",
            "sales-menu/persistence/read-item-order-option-values/many",
            "sales-menu/persistence/read-item-sku-rows/empty",
            "sales-menu/persistence/read-item-sku-rows/one",
            "sales-menu/persistence/read-item-sku-rows/many",
            "sales-menu/persistence/read-item-media-rows/empty",
            "sales-menu/persistence/read-item-media-rows/one",
            "sales-menu/persistence/read-item-media-rows/many",
            "sales-menu/persistence/read-current-manual-statuses/empty",
            "sales-menu/persistence/read-current-manual-statuses/one",
            "sales-menu/persistence/read-current-manual-statuses/many",
            "sales-menu/persistence/insert-sales-items-batch/empty",
            "sales-menu/persistence/insert-sales-items-batch/one",
            "sales-menu/persistence/insert-sales-items-batch/many",
            "sales-menu/persistence/insert-draft-version-items-batch/empty",
            "sales-menu/persistence/insert-draft-version-items-batch/one",
            "sales-menu/persistence/insert-draft-version-items-batch/many",
            "sales-menu/persistence/count-draft-items-by-catalog/empty",
            "sales-menu/persistence/count-draft-items-by-catalog/one",
            "sales-menu/persistence/count-draft-items-by-catalog/many");

    @Test
    void capturesAllPublicTypedPersistenceMethodsThroughProductionJdbcTemplate() throws Exception {
        List<Point> points = new ArrayList<>();
        List<Method> methods = Arrays.stream(SalesMenuPersistence.class.getDeclaredMethods())
                .filter(method -> Modifier.isPublic(method.getModifiers()))
                .filter(method -> !method.isSynthetic())
                .sorted((left, right) -> signature(left).compareTo(signature(right)))
                .toList();

        for (Method method : methods) {
            capture(points, "sales-menu/persistence/" + signature(method), persistence -> invoke(method, persistence));
        }

        capture(
                points,
                "sales-menu/persistence/list-menu-rows/cursor",
                persistence -> persistence.listMenuRows(
                        listQuery(), new OpaqueCollectionCursor.Position("Menu", ITEM), "menu"));
        capture(
                points,
                "sales-menu/persistence/find-adjacent/item/down/no-section",
                persistence -> persistence.findAdjacent(
                        SalesMenuPersistence.OrderingTable.ITEM, VERSION, ITEM, SalesMenuMoveDirection.DOWN, null, 3L));
        capture(
                points,
                "sales-menu/persistence/find-adjacent/section/up/section",
                persistence -> persistence.findAdjacent(
                        SalesMenuPersistence.OrderingTable.SECTION,
                        VERSION,
                        SECTION,
                        SalesMenuMoveDirection.UP,
                        SECTION,
                        3L));
        capture(
                points,
                "sales-menu/persistence/max-display-order/item/no-section",
                persistence -> persistence.maxDisplayOrder(SalesMenuPersistence.OrderingTable.ITEM, VERSION, null));
        capture(
                points,
                "sales-menu/persistence/find-item-adjacent/down/no-section",
                persistence -> persistence.findItemAdjacent(VERSION, ITEM, SalesMenuMoveDirection.DOWN, null, 3L));
        capture(
                points,
                "sales-menu/persistence/max-item-display-order/no-section",
                persistence -> persistence.maxItemDisplayOrder(VERSION, null));
        capture(
                points,
                "sales-menu/persistence/read-version-item-page/no-frontier",
                persistence -> persistence.readVersionItemPage(VERSION, SECTION, null, null, 20));
        capture(
                points,
                "sales-menu/persistence/read-version-item-rows/no-target",
                persistence -> persistence.readVersionItemRows(VERSION, null, null));

        assertTrue(points.size() >= methods.size(), "each public typed method must reach a JDBC sink");
        assertTrue(points.stream().map(Point::key).distinct().count() == points.size(), "capture keys must be unique");
        assertTrue(points.stream().allMatch(point -> !point.sql().isBlank()), "effective SQL must not be blank");

        List<BranchPoint> branches = new ArrayList<>();
        captureReachableSqlBranches(branches);
        assertTrue(branches.size() > 60, "all effective SQL branch cases must be represented explicitly");
        Set<String> actualBranchCaseIds =
                branches.stream().map(BranchPoint::branchCaseId).collect(Collectors.toSet());
        assertEquals(EXPECTED_BRANCH_CASE_IDS, actualBranchCaseIds, "stable branch-case-id set must remain complete");
        assertEquals(EXPECTED_BRANCH_CASE_IDS.size(), branches.size(), "stable branch-case-id count must remain exact");
        assertTrue(
                branches.stream().anyMatch(branch -> branch.outcome().equals("NO_JDBC")),
                "empty-input no-write branches must be recorded rather than represented by fake SQL");
        writeCapture(points, branches);
    }

    @Test
    void publicPersistenceSurfaceDoesNotExposeRawSqlOrGenericMapperArguments() {
        for (Method method : SalesMenuPersistence.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(method.getModifiers()) || method.isSynthetic()) continue;
            assertFalse(method.isVarArgs(), signature(method));
            assertTrue(
                    Arrays.stream(method.getParameterTypes()).noneMatch(RowMapper.class::isAssignableFrom),
                    signature(method));
        }
    }

    private static void invoke(Method method, SalesMenuPersistence persistence) {
        try {
            method.invoke(persistence, arguments(method));
        } catch (InvocationTargetException failure) {
            Throwable cause = failure.getCause();
            if (cause instanceof RuntimeException runtime && !(runtime instanceof NullPointerException)) return;
            throw new AssertionError(
                    "typed persistence method did not reach its JDBC boundary: " + signature(method), cause);
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError("cannot invoke " + signature(method), failure);
        }
    }

    private static Object[] arguments(Method method) {
        Object[] arguments = new Object[method.getParameterCount()];
        for (int index = 0; index < arguments.length; index++) {
            arguments[index] = argument(method, index);
        }
        return arguments;
    }

    private static Object argument(Method method, int index) {
        Class<?> type = method.getParameterTypes()[index];
        if (type == UUID.class) return uuidFor(method, index);
        if (type == String.class) return stringFor(method, index);
        if (type == long.class || type == Long.class) return 3L;
        if (type == int.class || type == Integer.class) return 20;
        if (type == boolean.class || type == Boolean.class) return false;
        if (type.isEnum()) return type.getEnumConstants()[0];
        if (type == SalesMenuTarget.class) return target();
        if (type == SalesMenuScope.class) return scope();
        if (type == SalesMenuListQuery.class) return listQuery();
        if (type == SalesMenuOperationQuery.class) return operationQuery();
        if (type == SalesMenuSchedule.class) return SalesMenuSchedule.allDay();
        if (type == SalesMenuReadback.SalesMenuOrderOption.class) return option();
        if (type == SalesMenuReadback.SalesMenuOrderOptionValue.class) return optionValue();
        if (type == SalesMenuReadModels.ItemRow.class) return itemRow();
        if (type == SalesMenuReadModels.SkuRow.class) return skuRow();
        if (type == SalesMenuReadModels.SectionOrderRow.class) return sectionOrderRow();
        if (type == OpaqueCollectionCursor.Position.class) return null;
        if (List.class.isAssignableFrom(type)) return listArgument(method.getGenericParameterTypes()[index]);
        if (Set.class.isAssignableFrom(type)) return Set.of(ITEM);
        throw new AssertionError("no capture argument for " + type.getTypeName() + " in " + signature(method));
    }

    private static UUID uuidFor(Method method, int index) {
        String name = signature(method).toLowerCase();
        if (name.contains("channelref") || name.contains("channel_ref")) return CHANNEL;
        if (name.contains("assetref") || name.contains("asset_ref")) return ASSET;
        if (name.contains("skuref") || name.contains("sku_ref")) return SKU;
        if (name.contains("sectionref") || name.contains("section_ref")) return SECTION;
        if (name.contains("itemref") || name.contains("item_ref") || name.contains("salesitemref")) return ITEM;
        if (name.contains("versionref") || name.contains("version_ref")) return VERSION;
        if (name.contains("collectionref") || name.contains("menuref") || name.contains("menu_ref")) return MENU;
        if (name.contains("workspace")) return WORKSPACE;
        return switch (index % 4) {
            case 0 -> MENU;
            case 1 -> VERSION;
            case 2 -> ITEM;
            default -> WORKSPACE;
        };
    }

    private static String stringFor(Method method, int index) {
        String name = signature(method).toLowerCase();
        if (name.contains("direction")) return "ASC";
        if (name.contains("sort")) return "BINDING_NAME";
        if (name.contains("status")) return "ENABLED";
        if (name.contains("selectionmode")) return "SINGLE";
        if (name.contains("displaymediamode")) return SalesMenuDisplayMediaMode.INHERIT_CATALOG.name();
        if (name.contains("targetkind")) return "SALES_ITEM";
        if (name.contains("result")) return "SUCCESS";
        if (name.contains("actor")) return "SYSTEM";
        return switch (index % 3) {
            case 0 -> "value";
            case 1 -> "operation";
            default -> "name";
        };
    }

    private static Object listArgument(Type type) {
        if (!(type instanceof ParameterizedType parameterized)) return List.of(ITEM);
        String element = parameterized.getActualTypeArguments()[0].getTypeName();
        if (element.contains("PublicationItemSeed")) return List.of(publicationItemSeed());
        if (element.contains("PublicationSkuSeed")) return List.of(publicationSkuSeed());
        if (element.contains("PublicationMediaSeed")) return List.of(publicationMediaSeed());
        if (element.contains("DraftItemSeed"))
            return List.of(new SalesMenuPersistence.DraftItemSeed(ITEM, "Item", "ITEM", "CUSTOM", 1L));
        if (element.contains("UUID")) return List.of(ITEM);
        if (element.contains("String")) return List.of("value");
        if (element.contains("SalesMenuOrderOptionValue")) return List.of(optionValue());
        if (element.contains("SalesMenuOrderOption")) return List.of(option());
        if (element.contains("SkuRow")) return List.of(skuRow());
        return List.of(ITEM);
    }

    private static SalesMenuScope scope() {
        return new SalesMenuScope(WORKSPACE, "workspace-key", UUID.fromString("00000000-0000-0000-0000-000000000009"));
    }

    private static SalesMenuTarget target() {
        return new SalesMenuTarget(scope(), MENU);
    }

    private static SalesMenuListQuery listQuery() {
        return new SalesMenuListQuery(scope(), CHANNEL, "menu", SalesMenuPageRequest.firstPage(20));
    }

    private static SalesMenuOperationQuery operationQuery() {
        return new SalesMenuOperationQuery(target(), CHANNEL, SalesMenuPageRequest.firstPage(20));
    }

    private static SalesMenuReadback.SalesMenuOrderOption option() {
        return new SalesMenuReadback.SalesMenuOrderOption(
                UUID.fromString("00000000-0000-0000-0000-000000000010"),
                "Option",
                "SINGLE",
                1,
                false,
                0,
                1,
                List.of(optionValue()));
    }

    private static SalesMenuReadback.SalesMenuOrderOptionValue optionValue() {
        return new SalesMenuReadback.SalesMenuOrderOptionValue(
                UUID.fromString("00000000-0000-0000-0000-000000000011"), "Value", 1, false, 0L);
    }

    private static SalesMenuReadModels.ItemRow itemRow() {
        return new SalesMenuReadModels.ItemRow(
                VERSION,
                ITEM,
                ITEM,
                SECTION,
                1L,
                1L,
                null,
                "Item",
                "ITEM",
                "CUSTOM",
                null,
                null,
                null,
                null,
                null,
                100L,
                "{}",
                SalesMenuDisplayMediaMode.INHERIT_CATALOG.name(),
                null,
                "[]",
                false,
                false);
    }

    private static SalesMenuReadModels.SkuRow skuRow() {
        return new SalesMenuReadModels.SkuRow(ITEM, SKU, 100L, "SKU", "SKU", 100L, 1L);
    }

    private static SalesMenuReadModels.SectionOrderRow sectionOrderRow() {
        return new SalesMenuReadModels.SectionOrderRow(SECTION, "Section", 1L);
    }

    private static SalesMenuPersistence.PublicationItemSeed publicationItemSeed() {
        return new SalesMenuPersistence.PublicationItemSeed(
                VERSION,
                ITEM,
                SECTION,
                MENU,
                1L,
                null,
                "Item",
                "ITEM",
                "CUSTOM",
                null,
                null,
                null,
                null,
                null,
                100L,
                "{}",
                SalesMenuDisplayMediaMode.INHERIT_CATALOG.name(),
                null,
                "[]");
    }

    private static SalesMenuPersistence.PublicationSkuSeed publicationSkuSeed() {
        return new SalesMenuPersistence.PublicationSkuSeed(VERSION, ITEM, SKU, 100L, "SKU", "SKU", 100L, 1L);
    }

    private static SalesMenuPersistence.PublicationMediaSeed publicationMediaSeed() {
        return new SalesMenuPersistence.PublicationMediaSeed(VERSION, ITEM, ASSET, 1);
    }

    private static void captureReachableSqlBranches(List<BranchPoint> branches) {
        captureBranch(
                branches,
                "sales-menu/persistence/list-menu-rows/no-cursor",
                true,
                persistence -> persistence.listMenuRows(listQuery(), null, "menu"));
        captureBranch(
                branches,
                "sales-menu/persistence/list-menu-rows/cursor",
                true,
                persistence -> persistence.listMenuRows(
                        listQuery(), new OpaqueCollectionCursor.Position("Menu", ITEM), "menu"));

        captureBranch(
                branches,
                "sales-menu/persistence/insert-version/source-draft-null",
                true,
                persistence -> persistence.insertVersion(
                        VERSION, MENU, SalesMenuVersionKind.values()[0], 1L, SalesMenuSchedule.allDay(), null, null));
        captureBranch(
                branches,
                "sales-menu/persistence/insert-version/source-draft-present",
                true,
                persistence -> persistence.insertVersion(
                        VERSION, MENU, SalesMenuVersionKind.values()[0], 1L, SalesMenuSchedule.allDay(), MENU, 2L));

        captureBatchBranches(
                branches,
                "insert-published-items",
                persistence -> persistence.insertPublishedItems(List.of()),
                persistence -> persistence.insertPublishedItems(List.of(publicationItemSeed())),
                persistence -> persistence.insertPublishedItems(
                        List.of(publicationItemSeed(), publicationItemSeed(OTHER_ITEM, SECTION, MENU))));
        captureBatchBranches(
                branches,
                "insert-published-skus",
                persistence -> persistence.insertPublishedSkus(List.of()),
                persistence -> persistence.insertPublishedSkus(List.of(publicationSkuSeed())),
                persistence -> persistence.insertPublishedSkus(
                        List.of(publicationSkuSeed(), publicationSkuSeed(OTHER_ITEM, OTHER_SKU))));
        captureBatchBranches(
                branches,
                "insert-published-media",
                persistence -> persistence.insertPublishedMedia(List.of()),
                persistence -> persistence.insertPublishedMedia(List.of(publicationMediaSeed())),
                persistence -> persistence.insertPublishedMedia(List.of(
                        publicationMediaSeed(),
                        new SalesMenuPersistence.PublicationMediaSeed(VERSION, OTHER_ITEM, OTHER_ASSET, 2))));

        captureCollectionReadBranches(
                branches,
                "read-order-option-groups",
                persistence -> persistence.readOrderOptionGroups(VERSION, List.of()));
        captureCollectionReadBranches(
                branches,
                "read-order-option-values",
                persistence -> persistence.readOrderOptionValues(VERSION, List.of()));
        captureCollectionReadBranches(
                branches, "read-sku-rows", persistence -> persistence.readSkuRows(VERSION, List.of()));
        captureCollectionReadBranches(
                branches, "read-media-items", persistence -> persistence.readMediaItems(VERSION, List.of()));

        captureOrderingTableBranches(branches);
        captureOperationRecordBranches(branches);
        captureManualItemBranches(branches);
        captureItemOrderingBranches(branches);
        captureVersionItemBranches(branches);
        captureItemCollectionReadBranches(branches);
        captureBatchBranches(
                branches,
                "insert-sales-items-batch",
                persistence -> persistence.insertSalesItemsBatch(MENU, List.of(), List.of()),
                persistence -> persistence.insertSalesItemsBatch(MENU, List.of(ITEM), List.of(OTHER_CATALOG_ITEM)),
                persistence -> persistence.insertSalesItemsBatch(
                        MENU, List.of(ITEM, OTHER_ITEM), List.of(OTHER_CATALOG_ITEM, MENU)));
        captureBatchBranches(
                branches,
                "insert-draft-version-items-batch",
                persistence -> persistence.insertDraftVersionItemsBatch(VERSION, SECTION, MENU, List.of()),
                persistence -> persistence.insertDraftVersionItemsBatch(
                        VERSION, SECTION, MENU, List.of(draftItemSeed(ITEM, 1L))),
                persistence -> persistence.insertDraftVersionItemsBatch(
                        VERSION, SECTION, MENU, List.of(draftItemSeed(ITEM, 1L), draftItemSeed(OTHER_ITEM, 2L))));
        captureBatchBranches(
                branches,
                "count-draft-items-by-catalog",
                persistence -> persistence.countDraftItemsByCatalog(MENU, VERSION, Set.of()),
                persistence -> persistence.countDraftItemsByCatalog(MENU, VERSION, Set.of(ITEM)),
                persistence -> persistence.countDraftItemsByCatalog(MENU, VERSION, Set.of(ITEM, OTHER_CATALOG_ITEM)));
    }

    private static void captureCollectionReadBranches(
            List<BranchPoint> branches, String method, java.util.function.Consumer<SalesMenuPersistence> emptyAction) {
        captureBranch(branches, "sales-menu/persistence/" + method + "/empty", false, emptyAction);
        captureBranch(
                branches,
                "sales-menu/persistence/" + method + "/one",
                true,
                persistence -> invokeCollectionRead(method, persistence, List.of(ITEM)));
        captureBranch(
                branches,
                "sales-menu/persistence/" + method + "/many",
                true,
                persistence -> invokeCollectionRead(method, persistence, List.of(ITEM, OTHER_ITEM)));
    }

    private static void invokeCollectionRead(String method, SalesMenuPersistence persistence, List<UUID> itemRefs) {
        switch (method) {
            case "read-order-option-groups" -> persistence.readOrderOptionGroups(VERSION, itemRefs);
            case "read-order-option-values" -> persistence.readOrderOptionValues(VERSION, itemRefs);
            case "read-sku-rows" -> persistence.readSkuRows(VERSION, itemRefs);
            case "read-media-items" -> persistence.readMediaItems(VERSION, itemRefs);
            default -> throw new AssertionError("unknown collection read " + method);
        }
    }

    private static void captureOrderingTableBranches(List<BranchPoint> branches) {
        for (SalesMenuPersistence.OrderingTable table : SalesMenuPersistence.OrderingTable.values()) {
            for (SalesMenuMoveDirection direction : SalesMenuMoveDirection.values()) {
                for (UUID sectionRef : optionalRefs()) {
                    String section = sectionRef == null ? "no-section" : "section";
                    captureBranch(
                            branches,
                            "sales-menu/persistence/find-adjacent/"
                                    + table.name().toLowerCase()
                                    + "/"
                                    + direction.name().toLowerCase()
                                    + "/"
                                    + section,
                            true,
                            persistence -> persistence.findAdjacent(table, VERSION, ITEM, direction, sectionRef, 3L));
                }
            }
            for (UUID sectionRef : optionalRefs()) {
                String section = sectionRef == null ? "no-section" : "section";
                captureBranch(
                        branches,
                        "sales-menu/persistence/max-display-order/"
                                + table.name().toLowerCase()
                                + "/"
                                + section,
                        true,
                        persistence -> persistence.maxDisplayOrder(table, VERSION, sectionRef));
            }
            captureBranch(
                    branches,
                    "sales-menu/persistence/set-display-order/" + table.name().toLowerCase(),
                    true,
                    persistence -> persistence.setDisplayOrder(table, VERSION, ITEM, 4L));
        }
    }

    private static void captureOperationRecordBranches(List<BranchPoint> branches) {
        captureBranch(
                branches,
                "sales-menu/persistence/read-operation-record-rows/no-cursor",
                true,
                persistence -> persistence.readOperationRecordRows(operationQuery(), null));
        captureBranch(
                branches,
                "sales-menu/persistence/read-operation-record-rows/cursor",
                true,
                persistence -> persistence.readOperationRecordRows(
                        operationQuery(), new OpaqueCollectionCursor.Position("100", ITEM)));
        captureRejectedBranch(
                branches,
                "sales-menu/persistence/read-operation-record-rows/invalid-cursor",
                persistence -> persistence.readOperationRecordRows(
                        operationQuery(), new OpaqueCollectionCursor.Position("not-a-number", ITEM)));
    }

    private static void captureManualItemBranches(List<BranchPoint> branches) {
        for (UUID sectionRef : optionalRefs()) {
            for (UUID itemRef : optionalItemRefs()) {
                String section = sectionRef == null ? "no-section" : "section";
                String item = itemRef == null ? "no-item" : "item";
                captureBranch(
                        branches,
                        "sales-menu/persistence/read-manual-item-rows/" + section + "/" + item,
                        true,
                        persistence -> persistence.readManualItemRows(VERSION, sectionRef, itemRef));
            }
        }
    }

    private static void captureItemOrderingBranches(List<BranchPoint> branches) {
        for (SalesMenuMoveDirection direction : SalesMenuMoveDirection.values()) {
            for (UUID sectionRef : optionalRefs()) {
                String section = sectionRef == null ? "no-section" : "section";
                captureBranch(
                        branches,
                        "sales-menu/persistence/find-item-adjacent/"
                                + direction.name().toLowerCase()
                                + "/"
                                + section,
                        true,
                        persistence -> persistence.findItemAdjacent(VERSION, ITEM, direction, sectionRef, 3L));
            }
        }
        for (UUID sectionRef : optionalRefs()) {
            String section = sectionRef == null ? "no-section" : "section";
            captureBranch(
                    branches,
                    "sales-menu/persistence/max-item-display-order/" + section,
                    true,
                    persistence -> persistence.maxItemDisplayOrder(VERSION, sectionRef));
        }
    }

    private static void captureVersionItemBranches(List<BranchPoint> branches) {
        captureBranch(
                branches,
                "sales-menu/persistence/read-version-item-page/no-frontier",
                true,
                persistence -> persistence.readVersionItemPage(VERSION, SECTION, null, null, 20));
        captureBranch(
                branches,
                "sales-menu/persistence/read-version-item-page/frontier",
                true,
                persistence -> persistence.readVersionItemPage(VERSION, SECTION, 3L, ITEM, 20));
        for (UUID sectionRef : optionalRefs()) {
            for (UUID itemRef : optionalItemRefs()) {
                String section = sectionRef == null ? "no-section" : "section";
                String item = itemRef == null ? "no-item" : "item";
                captureBranch(
                        branches,
                        "sales-menu/persistence/read-version-item-rows/" + section + "/" + item,
                        true,
                        persistence -> persistence.readVersionItemRows(VERSION, sectionRef, itemRef));
            }
        }
    }

    private static void captureItemCollectionReadBranches(List<BranchPoint> branches) {
        for (String method : List.of(
                "read-item-order-option-groups",
                "read-item-order-option-values",
                "read-item-sku-rows",
                "read-item-media-rows",
                "read-current-manual-statuses")) {
            captureBranch(
                    branches,
                    "sales-menu/persistence/" + method + "/empty",
                    false,
                    persistence -> invokeItemCollectionRead(method, persistence, List.of()));
            captureBranch(
                    branches,
                    "sales-menu/persistence/" + method + "/one",
                    true,
                    persistence -> invokeItemCollectionRead(method, persistence, List.of(ITEM)));
            captureBranch(
                    branches,
                    "sales-menu/persistence/" + method + "/many",
                    true,
                    persistence -> invokeItemCollectionRead(method, persistence, List.of(ITEM, OTHER_ITEM)));
        }
    }

    private static void invokeItemCollectionRead(String method, SalesMenuPersistence persistence, List<UUID> itemRefs) {
        switch (method) {
            case "read-item-order-option-groups" -> persistence.readItemOrderOptionGroups(VERSION, itemRefs);
            case "read-item-order-option-values" -> persistence.readItemOrderOptionValues(VERSION, itemRefs);
            case "read-item-sku-rows" -> persistence.readItemSkuRows(VERSION, itemRefs);
            case "read-item-media-rows" -> persistence.readItemMediaRows(VERSION, itemRefs);
            case "read-current-manual-statuses" -> persistence.readCurrentManualStatuses(CHANNEL, itemRefs);
            default -> throw new AssertionError("unknown item collection read " + method);
        }
    }

    private static void captureBatchBranches(
            List<BranchPoint> branches,
            String method,
            java.util.function.Consumer<SalesMenuPersistence> empty,
            java.util.function.Consumer<SalesMenuPersistence> one,
            java.util.function.Consumer<SalesMenuPersistence> many) {
        captureBranch(branches, "sales-menu/persistence/" + method + "/empty", false, empty);
        captureBranch(branches, "sales-menu/persistence/" + method + "/one", true, one);
        captureBranch(branches, "sales-menu/persistence/" + method + "/many", true, many);
    }

    private static void captureBranch(
            List<BranchPoint> branches,
            String branchCaseId,
            boolean expectsJdbc,
            java.util.function.Consumer<SalesMenuPersistence> action) {
        List<RawCall> calls = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        configure(jdbc, calls);
        action.accept(new SalesMenuPersistence(jdbc));
        if (expectsJdbc) {
            assertFalse(calls.isEmpty(), branchCaseId + " must reach JdbcTemplate");
            for (int index = 0; index < calls.size(); index++) {
                RawCall call = calls.get(index);
                branches.add(new BranchPoint(
                        branchCaseId,
                        "JDBC",
                        call.sink(),
                        call.sql(),
                        call.slots(),
                        parameterMappingFor(branchCaseId)));
            }
        } else {
            assertTrue(calls.isEmpty(), branchCaseId + " must not reach JdbcTemplate");
            branches.add(
                    new BranchPoint(branchCaseId, "NO_JDBC", "", "", List.of(), parameterMappingFor(branchCaseId)));
        }
    }

    private static void captureRejectedBranch(
            List<BranchPoint> branches, String branchCaseId, java.util.function.Consumer<SalesMenuPersistence> action) {
        List<RawCall> calls = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        configure(jdbc, calls);
        assertThrows(IllegalArgumentException.class, () -> action.accept(new SalesMenuPersistence(jdbc)));
        assertTrue(calls.isEmpty(), branchCaseId + " must reject before JdbcTemplate");
        branches.add(new BranchPoint(branchCaseId, "REJECTED", "", "", List.of(), parameterMappingFor(branchCaseId)));
    }

    private static String parameterMappingFor(String branchCaseId) {
        if (branchCaseId.contains("list-menu-rows")) {
            return "channelRef|scope.workspaceUuid|scope.groupWorkspaceKey|scope.storeRef|filter|position.sortKey|position.tieBreaker|pageSize";
        }
        if (branchCaseId.contains("insert-version")) {
            return "versionRef|menuRef|kind|revision|schedule.kind|schedule.start|schedule.end|sourceDraftRef|sourceDraftRevision-or-null";
        }
        if (branchCaseId.contains("read-operation-record-rows")) {
            return "menu.scope.workspaceUuid|menu.scope.groupWorkspaceKey|menu.scope.storeRef|menuRef|channelRef|position.occurredAt|position.tieBreaker|pageSize";
        }
        if (branchCaseId.contains("find-adjacent")) {
            return "versionRef|sectionRef-if-present|currentOrder|currentOrder|targetRef";
        }
        if (branchCaseId.contains("max-display-order")) return "versionRef|sectionRef-if-present";
        if (branchCaseId.contains("set-display-order")) return "displayOrder|versionRef|targetRef";
        if (branchCaseId.contains("find-item-adjacent")) {
            return "versionRef|sectionRef-if-present|currentOrder|currentOrder|targetRef";
        }
        if (branchCaseId.contains("max-item-display-order")) return "versionRef|sectionRef-if-present";
        if (branchCaseId.contains("read-version-item-page")) {
            return "versionRef|sectionRef|afterDisplayOrder|afterDisplayOrder|afterItemRef|limit-plus-one";
        }
        if (branchCaseId.contains("read-version-item-rows"))
            return "versionRef|sectionRef-if-present|itemRef-if-present";
        if (branchCaseId.contains("read-manual-item-rows"))
            return "versionRef|sectionRef-if-present|itemRef-if-present";
        if (branchCaseId.contains("count-draft-items-by-catalog"))
            return "collectionRef|versionRef|catalogItemRefs-in-order";
        if (branchCaseId.contains("insert-sales-items-batch")) return "itemRefs[i]|collectionRef|catalogItemRefs[i]";
        if (branchCaseId.contains("insert-draft-version-items-batch")) {
            return "items[i].fields|versionRef|sectionRef|collectionRef|displayMediaMode";
        }
        if (branchCaseId.contains("insert-published")) return "items[i].record-fields-in-source-order";
        if (branchCaseId.contains("read-current-manual-statuses")) return "channelRef|itemRefs-in-order";
        return "versionRef|itemRefs-in-order";
    }

    private static List<UUID> optionalRefs() {
        return Arrays.asList(null, SECTION);
    }

    private static List<UUID> optionalItemRefs() {
        return Arrays.asList(null, ITEM);
    }

    private static SalesMenuPersistence.DraftItemSeed draftItemSeed(UUID itemRef, long ordinal) {
        return new SalesMenuPersistence.DraftItemSeed(itemRef, "Item", "ITEM", "CUSTOM", ordinal);
    }

    private static SalesMenuPersistence.PublicationItemSeed publicationItemSeed(
            UUID itemRef, UUID sectionRef, UUID collectionRef) {
        return new SalesMenuPersistence.PublicationItemSeed(
                VERSION,
                itemRef,
                sectionRef,
                collectionRef,
                1L,
                null,
                "Item",
                "ITEM",
                "CUSTOM",
                null,
                null,
                null,
                null,
                null,
                100L,
                "{}",
                SalesMenuDisplayMediaMode.INHERIT_CATALOG.name(),
                null,
                "[]");
    }

    private static SalesMenuPersistence.PublicationSkuSeed publicationSkuSeed(UUID itemRef, UUID skuRef) {
        return new SalesMenuPersistence.PublicationSkuSeed(VERSION, itemRef, skuRef, 100L, "SKU", "SKU", 100L, 1L);
    }

    private static void capture(
            List<Point> points, String key, java.util.function.Consumer<SalesMenuPersistence> action) {
        List<RawCall> calls = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        configure(jdbc, calls);
        action.accept(new SalesMenuPersistence(jdbc));
        assertFalse(calls.isEmpty(), key + " must reach JdbcTemplate");
        for (int index = 0; index < calls.size(); index++) {
            RawCall call = calls.get(index);
            points.add(new Point(key + "/" + (index + 1), call.sink(), call.sql(), call.slots()));
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void configure(JdbcTemplate jdbc, List<RawCall> calls) {
        doAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    calls.add(new RawCall("query", sql, describeValues(varargValues(invocation))));
                    if (sql.contains("COALESCE(max(display_order)")) {
                        RowMapper mapper = invocation.getArgument(1, RowMapper.class);
                        ResultSet result = mock(ResultSet.class);
                        org.mockito.Mockito.when(result.getLong(1)).thenReturn(0L);
                        return List.of(mapper.mapRow(result, 0));
                    }
                    return List.of();
                })
                .when(jdbc)
                .query(anyString(), any(RowMapper.class), any(Object[].class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "queryForList",
                            invocation.getArgument(0, String.class),
                            describeValues(varargValues(invocation))));
                    return List.of();
                })
                .when(jdbc)
                .queryForList(anyString(), any(Object[].class));
        doAnswer(invocation -> {
                    calls.add(new RawCall(
                            "update",
                            invocation.getArgument(0, String.class),
                            describeValues(varargValues(invocation))));
                    return 1;
                })
                .when(jdbc)
                .update(anyString(), any(Object[].class));
    }

    private static Object[] varargValues(InvocationOnMock invocation) {
        Object[] arguments = invocation.getArguments();
        if (arguments.length == 2 && arguments[1] instanceof Object[] values) return values;
        return Arrays.copyOfRange(arguments, 1, arguments.length);
    }

    private static List<String> describeValues(Object[] values) {
        return Arrays.stream(values)
                .map(SalesMenuPersistenceEffectiveSqlCaptureTest::describeValue)
                .toList();
    }

    private static String describeValue(Object value) {
        if (value == null) return "null";
        if (value instanceof UUID) return "UUID";
        if (value instanceof Number) return "NUMBER";
        if (value instanceof String string) return "String:" + string;
        return value.getClass().getSimpleName();
    }

    private static String signature(Method method) {
        return method.getName()
                + "("
                + Arrays.stream(method.getParameterTypes())
                        .map(Class::getSimpleName)
                        .collect(Collectors.joining(","))
                + ")";
    }

    private static void writeCapture(List<Point> points, List<BranchPoint> branches) {
        Path output = Path.of("sales-menu-effective-sql-capture-after.xml").toAbsolutePath();
        try {
            Files.writeString(
                    output,
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<sql-capture phase=\"after\">\n"
                            + points.stream()
                                    .map(point -> "  <point key=\""
                                            + escape(point.key())
                                            + "\" sink=\""
                                            + escape(point.sink())
                                            + "\" slots=\""
                                            + escape(String.join("|", point.slots()))
                                            + "\"><![CDATA["
                                            + point.sql().replace("]]>", "]]]]><![CDATA[>")
                                            + "]]></point>")
                                    .collect(Collectors.joining("\n"))
                            + "\n"
                            + branches.stream()
                                    .map(branch -> {
                                        String prefix = "  <branch branch-case-id=\""
                                                + escape(branch.branchCaseId())
                                                + "\" outcome=\""
                                                + escape(branch.outcome())
                                                + "\" sink=\""
                                                + escape(branch.sink())
                                                + "\" parameter-mapping=\""
                                                + escape(branch.parameterMapping())
                                                + "\" slots=\""
                                                + escape(String.join("|", branch.slots()))
                                                + "\"";
                                        if (branch.sql().isBlank()) return prefix + "/>";
                                        return prefix
                                                + "><![CDATA["
                                                + branch.sql().replace("]]>", "]]]]><![CDATA[>")
                                                + "]]></branch>";
                                    })
                                    .collect(Collectors.joining("\n"))
                            + "\n</sql-capture>\n");
        } catch (Exception failure) {
            throw new AssertionError("cannot write effective SQL capture", failure);
        }
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private record RawCall(String sink, String sql, List<String> slots) {}

    private record Point(String key, String sink, String sql, List<String> slots) {}

    private record BranchPoint(
            String branchCaseId,
            String outcome,
            String sink,
            String sql,
            List<String> slots,
            String parameterMapping) {}
}
