package com.catering.v2s.generated.operationbindings;

/**
 * Generated compile-time support types for operation-handler-bindings.json.
 * These marker/context and wire aliases are intentionally closed: runtime
 * adapters are supplied by the owning module in the implementation phase.
 */
public final class OperationBindingTypes {
  public record OperationDescriptor(String operationId, String owner, String routeRegistry) {}

  public static final class ReadContext {
    private ReadContext() {}
  }

  public static final class WorkspaceExecutionContext {
    private WorkspaceExecutionContext() {}
  }

  public static final class WorkspaceProtocolContext {
    private WorkspaceProtocolContext() {}
  }

  public static final class PlatformCommandContext {
    private PlatformCommandContext() {}
  }

  public static final class PublicProtocolCommandContext {
    private PublicProtocolCommandContext() {}
  }

  public static final class TerminalCredentialCommandContext {
    private TerminalCredentialCommandContext() {}
  }

  public record TerminalCredentialReadContext(
      java.util.UUID workspaceUuid,
      String groupWorkspaceKey,
      java.util.UUID storeRef,
      java.util.UUID terminalRef,
      long bindingGeneration) {
    public TerminalCredentialReadContext {
      java.util.Objects.requireNonNull(workspaceUuid, "workspaceUuid");
      java.util.Objects.requireNonNull(groupWorkspaceKey, "groupWorkspaceKey");
      java.util.Objects.requireNonNull(storeRef, "storeRef");
      java.util.Objects.requireNonNull(terminalRef, "terminalRef");
      if (bindingGeneration < 1) throw new IllegalArgumentException("bindingGeneration is invalid");
    }
  }

  public static final class Wire {
    public record AuditHistoryPage() {}
    public record Brand() {}
    public record BrandCatalogCopyPreflight() {}
    public record BrandCatalogCopyReadback() {}
    public record BrandCopyCandidatePage() {}
    public record BrandCopyCandidateQuery() {}
    public record BrandCopyExecuteRequest() {}
    public record BrandCopyPreflightRequest() {}
    public record BrandCreateRequest() {}
    public record BrandPage() {}
    public record BrandUpdateRequest() {}
    public record BusinessChannelCreateRequest() {}
    public record BusinessChannelPage() {}
    public record BusinessChannelStatusRequest() {}
    public record BusinessChannelTemplateCreateRequest() {}
    public record BusinessChannelTemplatePage() {}
    public record BusinessChannelTemplateStatusRequest() {}
    public record BusinessChannelTemplateUpdateRequest() {}
    public record BusinessChannelTemplateView() {}
    public record BusinessChannelTemplateVisibleStorePage() {}
    public record BusinessChannelUpdateRequest() {}
    public record BusinessChannelView() {}
    public record BusinessEntityStatusRequest() {}
    public record CapabilityDictionary() {}
    public record CatalogAssetReleaseReadback() {}
    public record CatalogAssetReleaseRequest() {}
    public record CatalogAssetStageRequest() {}
    public record CatalogAttributeDefinitionCreateRequest() {}
    public record CatalogAttributeDefinitionList() {}
    public record CatalogAttributeDefinitionListQuery() {}
    public record CatalogAttributeDefinitionReadback() {}
    public record CatalogAttributeDefinitionStatusTransitionRequest() {}
    public record CatalogAttributeDefinitionUpdateRequest() {}
    public record CatalogCategoryCandidatePage() {}
    public record CatalogCategoryCandidateQuery() {}
    public record CatalogCategoryCreateRequest() {}
    public record CatalogCategoryMoveRequest() {}
    public record CatalogCategoryReadback() {}
    public record CatalogCategoryStatusTransitionRequest() {}
    public record CatalogCategoryUpdateRequest() {}
    public record CatalogContextQuery() {}
    public record CatalogDictionaryEntryCreateRequest() {}
    public record CatalogDictionaryEntryReadback() {}
    public record CatalogDictionaryEntryReorderRequest() {}
    public record CatalogDictionaryEntryTransitionRequest() {}
    public record CatalogDictionaryEntryUpdateRequest() {}
    public record CatalogDictionaryQuery() {}
    public record CatalogDictionaryView() {}
    public record CatalogItemBatchStatusTransitionReadback() {}
    public record CatalogItemBatchStatusTransitionRequest() {}
    public record CatalogItemCommandReadback() {}
    public record CatalogItemCreateRequest() {}
    public record CatalogItemDetail() {}
    public record CatalogItemDetailQuery() {}
    public record CatalogItemPage() {}
    public record CatalogItemPageQuery() {}
    public record CatalogItemSaveReadback() {}
    public record CatalogItemSaveRequest() {}
    public record CatalogItemSkuPage() {}
    public record CatalogItemSkusQuery() {}
    public record CatalogItemTransitionRequest() {}
    public record CatalogNavigationQuery() {}
    public record CatalogNavigationView() {}
    public record CatalogOrderOptionDefinitionCreateRequest() {}
    public record CatalogOrderOptionDefinitionList() {}
    public record CatalogOrderOptionDefinitionListQuery() {}
    public record CatalogOrderOptionDefinitionReadback() {}
    public record CatalogOrderOptionDefinitionStatusTransitionRequest() {}
    public record CatalogOrderOptionDefinitionUpdateRequest() {}
    public record CatalogShapeManifestQuery() {}
    public record CatalogShapeManifestView() {}
    public record CatalogUnitCreateRequest() {}
    public record CatalogUnitList() {}
    public record CatalogUnitListQuery() {}
    public record CatalogUnitReadback() {}
    public record CatalogUnitStatusTransitionRequest() {}
    public record CatalogUnitUpdateRequest() {}
    public record CatalogWorkbenchContext() {}
    public record CommercialGroupInitializeRequest() {}
    public record CommercialGroupRoot() {}
    public record CommercialGroupUpdateRequest() {}
    public record ContractOverviewItem() {}
    public record ContractOverviewPage() {}
    public record ExtensionDefinition() {}
    public record ExtensionDefinitionUpdateRequest() {}
    public record ExtensionEntityCatalogPage() {}
    public record ExternalCollaborationTree() {}
    public record ExternalProviderCandidatePage() {}
    public record ExternalSystemStatusRequest() {}
    public record ExternalSystemView() {}
    public record GroupWorkspaceCreateRequest() {}
    public record GroupWorkspaceCreateResult() {}
    public record GroupWorkspaceDetail() {}
    public record GroupWorkspaceDisplayUpdateRequest() {}
    public record GroupWorkspacePage() {}
    public record GroupWorkspaceStatusTransitionRequest() {}
    public record HeadCompany() {}
    public record HeadCompanyBrandAuthorizationAddRequest() {}
    public record HeadCompanyCreateRequest() {}
    public record HeadCompanyPage() {}
    public record HeadCompanyUpdateRequest() {}
    public record InventoryAdjustmentRequest() {}
    public record InventoryBusinessHistoryPage() {}
    public record InventoryChangeSummaryView() {}
    public record InventoryConsumptionReferencePage() {}
    public record InventoryConsumptionTargetCandidatePage() {}
    public record InventoryConsumptionTargetCandidateQuery() {}
    public record InventoryCountRequest() {}
    public record InventoryDiagnosticsQuery() {}
    public record InventoryDiagnosticsView() {}
    public record InventoryHistoryPageQuery() {}
    public record InventoryIncreaseRequest() {}
    public record InventoryLedgerPage() {}
    public record InventoryLedgerPageQuery() {}
    public record InventoryReferencePageQuery() {}
    public record InventoryTargetConfigurationRequest() {}
    public record InventoryTargetCurrentView() {}
    public record InventoryTargetPage() {}
    public record InventoryTargetPageQuery() {}
    public record InventoryTargetPeriodQuery() {}
    public record InventoryTargetQuery() {}
    public record InventoryWriteReadback() {}
    public record LocalCopyCandidatePage() {}
    public record LocalCopyCandidateQuery() {}
    public record LocalCopyExecuteRequest() {}
    public record LocalCopyPreflight() {}
    public record LocalCopyPreflightRequest() {}
    public record LocalCopyReadback() {}
    public record LoginRequest() {}
    public record NoBody() {}
    public record NoContent() {}
    public record OperationsPasswordRecoveryCompleteRequest() {}
    public record OperationsPasswordRecoveryCompletion() {}
    public record OperationsPasswordRecoveryOtpSendRequest() {}
    public record OperationsPasswordRecoveryOtpSendResponse() {}
    public record OperationsPasswordRecoveryOtpVerifyRequest() {}
    public record OperationsPasswordRecoveryStartRequest() {}
    public record OperationsPasswordRecoveryStartResponse() {}
    public record OperationsPasswordRecoveryVerification() {}
    public record OperationsTerminalActivationCancellationRequest() {}
    public record OperationsTerminalActivationCancellationResult() {}
    public record OrganizationCandidatePage() {}
    public record OrganizationHierarchySnapshot() {}
    public record OrganizationHierarchyTree() {}
    public record OrganizationNode() {}
    public record OrganizationNodeCreateRequest() {}
    public record OrganizationNodeStatusTransitionRequest() {}
    public record OrganizationNodeUpdateRequest() {}
    public record OrganizationOverviewItem() {}
    public record OrganizationOverviewPage() {}
    public record OrganizationProjectCreateRequest() {}
    public record OrganizationStore() {}
    public record OrganizationStoreCreateRequest() {}
    public record OrganizationStorePage() {}
    public record OrganizationStoreStatusRequest() {}
    public record OrganizationStoreUpdateRequest() {}
    public record OwnerBindingCreateRequest() {}
    public record OwnerBindingDeleteRequest() {}
    public record OwnerBindingPage() {}
    public record OwnerBindingUpdateRequest() {}
    public record OwnerBindingView() {}
    public record PlatformAdminCreateRequest() {}
    public record PlatformAdminCredentialResetRequest() {}
    public record PlatformAdminDetail() {}
    public record PlatformAdminPage() {}
    public record PlatformAdminProfileUpdateRequest() {}
    public record PlatformAdminStatusTransitionRequest() {}
    public record PlatformAssetStageMultipart() {}
    public record PlatformAssetStagingResult() {}
    public record PlatformCurrentPasswordChangeRequest() {}
    public record PlatformCurrentPasswordChangeResult() {}
    public record PlatformLoginOtpSendRequest() {}
    public record PlatformLoginOtpVerifyRequest() {}
    public record PlatformOtpDispatchResponse() {}
    public record PlatformPasswordRecoveryCompleteRequest() {}
    public record PlatformPasswordRecoveryCompletion() {}
    public record PlatformPasswordRecoveryOtpSendRequest() {}
    public record PlatformPasswordRecoveryOtpVerifyRequest() {}
    public record PlatformPasswordRecoveryStartRequest() {}
    public record PlatformPasswordRecoveryStartResponse() {}
    public record PlatformPasswordRecoveryVerification() {}
    public record PlatformSessionView() {}
    public record PlatformWorkspaceInvitation() {}
    public record PlatformWorkspaceInvitationPage() {}
    public record ProductionTagCreateRequest() {}
    public record ProductionTagPage() {}
    public record ProductionTagQuery() {}
    public record ProductionTagReadback() {}
    public record ProductionTagTransitionRequest() {}
    public record ProductionTagUpdateRequest() {}
    public record ProviderProfileView() {}
    public record PublicAssetReference() {}
    public record PublicInvitationAcceptIntent() {}
    public record PublicInvitationCompletion() {}
    public record PublicInvitationCredentialRequest() {}
    public record PublicInvitationCredentialResponse() {}
    public record PublicInvitationOtpSendRequest() {}
    public record PublicInvitationOtpSendResponse() {}
    public record PublicInvitationOtpVerifyRequest() {}
    public record PublicInvitationReadiness() {}
    public record PublicInvitationView() {}
    public record SalesMenuActivationRequest() {}
    public record SalesMenuArchiveRequest() {}
    public record SalesMenuAssetReleaseReadback() {}
    public record SalesMenuAssetReleaseRequest() {}
    public record SalesMenuAssetStageReadback() {}
    public record SalesMenuAssetStageRequest() {}
    public record SalesMenuCandidatePage() {}
    public record SalesMenuCommandReadback() {}
    public record SalesMenuCopyRequest() {}
    public record SalesMenuCreateRequest() {}
    public record SalesMenuDeleteRequest() {}
    public record SalesMenuDetail() {}
    public record SalesMenuDraftItemView() {}
    public record SalesMenuItemMoveRequest() {}
    public record SalesMenuItemPage() {}
    public record SalesMenuItemUpdateRequest() {}
    public record SalesMenuItemsAddRequest() {}
    public record SalesMenuManualRestoreRequest() {}
    public record SalesMenuManualSoldOutRequest() {}
    public record SalesMenuOperationRecordPage() {}
    public record SalesMenuPage() {}
    public record SalesMenuPublicationPreview() {}
    public record SalesMenuPublishRequest() {}
    public record SalesMenuPublishedItemPage() {}
    public record SalesMenuPublishedItemView() {}
    public record SalesMenuPublishedSectionList() {}
    public record SalesMenuRenameRequest() {}
    public record SalesMenuScheduleUpdateRequest() {}
    public record SalesMenuSectionCreateRequest() {}
    public record SalesMenuSectionList() {}
    public record SalesMenuSectionMoveRequest() {}
    public record SalesMenuSectionRenameRequest() {}
    public record StagedCatalogAsset() {}
    public record StoreContract() {}
    public record StoreContractCandidatePage() {}
    public record StoreContractCreateRequest() {}
    public record StoreContractInvalidateRequest() {}
    public record StoreContractPage() {}
    public record StoreContractUpdateRequest() {}
    public record StoreQrChannelCandidatePage() {}
    public record StoreQrConfigurationUpdateRequest() {}
    public record StoreQrConfigurationView() {}
    public record StoreServicePoint() {}
    public record StoreServicePointArea() {}
    public record StoreServicePointAreaCreateRequest() {}
    public record StoreServicePointAreaOrderRequest() {}
    public record StoreServicePointAreaPage() {}
    public record StoreServicePointAreaStatusRequest() {}
    public record StoreServicePointAreaUpdateRequest() {}
    public record StoreServicePointAssetReleaseReadback() {}
    public record StoreServicePointAssetReleaseRequest() {}
    public record StoreServicePointAssetStageReadback() {}
    public record StoreServicePointAssetStageRequest() {}
    public record StoreServicePointCreateRequest() {}
    public record StoreServicePointDetail() {}
    public record StoreServicePointOrderRequest() {}
    public record StoreServicePointPage() {}
    public record StoreServicePointStatusRequest() {}
    public record StoreServicePointUpdateRequest() {}
    public record StoreTerminalAreaCandidatePage() {}
    public record StoreTerminalCreateRequest() {}
    public record StoreTerminalDetail() {}
    public record StoreTerminalMutation() {}
    public record StoreTerminalPage() {}
    public record StoreTerminalReplaceRequest() {}
    public record StoreTerminalStatusRequest() {}
    public record StoreTerminalTagCandidatePage() {}
    public record TemporaryPromotionExecuteRequest() {}
    public record TemporaryPromotionPreflight() {}
    public record TemporaryPromotionPreflightRequest() {}
    public record Tenant() {}
    public record TenantCreateRequest() {}
    public record TenantPage() {}
    public record TenantUpdateRequest() {}
    public record TerminalActivationCancellationRequest() {}
    public record TerminalActivationCancellationResult() {}
    public record TerminalActivationRequest() {}
    public record TerminalActivationResult() {}
    public record TerminalContractRead() {}
    public record TerminalContractReadQuery(java.util.UUID contractRef) {}
    public record TerminalServicePointAreaRead() {}
    public record TerminalServicePointAreaReadQuery(java.util.UUID areaRef) {}
    public record TerminalServicePointRead() {}
    public record TerminalServicePointReadQuery(java.util.UUID pointRef) {}
    public record TerminalStoreActiveContractsRead() {}
    public record TerminalStoreBasicRead() {}
    public record TerminalStoreOrganizationPathRead() {}
    public record TerminalStoreServicePointAreasRead() {}
    public record TerminalStoreServicePointsRead() {}
    public record TerminalUpdateArtifactCandidatePage() {}
    public record TerminalUpdateArtifactCandidateQuery() {}
    public record TerminalUpdateArtifactDetail() {}
    public record TerminalUpdateArtifactPage() {}
    public record TerminalUpdateArtifactPageQuery() {}
    public record TerminalUpdateArtifactRegisterRequest() {}
    public record TerminalUpdateArtifactStageRequest() {}
    public record TerminalUpdateBinaryContent() {}
    public record TerminalUpdateDownloadGrantResult() {}
    public record TerminalUpdateReportHistoryPage() {}
    public record TerminalUpdateReportHistoryQuery() {}
    public record TerminalUpdateReportReceipt() {}
    public record TerminalUpdateReportRequest() {}
    public record TerminalUpdateRuleCreateRequest() {}
    public record TerminalUpdateRuleDetail() {}
    public record TerminalUpdateRulePage() {}
    public record TerminalUpdateRulePageQuery() {}
    public record TerminalUpdateRuleSnapshotPage() {}
    public record TerminalUpdateRuleSnapshotQuery() {}
    public record TerminalUpdateRuleStatusRequest() {}
    public record TerminalUpdateRuleStorePage() {}
    public record TerminalUpdateStageResult() {}
    public record TerminalUpdateVersionDetail() {}
    public record TerminalUpdateVersionPage() {}
    public record TerminalUpdateVersionPageQuery() {}
    public record WorkspaceAccount() {}
    public record WorkspaceAccountPage() {}
    public record WorkspaceAccountStatusTransitionRequest() {}
    public record WorkspaceAssignmentRevokeRequest() {}
    public record WorkspaceAssignmentRevokeResult() {}
    public record WorkspaceCredentialResetRequest() {}
    public record WorkspaceCredentialResetResult() {}
    public record WorkspaceCurrentPasswordChangeRequest() {}
    public record WorkspaceCurrentPasswordChangeResult() {}
    public record WorkspaceInvitation() {}
    public record WorkspaceInvitationCancelRequest() {}
    public record WorkspaceInvitationCandidatePage() {}
    public record WorkspaceInvitationCreateRequest() {}
    public record WorkspaceInvitationPage() {}
    public record WorkspaceInvitationReissueRequest() {}
    public record WorkspaceLoginEntry() {}
    public record WorkspaceOperationsInvitationActionRequest() {}
    public record WorkspaceOperationsInvitationCreateRequest() {}
    public record WorkspaceOtpSendRequest() {}
    public record WorkspaceOtpSendResponse() {}
    public record WorkspaceOtpVerifyRequest() {}
    public record WorkspacePasswordLoginRequest() {}
    public record WorkspaceRole() {}
    public record WorkspaceRoleCreateRequest() {}
    public record WorkspaceRolePage() {}
    public record WorkspaceRoleStatusTransitionRequest() {}
    public record WorkspaceRoleUpdateRequest() {}
    public record WorkspaceSelectContextRequest() {}
    public record WorkspaceSelectDataNodeRequest() {}
    public record WorkspaceSessionEntry() {}
    public record WorkspaceUser() {}
    public record WorkspaceUserPage() {}
    public record WorkspaceUserRevokeRequest() {}
    public record WorkspaceUserRevokeResult() {}
    private Wire() {}
  }

  private OperationBindingTypes() {}
}
