package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationEntityReadback;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.api.OrganizationNodeReadback;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class OperationsOrganizationTaskReadServiceTest {
    @Test
    void springWiresTheFullHierarchyTaskReaderConstructor() {
        var constructors = java.util.Arrays.stream(OperationsOrganizationTaskReadService.class.getDeclaredConstructors())
            .filter(constructor -> constructor.isAnnotationPresent(Autowired.class))
            .toList();

        assertEquals(1, constructors.size());
        assertArrayEquals(new Class<?>[] {
            BusinessEntityService.class,
            OrganizationOverviewTaskReadService.class,
            OrganizationHierarchyService.class,
            OrganizationCommandService.class
        }, constructors.get(0).getParameterTypes());
    }

    @Test
    void operationsBusinessEntityReadsUseFixedOwnerTypeMethods() {
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsOrganizationTaskReadService reads = new OperationsOrganizationTaskReadService(
            entities, mock(OrganizationOverviewTaskReadService.class)
        );
        UUID workspace = UUID.randomUUID();
        BusinessEntityService.EntityPage expected = new BusinessEntityService.EntityPage(List.of(), 0L, 1, 20);
        when(entities.pageEntities("TENANT", workspace, "organization-task-read", "tenant", "TN", null, null, "ENABLED", "NAME", "ASC", 1, 20))
            .thenReturn(expected);

        assertSame(expected, reads.tenants(workspace, "organization-task-read", "tenant", "TN", null, null, "ENABLED", "NAME", "ASC", 1, 20));

        verify(entities).pageEntities("TENANT", workspace, "organization-task-read", "tenant", "TN", null, null, "ENABLED", "NAME", "ASC", 1, 20);
    }

    @Test
    void headCompanyReadKeepsTheFollowUpBrandFactInsideTheTypedBoundary() {
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsOrganizationTaskReadService reads = new OperationsOrganizationTaskReadService(
            entities, mock(OrganizationOverviewTaskReadService.class)
        );
        UUID workspace = UUID.randomUUID();
        UUID headCompany = UUID.randomUUID();
        OrganizationEntityReadback entity = new OrganizationEntityReadback(headCompany, "HEAD_COMPANY", workspace,
            "organization-task-read", "HQ", "Head company", null, null, "ENABLED", 1L,
            null, null, null, 0L, 1L, 1L, Map.of());
        when(entities.requireEntity("HEAD_COMPANY", workspace, "organization-task-read", headCompany)).thenReturn(entity);
        when(entities.authorizedBrands(workspace, "organization-task-read", headCompany)).thenReturn(List.of());

        OperationsOrganizationTaskReadService.HeadCompany actual = reads.headCompany(workspace, "organization-task-read", headCompany);

        assertSame(entity, actual.entity());
        verify(entities).requireEntity("HEAD_COMPANY", workspace, "organization-task-read", headCompany);
        verify(entities).authorizedBrands(workspace, "organization-task-read", headCompany);
    }

    @Test
    void hierarchySnapshotKeepsTheCommercialGroupAndNodeListInsideOneTypedBoundary() {
        OrganizationHierarchyService hierarchy = mock(OrganizationHierarchyService.class);
        OrganizationCommandService commercialGroups = mock(OrganizationCommandService.class);
        OperationsOrganizationTaskReadService reads = new OperationsOrganizationTaskReadService(
            mock(BusinessEntityService.class), mock(OrganizationOverviewTaskReadService.class), hierarchy, commercialGroups
        );
        UUID workspace = UUID.randomUUID();
        CommercialGroupReadback group = new CommercialGroupReadback(UUID.randomUUID(), "organization-task-read", "GRP", "Group", 1L, "platform", 1L, 1L, Map.of(), 0L);
        List<OrganizationNodeReadback> nodes = List.of();
        when(commercialGroups.requireCommercialGroup("organization-task-read")).thenReturn(group);
        when(hierarchy.list(workspace, "organization-task-read")).thenReturn(nodes);

        OperationsOrganizationTaskReadService.HierarchySnapshot actual = reads.hierarchy(workspace, "organization-task-read");

        assertSame(group, actual.commercialGroup());
        assertEquals(nodes, actual.nodes());
        verify(commercialGroups).requireCommercialGroup("organization-task-read");
        verify(hierarchy).list(workspace, "organization-task-read");
    }
}
