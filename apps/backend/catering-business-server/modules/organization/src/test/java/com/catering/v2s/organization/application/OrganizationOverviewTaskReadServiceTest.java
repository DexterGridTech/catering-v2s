package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.BusinessEntityTypes;
import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import com.catering.v2s.organization.api.OrganizationNodeTypes;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class OrganizationOverviewTaskReadServiceTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformHierarchyTreeUsesOneOrganizationProjection() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.platformHierarchyTree(UUID.randomUUID(), "organization-test"));

        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformOverviewPageUsesOwnerBoundedQueriesForHierarchyAndBusinessEntity() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        when(hierarchy.page(any(UUID.class), anyString(), any(OrganizationHierarchyService.HierarchyQuery.class)))
                .thenReturn(new OrganizationHierarchyService.HierarchyPage(1, 20, 0L, "UPDATED_AT", "DESC", List.of()));
        when(entities.pageBusinessEntities(
                        any(UUID.class),
                        anyString(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        anyString(),
                        anyString(),
                        anyInt(),
                        anyInt(),
                        any(),
                        any()))
                .thenReturn(new BusinessEntityService.BusinessEntityPage(List.of(), 0L, 1, 20));
        OrganizationOverviewTaskReadService service =
                new OrganizationOverviewTaskReadService(jdbc, null, entities, hierarchy, null);

        var hierarchyPage = service.platformOverviewTaskPage(
                UUID.randomUUID(),
                "organization-test",
                "HIERARCHY",
                OrganizationOverviewTaskReadService.Query.empty(),
                1,
                20);
        var businessEntityPage = service.platformOverviewTaskPage(
                UUID.randomUUID(),
                "organization-test",
                "BUSINESS_ENTITY",
                OrganizationOverviewTaskReadService.Query.empty(),
                1,
                20);

        assertEquals(0L, hierarchyPage.metadata().total());
        assertEquals(0L, businessEntityPage.metadata().total());
        verify(hierarchy).page(any(UUID.class), anyString(), any(OrganizationHierarchyService.HierarchyQuery.class));
        verify(entities)
                .pageBusinessEntities(
                        any(UUID.class),
                        anyString(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        anyString(),
                        anyString(),
                        anyInt(),
                        anyInt(),
                        any(),
                        any());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformOverviewSystemSourceReturnsNoBusinessEntityOrHierarchyRows() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        UUID workspaceUuid = UUID.randomUUID();
        OrganizationNodeReadback hierarchyNode = new OrganizationNodeReadback(
                UUID.randomUUID(),
                workspaceUuid,
                "organization-test",
                null,
                OrganizationNodeTypes.REGION,
                "R-1",
                "Region",
                null,
                "ENABLED",
                1L,
                1L,
                2L,
                List.of());
        OrganizationEntityReadback brand = new OrganizationEntityReadback(
                UUID.randomUUID(),
                BusinessEntityTypes.BRAND,
                workspaceUuid,
                "organization-test",
                "B-1",
                "Brand",
                null,
                null,
                "ENABLED",
                1L,
                null,
                null,
                null,
                0L,
                1L,
                2L,
                Map.of());
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        when(hierarchy.page(any(UUID.class), anyString(), any(OrganizationHierarchyService.HierarchyQuery.class)))
                .thenReturn(new OrganizationHierarchyService.HierarchyPage(
                        1,
                        20,
                        1L,
                        "UPDATED_AT",
                        "DESC",
                        List.of(new OrganizationHierarchyService.HierarchyPageItem(hierarchyNode, List.of()))));
        when(entities.pageBusinessEntities(
                        any(UUID.class),
                        anyString(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        anyString(),
                        anyString(),
                        anyInt(),
                        anyInt(),
                        any(),
                        any()))
                .thenReturn(new BusinessEntityService.BusinessEntityPage(
                        List.of(new BusinessEntityService.BusinessEntityPageItem(BusinessEntityTypes.BRAND, brand)),
                        1L,
                        1,
                        20,
                        4L));
        OrganizationOverviewTaskReadService service =
                new OrganizationOverviewTaskReadService(jdbc, null, entities, hierarchy, null);
        OrganizationOverviewTaskReadService.Query systemSource = new OrganizationOverviewTaskReadService.Query(
                null,
                null,
                null,
                null,
                null,
                null,
                "SYSTEM",
                null,
                null,
                null,
                null,
                "UPDATED_AT",
                "DESC",
                null,
                null,
                null);

        var hierarchyPage =
                service.platformOverviewTaskPage(workspaceUuid, "organization-test", "HIERARCHY", systemSource, 1, 20);
        var businessEntityPage = service.platformOverviewTaskPage(
                workspaceUuid, "organization-test", "BUSINESS_ENTITY", systemSource, 1, 20);

        assertEquals(0L, hierarchyPage.metadata().total());
        assertTrue(hierarchyPage.items().isEmpty());
        assertEquals(0L, businessEntityPage.metadata().total());
        assertTrue(businessEntityPage.items().isEmpty());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformManagementBaseDetailUsesOneOrganizationProjectionWithoutDefinitionLookup() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet rows = mock(ResultSet.class);
                    when(rows.next()).thenReturn(false);
                    return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
                });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.platformManagementBaseDetail(
                        UUID.randomUUID(), "organization-test", "HIERARCHY", UUID.randomUUID()));

        verify(jdbc)
                .query(
                        org.mockito.ArgumentMatchers.contains("WITH RECURSIVE target"),
                        any(PreparedStatementSetter.class),
                        any(ResultSetExtractor.class));
        verify(jdbc, org.mockito.Mockito.never()).queryForObject(anyString(), any(Class.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void platformManagementDetailCtesUseExplicitTargetColumns() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet rows = mock(ResultSet.class);
                    when(rows.next()).thenReturn(false);
                    return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
                });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        for (String category : List.of("HIERARCHY", "BUSINESS_ENTITY", "STORE")) {
            assertThrows(
                    BusinessEntityService.OrganizationNotFoundException.class,
                    () -> service.platformManagementBaseDetail(
                            UUID.randomUUID(), "organization-test", category, UUID.randomUUID()));
        }

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.times(3))
                .query(sqlCaptor.capture(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        List<String> statements = sqlCaptor.getAllValues().stream()
                .map(sql -> sql.replaceAll("\\s+", " "))
                .toList();

        assertFalse(statements.stream().anyMatch(sql -> sql.contains("SELECT target.*")));
        assertFalse(statements.stream().anyMatch(sql -> sql.contains("SELECT " + "* FROM target")));
        assertTrue(statements.stream()
                .anyMatch(sql ->
                        sql.contains("SELECT target.id, target.parent_id, target.node_type, target.code, target.name, "
                                + "target.status, target.version, target.created_at_epoch_millis, "
                                + "target.updated_at_epoch_millis, target.notes, target.extension_values, "
                                + "array_agg(ancestry.id")));
        assertTrue(statements.stream()
                .anyMatch(sql -> sql.contains(
                        "SELECT target.id, target.entity_type, target.code, target.name, target.legal_name, "
                                + "target.credit_code, target.alias, target.notes, target.status, target.version, "
                                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, "
                                + "target.extension_values FROM target")));
        assertTrue(statements.stream()
                .anyMatch(sql ->
                        sql.contains("SELECT target.id, target.code, target.name, target.status, target.version, "
                                + "target.created_at_epoch_millis, target.updated_at_epoch_millis, target.notes, "
                                + "target.extension_values, target.project_id, target.project_code, "
                                + "target.project_name, target.brand_id, target.brand_code, target.brand_name, "
                                + "target.tenant_id, target.tenant_code, target.tenant_name, target.head_id, "
                                + "target.head_code, target.head_name, array_agg(ancestry.id")));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void storeDetailProjectionIncludesExtensionValuesForItsRowMapper() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    ResultSet rows = mock(ResultSet.class);
                    when(rows.next()).thenReturn(false);
                    return ((ResultSetExtractor) invocation.getArgument(2)).extractData(rows);
                });
        OrganizationOverviewTaskReadService service = new OrganizationOverviewTaskReadService(jdbc);

        assertThrows(
                BusinessEntityService.OrganizationNotFoundException.class,
                () -> service.detail(UUID.randomUUID(), "organization-test", "STORE", UUID.randomUUID()));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sqlCaptor.capture(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        assertTrue(sqlCaptor
                .getValue()
                .replaceAll("\\s+", " ")
                .contains(("target.extension_rule_revision, target.created_at_epoch_millis, target.u"
                                + "pdated_at_epoch_millis, ")
                        + "target.notes, target.extension_values, "
                        + "target.project_id, target.project_code, target.project_name"));
    }

    @Test
    void overviewQueriesAcceptVoidedStatusForEverySupportedCategory() {
        var query = new OrganizationOverviewTaskReadService.Query(
                null, null, null, null, null, "VOIDED", null, null, null, null, "UPDATED_AT", "DESC");

        for (String category : List.of("HIERARCHY", "BUSINESS_ENTITY", "STORE")) {
            assertEquals("VOIDED", query.validated(category).status(), category);
        }
    }
}
