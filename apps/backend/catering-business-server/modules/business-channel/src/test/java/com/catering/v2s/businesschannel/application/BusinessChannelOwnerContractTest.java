package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

class BusinessChannelOwnerContractTest {
    @Test
    void readbackDoesNotExposeAdapterSecretsOrOpaqueAuthorizationValues() {
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "authorizationRef"));
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "externalOwnerId"));
        assertFalse(hasRecordComponent(BusinessChannelReadback.Channel.class, "token"));
    }

    @Test
    void nullableChannelCodeIsReturnedExactly() {
        // Legacy rows may still have no code; new commands require a user-entered immutable code.
        BusinessChannelReadback.Channel withoutCode = channel(null);
        BusinessChannelReadback.Channel withCode = channel("  keep-me  ");
        assertNull(withoutCode.channelCode());
        assertEquals("  keep-me  ", withCode.channelCode());
    }

    @Test
    void staleOperationsContextIsRejectedBeforeReceiptReplayOrWrite() {
        UUID workspace = UUID.randomUUID();
        UUID project = UUID.randomUUID();
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        BusinessChannelOwnerService service = new BusinessChannelOwnerService(
                mock(JdbcTemplate.class),
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CollaborationCatalogReadApi.class),
                mock(CollaborationBindingReadApi.class),
                mock(WorkspaceStatusLookup.class),
                receipts,
                mock(OrganizationOwnerApi.class),
                mock(OrganizationTaskPathLookup.class));
        OperationsOwnerScopeGrant staleGrant = new OperationsOwnerScopeGrant(
                workspace,
                "workspace-key",
                "REQ_CREATE_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE",
                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                "PROJECT",
                project,
                "PROJECT",
                project,
                List.of(),
                42L);
        BusinessChannelCommandApi.CreateTemplateCommand command = new BusinessChannelCommandApi.CreateTemplateCommand(
                workspace,
                "workspace-key",
                project,
                "Internal takeaway",
                "INTERNAL_TAKEAWAY",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                null,
                null,
                List.of(),
                41L,
                "business-channel-stale-01",
                AuditActor.system(),
                staleGrant);

        BusinessChannelCommandApi.Problem problem = org.junit.jupiter.api.Assertions.assertThrows(
                BusinessChannelCommandApi.Problem.class, () -> service.createTemplate(command));
        assertEquals("AUTHORIZATION_REQUIRED", problem.code());
        verifyNoInteractions(receipts);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void templateStatusUsesTheLockedRowForAuthorizationAndReadback() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID project = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        ResultSet lockedRow = templateRow(templateRef, project, "ENABLED", 4L);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSetExtractor extractor = invocation.getArgument(2);
                    if (sql.contains("WITH RECURSIVE")) {
                        return extractor.extractData(ancestorRows(new Object[][] {}));
                    }
                    return extractor.extractData(lockedRow);
                });
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        when(receipts.execute(
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        eq(BusinessChannelReadback.Template.class),
                        any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(6)).get());

        BusinessChannelReadback.Template result = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CollaborationCatalogReadApi.class),
                        mock(CollaborationBindingReadApi.class),
                        mock(WorkspaceStatusLookup.class),
                        receipts,
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .transitionTemplateStatus(new BusinessChannelCommandApi.TransitionTemplateStatusCommand(
                        workspace,
                        "workspace-key",
                        templateRef,
                        BusinessChannelPolicy.DISABLED,
                        4L,
                        9L,
                        "transition-template-focused-01",
                        AuditActor.system(),
                        grant(
                                workspace,
                                "workspace-key",
                                "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS",
                                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                                "PROJECT",
                                project,
                                9L)));

        assertEquals(templateRef, result.templateRef());
        assertEquals(project, result.projectRef());
        assertEquals("Template", result.templateName());
        assertEquals("INTERNAL", result.accessKind());
        assertEquals("PROJECT", result.operatorKind());
        assertEquals("TAKEAWAY", result.orderKind());
        assertEquals("DISABLED", result.status());
        assertEquals(5L, result.version());
        verify(jdbc, times(2)).query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void templateStatusRejectsAGrantWhenTheLockedTemplateTargetDiffers() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID grantedProject = UUID.randomUUID();
        UUID actualProject = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        ResultSet lockedRow = templateRow(templateRef, actualProject, "ENABLED", 4L);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSetExtractor extractor = invocation.getArgument(2);
                    if (sql.contains("WITH RECURSIVE")) {
                        return extractor.extractData(ancestorRows(new Object[][] {}));
                    }
                    return extractor.extractData(lockedRow);
                });
        when(receipts.execute(
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        eq(BusinessChannelReadback.Template.class),
                        any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(6)).get());

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> new BusinessChannelOwnerService(
                                jdbc,
                                (TimeProvider) () -> 1_785_000_000_000L,
                                mock(CollaborationCatalogReadApi.class),
                                mock(CollaborationBindingReadApi.class),
                                mock(WorkspaceStatusLookup.class),
                                receipts,
                                mock(OrganizationOwnerApi.class),
                                mock(OrganizationTaskPathLookup.class))
                        .transitionTemplateStatus(new BusinessChannelCommandApi.TransitionTemplateStatusCommand(
                                workspace,
                                "workspace-key",
                                templateRef,
                                BusinessChannelPolicy.DISABLED,
                                4L,
                                9L,
                                "transition-template-focused-02",
                                AuditActor.system(),
                                grant(
                                        workspace,
                                        "workspace-key",
                                        "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_TEMPLATE_STATUS",
                                        "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                                        "PROJECT",
                                        grantedProject,
                                        9L))));

        assertEquals("AUTHORIZATION_REQUIRED", problem.code());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void channelStatusUsesTheLockedJoinedRowForAuthorizationAndReadback() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID ownerNode = UUID.randomUUID();
        UUID channelRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        ResultSet lockedRow = commandChannelRow(channelRef, ownerNode, BusinessChannelPolicy.ENABLED, 7L);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSetExtractor extractor = invocation.getArgument(2);
                    if (sql.contains("WITH RECURSIVE")) {
                        return extractor.extractData(ancestorRows(new Object[][] {}));
                    }
                    return extractor.extractData(lockedRow);
                });
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        when(receipts.execute(
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        eq(BusinessChannelReadback.Channel.class),
                        any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(6)).get());

        BusinessChannelReadback.Channel result = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CollaborationCatalogReadApi.class),
                        mock(CollaborationBindingReadApi.class),
                        mock(WorkspaceStatusLookup.class),
                        receipts,
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .transitionChannelStatus(new BusinessChannelCommandApi.TransitionChannelStatusCommand(
                        workspace,
                        "workspace-key",
                        channelRef,
                        BusinessChannelPolicy.DISABLED,
                        7L,
                        11L,
                        "transition-channel-focused-01",
                        AuditActor.system(),
                        grant(
                                workspace,
                                "workspace-key",
                                "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS",
                                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                                "PROJECT",
                                ownerNode,
                                11L)));

        assertEquals(channelRef, result.channelRef());
        assertEquals(ownerNode.toString(), result.ownerNodeRef());
        assertEquals("Channel", result.channelName());
        assertEquals("DISABLED", result.status());
        assertEquals(1, result.statusDimensions().size());
        assertEquals(
                "BUSINESS_CHANNEL_TEMPLATE", result.statusDimensions().get(0).type());
        assertEquals("ENABLED", result.statusDimensions().get(0).status());
        assertEquals(List.of(), result.blockers());
        assertEquals(8L, result.version());
        verify(jdbc, times(2)).query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void channelStatusAllowsReenableAfterUpstreamStatusChanges() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID ownerNode = UUID.randomUUID();
        UUID channelRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        ResultSet lockedRow = commandChannelRow(channelRef, ownerNode, BusinessChannelPolicy.DISABLED, 7L);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSetExtractor extractor = invocation.getArgument(2);
                    if (sql.contains("WITH RECURSIVE")) {
                        return extractor.extractData(ancestorRows(new Object[][] {}));
                    }
                    return extractor.extractData(lockedRow);
                });
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        when(receipts.execute(
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        eq(BusinessChannelReadback.Channel.class),
                        any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(6)).get());

        BusinessChannelReadback.Channel result = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CollaborationCatalogReadApi.class),
                        mock(CollaborationBindingReadApi.class),
                        mock(WorkspaceStatusLookup.class),
                        receipts,
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .transitionChannelStatus(new BusinessChannelCommandApi.TransitionChannelStatusCommand(
                        workspace,
                        "workspace-key",
                        channelRef,
                        BusinessChannelPolicy.ENABLED,
                        7L,
                        11L,
                        "transition-channel-reenable-focused-01",
                        AuditActor.system(),
                        grant(
                                workspace,
                                "workspace-key",
                                "REQ_TRANSITION_OPERATIONS_BUSINESS_CHANNEL_STATUS",
                                "BC-BUSINESS-CHANNEL-PROJECT-EDIT",
                                "PROJECT",
                                ownerNode,
                                11L)));

        assertEquals(BusinessChannelPolicy.ENABLED, result.status());
        assertEquals(8L, result.version());
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void detachBindingClearsOnlyBindingAndPreservesTheChannelStatus() throws Exception {
        UUID workspace = UUID.randomUUID();
        UUID ownerNode = UUID.randomUUID();
        UUID channelRef = UUID.randomUUID();
        UUID bindingRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        BusinessChannelCommandReceiptService receipts = mock(BusinessChannelCommandReceiptService.class);
        ResultSet lockedRow = commandChannelRow(channelRef, ownerNode, BusinessChannelPolicy.ENABLED, 7L);
        when(lockedRow.getObject("binding_ref", UUID.class)).thenReturn(bindingRef);
        ResultSet readbackRow = commandChannelRow(channelRef, ownerNode, BusinessChannelPolicy.ENABLED, 8L);
        when(readbackRow.getObject("binding_ref", UUID.class)).thenReturn(null);
        int[] channelReadCount = {0};
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    ResultSetExtractor extractor = invocation.getArgument(2, ResultSetExtractor.class);
                    if (sql.contains("WITH RECURSIVE")) {
                        return extractor.extractData(ancestorRows(new Object[][] {}));
                    }
                    return extractor.extractData(channelReadCount[0]++ == 0 ? lockedRow : readbackRow);
                });
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        when(receipts.execute(
                        any(UUID.class),
                        anyString(),
                        anyString(),
                        anyString(),
                        anyString(),
                        eq(BusinessChannelReadback.Channel.class),
                        any(Supplier.class)))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(6)).get());

        BusinessChannelReadback.Channel result = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CollaborationCatalogReadApi.class),
                        mock(CollaborationBindingReadApi.class),
                        mock(WorkspaceStatusLookup.class),
                        receipts,
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .detachChannelBinding(
                        new BusinessChannelCommandApi.DetachChannelBindingCommand(
                                workspace,
                                "workspace-key",
                                channelRef,
                                7L,
                                "detach-binding-focused-01",
                                AuditActor.system()),
                        7L);

        assertEquals(BusinessChannelPolicy.ENABLED, result.status());
        assertNull(result.bindingRef());
        assertEquals(8L, result.version());
        ArgumentCaptor<String> updates = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(updates.capture(), any(Object[].class));
        String detachSql = updates.getAllValues().stream()
                .filter(value -> value.contains("UPDATE business_channel.business_channel SET binding_ref=null"))
                .findFirst()
                .orElseThrow();
        assertFalse(detachSql.toLowerCase(java.util.Locale.ROOT).contains("status"));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void channelReadbackCarriesTheCompleteIndependentStatusDimensionSet() throws Exception {
        UUID workspace = UUID.randomUUID();
        String groupWorkspaceKey = "workspace-key";
        UUID channelRef = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        UUID templateProjectRef = UUID.randomUUID();
        UUID targetStoreRef = UUID.randomUUID();
        UUID targetStoreProjectRef = UUID.randomUUID();
        UUID tenantRef = UUID.randomUUID();
        UUID brandRef = UUID.randomUUID();
        UUID bindingRef = UUID.randomUUID();
        UUID templateAncestorRegionRef = UUID.randomUUID();
        UUID templateAncestorProjectRef = UUID.randomUUID();
        UUID targetAncestorRegionRef = UUID.randomUUID();
        UUID targetAncestorProjectRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceStatusLookup workspaceStatuses = mock(WorkspaceStatusLookup.class);
        CollaborationCatalogReadApi collaboration = mock(CollaborationCatalogReadApi.class);
        when(workspaceStatuses.requireStatus(workspace, groupWorkspaceKey)).thenReturn("DISABLED");
        when(collaboration.readTree(workspace, groupWorkspaceKey))
                .thenReturn(new CollaborationReadback.Tree(
                        List.of(externalSystem("SYSTEM-A", "ENABLED")),
                        List.of(providerProfile("PROVIDER-A", "SYSTEM-A", "DISABLED"))));
        ResultSet row = completeChannelRow(
                workspace,
                groupWorkspaceKey,
                channelRef,
                templateRef,
                templateProjectRef,
                targetStoreRef,
                targetStoreProjectRef,
                tenantRef,
                brandRef,
                bindingRef,
                templateAncestorRegionRef,
                templateAncestorProjectRef);
        int[] recursiveQueryCount = {0};
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(2, RowMapper.class);
                    return List.of(mapper.mapRow(row, 0));
                });
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    assertAncestrySqlUsesRootFirstOrder(sql);
                    recursiveQueryCount[0]++;
                    ResultSetExtractor extractor = invocation.getArgument(2, ResultSetExtractor.class);
                    return extractor.extractData(ancestorRows(new Object[][] {
                        {templateProjectRef, templateAncestorRegionRef, "REGION", "DISABLED"},
                        {templateProjectRef, templateAncestorProjectRef, "PROJECT", "ENABLED"},
                        {targetStoreProjectRef, targetAncestorRegionRef, "REGION", "DISABLED"},
                        {targetStoreProjectRef, targetAncestorProjectRef, "PROJECT", "ENABLED"}
                    }));
                });

        BusinessChannelReadback.ChannelPage result = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        collaboration,
                        mock(CollaborationBindingReadApi.class),
                        workspaceStatuses,
                        mock(BusinessChannelCommandReceiptService.class),
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .pageChannels(workspace, groupWorkspaceKey, "STORE", targetStoreRef.toString(), null, null, null);
        assertEquals(1, recursiveQueryCount[0]);

        BusinessChannelReadback.Channel channel = result.items().get(0);
        assertEquals(
                List.of(
                        new BusinessChannelReadback.StatusDimension("GROUP_WORKSPACE", groupWorkspaceKey, "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", templateAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateAncestorProjectRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_STORE", targetStoreRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", targetStoreProjectRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", targetAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", targetAncestorProjectRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_TENANT", tenantRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_BRAND", brandRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "COLLABORATION_BINDING", bindingRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "COLLABORATION_PROVIDER_PROFILE", "PROVIDER-A", "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "COLLABORATION_EXTERNAL_SYSTEM", "SYSTEM-A", "ENABLED")),
                channel.statusDimensions());
        assertEquals(
                List.of(
                        new BusinessChannelReadback.StatusDimension("GROUP_WORKSPACE", groupWorkspaceKey, "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", templateAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_STORE", targetStoreRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", targetAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_TENANT", tenantRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "COLLABORATION_PROVIDER_PROFILE", "PROVIDER-A", "DISABLED")),
                channel.blockers());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void projectChannelReadbackCarriesTargetProjectAndAncestorDimensions() throws Exception {
        UUID workspace = UUID.randomUUID();
        String groupWorkspaceKey = "workspace-key";
        UUID channelRef = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        UUID templateProjectRef = UUID.randomUUID();
        UUID targetProjectRef = UUID.randomUUID();
        UUID templateAncestorRegionRef = UUID.randomUUID();
        UUID templateAncestorProjectRef = UUID.randomUUID();
        UUID targetAncestorRegionRef = UUID.randomUUID();
        UUID targetAncestorProjectRef = UUID.randomUUID();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceStatusLookup workspaceStatuses = mock(WorkspaceStatusLookup.class);
        when(workspaceStatuses.requireStatus(workspace, groupWorkspaceKey)).thenReturn("DISABLED");
        ResultSet row = completeChannelRow(
                workspace,
                groupWorkspaceKey,
                channelRef,
                templateRef,
                templateProjectRef,
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                templateAncestorRegionRef,
                templateAncestorProjectRef);
        when(row.getString("target_node_type")).thenReturn("PROJECT");
        when(row.getString("target_node_ref")).thenReturn(targetProjectRef.toString());
        when(row.getObject("target_project_ref", UUID.class)).thenReturn(targetProjectRef);
        when(row.getString("target_node_status")).thenReturn("DISABLED");
        when(row.getObject("target_store_project_ref", UUID.class)).thenReturn(null);
        when(row.getString("target_store_project_status")).thenReturn(null);
        when(row.getString("target_store_status")).thenReturn(null);
        when(row.getObject("target_tenant_ref", UUID.class)).thenReturn(null);
        when(row.getString("target_tenant_status")).thenReturn(null);
        when(row.getObject("target_brand_ref", UUID.class)).thenReturn(null);
        when(row.getString("target_brand_status")).thenReturn(null);
        when(row.getString("template_access_kind")).thenReturn("INTERNAL");
        when(row.getString("template_provider_code")).thenReturn(null);
        when(row.getObject("binding_ref", UUID.class)).thenReturn(null);
        when(row.getString("binding_lifecycle_status")).thenReturn(null);
        when(row.getString("provider_status")).thenReturn(null);
        int[] recursiveQueryCount = {0};
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    RowMapper mapper = invocation.getArgument(2, RowMapper.class);
                    return List.of(mapper.mapRow(row, 0));
                });
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    assertAncestrySqlUsesRootFirstOrder(sql);
                    recursiveQueryCount[0]++;
                    ResultSetExtractor extractor = invocation.getArgument(2, ResultSetExtractor.class);
                    return extractor.extractData(ancestorRows(new Object[][] {
                        {templateProjectRef, templateAncestorRegionRef, "REGION", "DISABLED"},
                        {templateProjectRef, templateAncestorProjectRef, "PROJECT", "ENABLED"},
                        {targetProjectRef, targetAncestorRegionRef, "REGION", "DISABLED"},
                        {targetProjectRef, targetAncestorProjectRef, "PROJECT", "ENABLED"}
                    }));
                });

        BusinessChannelReadback.Channel channel = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        mock(CollaborationCatalogReadApi.class),
                        mock(CollaborationBindingReadApi.class),
                        workspaceStatuses,
                        mock(BusinessChannelCommandReceiptService.class),
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .pageChannels(workspace, groupWorkspaceKey, "PROJECT", targetProjectRef.toString(), null, null, null)
                .items()
                .get(0);
        assertEquals(1, recursiveQueryCount[0]);

        assertEquals(
                List.of(
                        new BusinessChannelReadback.StatusDimension("GROUP_WORKSPACE", groupWorkspaceKey, "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", templateAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateAncestorProjectRef.toString(), "ENABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", targetProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", targetAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", targetAncestorProjectRef.toString(), "ENABLED")),
                channel.statusDimensions());
        assertEquals(
                List.of(
                        new BusinessChannelReadback.StatusDimension("GROUP_WORKSPACE", groupWorkspaceKey, "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", templateProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", templateAncestorRegionRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_PROJECT", targetProjectRef.toString(), "DISABLED"),
                        new BusinessChannelReadback.StatusDimension(
                                "ORGANIZATION_REGION", targetAncestorRegionRef.toString(), "DISABLED")),
                channel.blockers());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void collectionStatusFactsAreLoadedOnceForDuplicateChannelRows() throws Exception {
        UUID workspace = UUID.randomUUID();
        String groupWorkspaceKey = "workspace-key";
        UUID templateRef = UUID.randomUUID();
        UUID templateProjectRef = UUID.randomUUID();
        UUID targetStoreRef = UUID.randomUUID();
        UUID targetStoreProjectRef = UUID.randomUUID();
        UUID tenantRef = UUID.randomUUID();
        UUID brandRef = UUID.randomUUID();
        UUID bindingRef = UUID.randomUUID();
        UUID templateAncestorRef = UUID.randomUUID();
        UUID targetAncestorRef = UUID.randomUUID();
        ResultSet first = completeChannelRow(
                workspace,
                groupWorkspaceKey,
                UUID.randomUUID(),
                templateRef,
                templateProjectRef,
                targetStoreRef,
                targetStoreProjectRef,
                tenantRef,
                brandRef,
                bindingRef,
                UUID.randomUUID(),
                UUID.randomUUID());
        ResultSet second = completeChannelRow(
                workspace,
                groupWorkspaceKey,
                UUID.randomUUID(),
                templateRef,
                templateProjectRef,
                targetStoreRef,
                targetStoreProjectRef,
                tenantRef,
                brandRef,
                bindingRef,
                UUID.randomUUID(),
                UUID.randomUUID());
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        WorkspaceStatusLookup workspaceStatuses = mock(WorkspaceStatusLookup.class);
        CollaborationCatalogReadApi collaboration = mock(CollaborationCatalogReadApi.class);
        when(workspaceStatuses.requireStatus(workspace, groupWorkspaceKey)).thenReturn("ENABLED");
        when(collaboration.readTree(workspace, groupWorkspaceKey))
                .thenReturn(new CollaborationReadback.Tree(
                        List.of(externalSystem("SYSTEM-A", "ENABLED")),
                        List.of(providerProfile("PROVIDER-A", "SYSTEM-A", "DISABLED"))));
        int[] recursiveQueryCount = {0};
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2, RowMapper.class);
                    return List.of(mapper.mapRow(first, 0), mapper.mapRow(second, 1));
                });
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class)))
                .thenAnswer(invocation -> {
                    String sql = invocation.getArgument(0, String.class);
                    assertAncestrySqlUsesRootFirstOrder(sql);
                    recursiveQueryCount[0]++;
                    ResultSetExtractor extractor = invocation.getArgument(2, ResultSetExtractor.class);
                    return extractor.extractData(ancestorRows(new Object[][] {
                        {templateProjectRef, templateAncestorRef, "REGION", "ENABLED"},
                        {targetStoreProjectRef, targetAncestorRef, "REGION", "DISABLED"}
                    }));
                });

        BusinessChannelReadback.ChannelPage page = new BusinessChannelOwnerService(
                        jdbc,
                        (TimeProvider) () -> 1_785_000_000_000L,
                        collaboration,
                        mock(CollaborationBindingReadApi.class),
                        workspaceStatuses,
                        mock(BusinessChannelCommandReceiptService.class),
                        mock(OrganizationOwnerApi.class),
                        mock(OrganizationTaskPathLookup.class))
                .pageChannels(workspace, groupWorkspaceKey, "STORE", targetStoreRef.toString(), null, null, null);

        assertEquals(2, page.items().size());
        assertEquals(1, recursiveQueryCount[0]);
        verify(workspaceStatuses, times(1)).requireStatus(workspace, groupWorkspaceKey);
        verify(collaboration, times(1)).readTree(workspace, groupWorkspaceKey);
        verify(collaboration, never()).readProviderProfile(any(UUID.class), anyString(), anyString());
        verify(collaboration, never()).readExternalSystem(any(UUID.class), anyString(), anyString());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadReturnsTheExactSetAndIgnoresRequestPageSize() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        List<UUID> refs = List.of(UUID.randomUUID(), UUID.randomUUID());
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < refs.size(); index++) {
                        rows.add(mapper.mapRow(channelRow(refs.get(index)), index));
                    }
                    return rows;
                });

        BusinessChannelReadback.ChannelPage page = readService(jdbc)
                .pageChannels(
                        UUID.randomUUID(),
                        "workspace-key",
                        "PROJECT",
                        UUID.randomUUID().toString(),
                        null,
                        null,
                        null);

        assertEquals(
                refs,
                page.items().stream()
                        .map(BusinessChannelReadback.Channel::channelRef)
                        .toList());
        assertEquals("NOT_REQUIRED", page.items().get(0).bindingStatus());
        assertNull(page.nextCursor());
        assertEquals(refs.size(), page.total());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<PreparedStatementSetter> setter = ArgumentCaptor.forClass(PreparedStatementSetter.class);
        verify(jdbc).query(sql.capture(), setter.capture(), any(RowMapper.class));
        assertFalse(sql.getValue().contains("COUNT(*)"));
        assertFalse(sql.getValue().contains("channel_ref > ?"));
        PreparedStatement statement = mock(PreparedStatement.class);
        setter.getValue().setValues(statement);
        verify(statement).setObject(5, BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadRejectsOverflowInsteadOfSilentlyTruncating() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1; index++) {
                        rows.add(mapper.mapRow(channelRow(UUID.randomUUID()), index));
                    }
                    return rows;
                });

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageChannels(
                                UUID.randomUUID(),
                                "workspace-key",
                                "STORE",
                                UUID.randomUUID().toString(),
                                null,
                                null,
                                null));

        assertEquals("PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION", problem.code());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedTemplateReadUsesTheSameFixedSourceLimit() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(templateRow(UUID.randomUUID()), 0));
                });

        BusinessChannelReadback.TemplatePage page = readService(jdbc)
                .pageTemplates(UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, null, null);

        assertEquals(1, page.items().size());
        assertNull(page.nextCursor());
        assertEquals(1, page.total());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedTemplateReadRejectsOverflowInsteadOfReturningAPartialSet() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    List<Object> rows = new ArrayList<>();
                    for (int index = 0; index < BusinessChannelOwnerService.BOUNDED_READ_LIMIT + 1; index++) {
                        rows.add(mapper.mapRow(templateRow(UUID.randomUUID()), index));
                    }
                    return rows;
                });

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageTemplates(UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, null, null));

        assertEquals("PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION", problem.code());
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void boundedChannelReadUsesTheRequestedColumnAndDirection() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(PreparedStatementSetter.class), any(RowMapper.class)))
                .thenAnswer(invocation -> {
                    RowMapper mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(channelRow(UUID.randomUUID()), 0));
                });

        readService(jdbc)
                .pageChannels(
                        UUID.randomUUID(),
                        "workspace-key",
                        "PROJECT",
                        UUID.randomUUID().toString(),
                        null,
                        "CHANNEL_NAME",
                        "DESC");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(PreparedStatementSetter.class), any(RowMapper.class));
        assertTrue(sql.getValue().contains("ORDER BY c.channel_name DESC, c.channel_ref"));
    }

    @Test
    void boundedReadRejectsUnsupportedSortKeyBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageTemplates(
                                UUID.randomUUID(), "workspace-key", UUID.randomUUID(), null, null, "UNKNOWN", "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void boundedReadRejectsDirectionWithoutAColumnBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageChannels(
                                UUID.randomUUID(),
                                "workspace-key",
                                "PROJECT",
                                UUID.randomUUID().toString(),
                                null,
                                null,
                                "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    @Test
    void storeTemplateCandidateReadRejectsUnsupportedSortBeforeQuerying() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        BusinessChannelCommandApi.Problem problem =
                assertThrows(BusinessChannelCommandApi.Problem.class, () -> readService(jdbc)
                        .pageStoreTemplateCandidates(
                                UUID.randomUUID(),
                                "workspace-key",
                                UUID.randomUUID(),
                                UUID.randomUUID().toString(),
                                null,
                                50,
                                "UNKNOWN",
                                "ASC"));

        assertEquals("VALIDATION_ERROR", problem.code());
        verifyNoInteractions(jdbc);
    }

    private static BusinessChannelOwnerService readService(JdbcTemplate jdbc) {
        return new BusinessChannelOwnerService(
                jdbc,
                (TimeProvider) () -> 1_785_000_000_000L,
                mock(CollaborationCatalogReadApi.class),
                mock(CollaborationBindingReadApi.class),
                mock(WorkspaceStatusLookup.class),
                mock(BusinessChannelCommandReceiptService.class),
                mock(OrganizationOwnerApi.class),
                mock(OrganizationTaskPathLookup.class));
    }

    private static ResultSet channelRow(UUID channelRef) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.next()).thenReturn(true);
        when(row.getObject("channel_ref", UUID.class)).thenReturn(channelRef);
        when(row.getObject("template_ref", UUID.class)).thenReturn(UUID.randomUUID());
        when(row.getString("target_node_type")).thenReturn("PROJECT");
        when(row.getString("target_node_ref")).thenReturn(UUID.randomUUID().toString());
        when(row.getString("channel_code")).thenReturn("CHANNEL-CODE");
        when(row.getString("channel_name")).thenReturn("Channel");
        when(row.getObject("binding_ref", UUID.class)).thenReturn(null);
        when(row.getString("template_access_kind")).thenReturn("INTERNAL");
        when(row.getString("status")).thenReturn(BusinessChannelPolicy.ENABLED);
        when(row.getLong("version")).thenReturn(1L);
        return row;
    }

    private static ResultSet templateRow(UUID templateRef) throws Exception {
        return templateRow(templateRef, UUID.randomUUID(), "ENABLED", 1L);
    }

    private static ResultSet templateRow(UUID templateRef, UUID projectRef, String status, long version)
            throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.next()).thenReturn(true);
        when(row.getObject("template_ref", UUID.class)).thenReturn(templateRef);
        when(row.getObject("project_ref", UUID.class)).thenReturn(projectRef);
        when(row.getString("template_name")).thenReturn("Template");
        when(row.getString("access_kind")).thenReturn("INTERNAL");
        when(row.getString("operator_kind")).thenReturn("PROJECT");
        when(row.getString("order_kind")).thenReturn("TAKEAWAY");
        when(row.getString("dine_in_form")).thenReturn(null);
        when(row.getString("provider_code")).thenReturn(null);
        when(row.getString("status")).thenReturn(status);
        when(row.getLong("version")).thenReturn(version);
        return row;
    }

    private static ResultSet commandChannelRow(UUID channelRef, UUID ownerNode, String status, long version)
            throws Exception {
        ResultSet row = channelRow(channelRef);
        when(row.getString("target_node_ref")).thenReturn(ownerNode.toString());
        when(row.getString("status")).thenReturn(status);
        when(row.getLong("version")).thenReturn(version);
        when(row.getObject("template_project_ref", UUID.class)).thenReturn(UUID.randomUUID());
        when(row.getString("template_name")).thenReturn("Template");
        when(row.getString("template_code")).thenReturn("INTERNAL_TAKEAWAY");
        when(row.getString("template_operator_kind")).thenReturn("PROJECT");
        when(row.getString("template_order_kind")).thenReturn("TAKEAWAY");
        when(row.getString("template_dine_in_form")).thenReturn(null);
        when(row.getString("template_provider_code")).thenReturn(null);
        when(row.getString("template_status")).thenReturn("ENABLED");
        when(row.getLong("template_version")).thenReturn(2L);
        return row;
    }

    private static ResultSet completeChannelRow(
            UUID workspace,
            String groupWorkspaceKey,
            UUID channelRef,
            UUID templateRef,
            UUID templateProjectRef,
            UUID targetStoreRef,
            UUID targetStoreProjectRef,
            UUID tenantRef,
            UUID brandRef,
            UUID bindingRef,
            UUID ancestorRegionRef,
            UUID ancestorProjectRef)
            throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("workspace_uuid", UUID.class)).thenReturn(workspace);
        when(row.getString("group_workspace_key")).thenReturn(groupWorkspaceKey);
        when(row.getObject("channel_ref", UUID.class)).thenReturn(channelRef);
        when(row.getObject("template_ref", UUID.class)).thenReturn(templateRef);
        when(row.getString("target_node_type")).thenReturn("STORE");
        when(row.getString("target_node_ref")).thenReturn(targetStoreRef.toString());
        when(row.getString("channel_code")).thenReturn("CHANNEL-CODE");
        when(row.getString("channel_name")).thenReturn("Channel");
        when(row.getObject("binding_ref", UUID.class)).thenReturn(bindingRef);
        when(row.getString("template_access_kind")).thenReturn("EXTERNAL");
        when(row.getString("status")).thenReturn("ENABLED");
        when(row.getLong("version")).thenReturn(1L);
        when(row.getObject("template_project_ref", UUID.class)).thenReturn(templateProjectRef);
        when(row.getString("template_name")).thenReturn("Template");
        when(row.getString("template_code")).thenReturn("TEMPLATE-CODE");
        when(row.getString("template_operator_kind")).thenReturn("STORE");
        when(row.getString("template_order_kind")).thenReturn("TAKEAWAY");
        when(row.getString("template_dine_in_form")).thenReturn(null);
        when(row.getString("template_provider_code")).thenReturn("PROVIDER-A");
        when(row.getString("template_status")).thenReturn("ENABLED");
        when(row.getLong("template_version")).thenReturn(1L);
        when(row.getString("template_project_status")).thenReturn("DISABLED");
        when(row.getObject("target_project_ref", UUID.class)).thenReturn(null);
        when(row.getString("target_node_status")).thenReturn("DISABLED");
        when(row.getObject("target_store_project_ref", UUID.class)).thenReturn(targetStoreProjectRef);
        when(row.getString("target_store_project_status")).thenReturn("ENABLED");
        when(row.getString("target_store_status")).thenReturn("DISABLED");
        when(row.getObject("target_tenant_ref", UUID.class)).thenReturn(tenantRef);
        when(row.getString("target_tenant_status")).thenReturn("DISABLED");
        when(row.getObject("target_brand_ref", UUID.class)).thenReturn(brandRef);
        when(row.getString("target_brand_status")).thenReturn("ENABLED");
        when(row.getString("binding_lifecycle_status")).thenReturn("DISABLED");
        when(row.getString("provider_status")).thenReturn("DISABLED");
        return row;
    }

    private static ResultSet ancestorRows(Object[][] rows) throws Exception {
        ResultSet result = mock(ResultSet.class);
        int[] index = {-1};
        when(result.next()).thenAnswer(invocation -> ++index[0] < rows.length);
        when(result.getObject("source_ref", UUID.class)).thenAnswer(invocation -> rows[index[0]][0]);
        when(result.getString("node_type")).thenAnswer(invocation -> rows[index[0]][2]);
        when(result.getObject("id", UUID.class)).thenAnswer(invocation -> rows[index[0]][1]);
        when(result.getString("status")).thenAnswer(invocation -> rows[index[0]][3]);
        return result;
    }

    private static CollaborationReadback.ProviderProfile providerProfile(
            String providerCode, String externalSystemCode, String status) {
        return new CollaborationReadback.ProviderProfile(
                providerCode,
                "Provider " + providerCode,
                externalSystemCode,
                "System " + externalSystemCode,
                List.of(),
                List.of(),
                "OAUTH",
                "WEBHOOK",
                "PLANNED",
                status,
                1L);
    }

    private static CollaborationReadback.ExternalSystem externalSystem(String externalSystemCode, String status) {
        return new CollaborationReadback.ExternalSystem(
                externalSystemCode, "System " + externalSystemCode, "ENABLED", List.of(), status, 1L);
    }

    private static void assertAncestrySqlUsesRootFirstOrder(String sql) {
        String normalized = sql.replaceAll("\\s+", " ");
        assertTrue(normalized.contains("0 AS depth"));
        assertTrue(normalized.contains("child.depth+1"));
        assertTrue(normalized.contains("ORDER BY source_ref, depth DESC"));
    }

    private static OperationsOwnerScopeGrant grant(
            UUID workspace,
            String groupWorkspaceKey,
            String requirement,
            String capability,
            String targetType,
            UUID targetId,
            long contextVersion) {
        return new OperationsOwnerScopeGrant(
                workspace,
                groupWorkspaceKey,
                requirement,
                capability,
                targetType,
                targetId,
                targetType,
                targetId,
                List.of(),
                contextVersion);
    }

    private static BusinessChannelReadback.Channel channel(String channelCode) {
        return new BusinessChannelReadback.Channel(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "PROJECT",
                UUID.randomUUID().toString(),
                channelCode,
                "Channel",
                null,
                "NOT_REQUIRED",
                BusinessChannelPolicy.ENABLED,
                List.of(),
                List.of(),
                1);
    }

    private static boolean hasRecordComponent(Class<?> type, String name) {
        return java.util.Arrays.stream(type.getRecordComponents())
                .anyMatch(component -> component.getName().equals(name));
    }
}
