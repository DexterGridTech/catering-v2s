package com.catering.v2s.businesschannel.application;

import com.catering.v2s.businesschannel.application.persistence.BusinessChannelPersistence;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateChannelCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.CreateTemplateCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.DetachChannelBindingCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionChannelStatusCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.TransitionTemplateStatusCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateChannelCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi.UpdateTemplateCommand;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.catering.v2s.organization.api.OrganizationOwnerApi;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.workspace.WorkspaceStatusLookup;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Stable business-channel owner facade.
 *
 * <p>The public owner boundary remains unchanged while the implementation is divided by aggregate-owned method
 * families. Commands and ordinary reads delegate to their owning service; task-shaped reads delegate to the
 * task-read service.
 */
@Service
public class BusinessChannelOwnerService
        implements BusinessChannelOwnerApi, BusinessChannelCommandApi, BusinessChannelReadApi {
    static final int BOUNDED_READ_LIMIT = BusinessChannelPersistence.BOUNDED_READ_LIMIT;

    private final BusinessChannelTemplateService templateService;
    private final BusinessChannelService channelService;
    private final BusinessChannelTaskReadService taskReadService;

    @Autowired
    public BusinessChannelOwnerService(
            BusinessChannelTemplateService templateService,
            BusinessChannelService channelService,
            BusinessChannelTaskReadService taskReadService) {
        this.templateService = templateService;
        this.channelService = channelService;
        this.taskReadService = taskReadService;
    }

    /**
     * Compatibility constructor for focused tests and direct owner construction. Production wiring uses the three
     * aggregate/task services above.
     */
    public BusinessChannelOwnerService(
            JdbcTemplate jdbc,
            TimeProvider time,
            CollaborationCatalogReadApi collaborationCatalog,
            CollaborationBindingReadApi collaborationBindings,
            WorkspaceStatusLookup workspaceStatuses,
            BusinessChannelCommandReceiptService receipts,
            OrganizationOwnerApi organizationOwner,
            OrganizationTaskPathLookup organizationTaskPaths) {
        this(
                new BusinessChannelTemplateService(
                        jdbc,
                        time,
                        collaborationCatalog,
                        collaborationBindings,
                        workspaceStatuses,
                        receipts,
                        organizationOwner,
                        organizationTaskPaths),
                new BusinessChannelService(
                        jdbc,
                        time,
                        collaborationCatalog,
                        collaborationBindings,
                        workspaceStatuses,
                        receipts,
                        organizationOwner,
                        organizationTaskPaths),
                new BusinessChannelTaskReadService(
                        jdbc,
                        collaborationCatalog,
                        workspaceStatuses));
    }

    @Override
    public BusinessChannelReadback.TemplatePage pageTemplates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String status,
            String operatorKind,
            String sortKey,
            String sortDirection) {
        return templateService.pageTemplates(
                workspaceUuid, groupWorkspaceKey, projectRef, status, operatorKind, sortKey, sortDirection);
    }

    @Override
    public BusinessChannelReadback.TemplatePage pageStoreTemplateCandidates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection) {
        return templateService.pageStoreTemplateCandidates(
                workspaceUuid,
                groupWorkspaceKey,
                projectRef,
                storeRef,
                cursor,
                pageSize,
                sortKey,
                sortDirection);
    }

    @Override
    public BusinessChannelReadback.VisibleStorePage pageTemplateVisibleStores(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID templateRef,
            UUID projectRef,
            String storeStatusFilter,
            String cursor,
            int pageSize) {
        return templateService.pageTemplateVisibleStores(
                workspaceUuid,
                groupWorkspaceKey,
                templateRef,
                projectRef,
                storeStatusFilter,
                cursor,
                pageSize);
    }

    @Override
    public BusinessChannelReadback.ChannelPage pageChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String ownerNodeType,
            String ownerNodeRef,
            String status,
            String sortKey,
            String sortDirection) {
        return channelService.pageChannels(
                workspaceUuid, groupWorkspaceKey, ownerNodeType, ownerNodeRef, status, sortKey, sortDirection);
    }

    @Override
    public BusinessChannelReadback.Template readTemplate(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return templateService.readTemplate(workspaceUuid, groupWorkspaceKey, templateRef);
    }

    @Override
    public BusinessChannelReadback.Channel readChannel(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return channelService.readChannel(workspaceUuid, groupWorkspaceKey, channelRef);
    }

    @Override
    public BusinessChannelReadback.TemplateCommandContext readTemplateCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef) {
        return templateService.readTemplateCommandContext(workspaceUuid, groupWorkspaceKey, templateRef);
    }

    @Override
    public BusinessChannelReadback.ChannelCommandContext readChannelCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return channelService.readChannelCommandContext(workspaceUuid, groupWorkspaceKey, channelRef);
    }

    @Override
    public BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef) {
        return taskReadService.readChannelWithTemplateProvider(workspaceUuid, groupWorkspaceKey, channelRef);
    }

    @Override
    public List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef) {
        return taskReadService.findChannelsForBinding(workspaceUuid, groupWorkspaceKey, bindingRef);
    }

    @Override
    public BusinessChannelOwnerApi.SalesMenuEligibleChannelPage listSalesMenuEligibleChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection) {
        return taskReadService.listSalesMenuEligibleChannels(
                workspaceUuid, groupWorkspaceKey, storeRef, cursor, pageSize, sortKey, sortDirection);
    }

    @Override
    public BusinessChannelOwnerApi.SalesMenuChannelJudgment requireSalesMenuChannel(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        return taskReadService.requireSalesMenuChannel(workspaceUuid, groupWorkspaceKey, storeRef, channelRef);
    }

    @Override
    public boolean salesMenuChannelBelongsToStore(
            UUID workspaceUuid, String groupWorkspaceKey, String storeRef, UUID channelRef) {
        return taskReadService.salesMenuChannelBelongsToStore(workspaceUuid, groupWorkspaceKey, storeRef, channelRef);
    }

    @Override
    public BusinessChannelReadback.Template createTemplate(CreateTemplateCommand command) {
        return templateService.createTemplate(command);
    }

    @Override
    public BusinessChannelReadback.Template updateTemplate(UpdateTemplateCommand command) {
        return templateService.updateTemplate(command);
    }

    @Override
    public BusinessChannelReadback.Template transitionTemplateStatus(TransitionTemplateStatusCommand command) {
        return templateService.transitionTemplateStatus(command);
    }

    @Override
    public BusinessChannelReadback.Channel createChannel(CreateChannelCommand command) {
        return channelService.createChannel(command);
    }

    @Override
    public BusinessChannelReadback.Channel updateChannel(UpdateChannelCommand command) {
        return channelService.updateChannel(command);
    }

    @Override
    public BusinessChannelReadback.Channel transitionChannelStatus(TransitionChannelStatusCommand command) {
        return channelService.transitionChannelStatus(command);
    }

    @Override
    public BusinessChannelReadback.Channel detachChannelBinding(
            DetachChannelBindingCommand command, long expectedVersion) {
        return channelService.detachChannelBinding(command, expectedVersion);
    }

}
