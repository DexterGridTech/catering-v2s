package com.catering.v2s.generated.operationbindings.organization;

import com.catering.v2s.generated.operationbindings.OperationBindingTypes;
import java.util.Objects;

/**
 * Generated owner-local static bindings for organization. The read entry point is
 * the only generated string branch; every command has a kind-specific typed
 * method and cannot accept another command context at compile time.
 */
public final class OrganizationOperationBindings {
  public interface OwnerLocalAdapters {
    OperationBindingTypes.Wire.NoContent addOperationsOrganizationHeadCompanyBrandAuthorization(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyBrandAuthorizationAddRequest request);
    OperationBindingTypes.Wire.Brand createOperationsOrganizationBrand(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCreateRequest request);
    OperationBindingTypes.Wire.HeadCompany createOperationsOrganizationHeadCompany(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyCreateRequest request);
    OperationBindingTypes.Wire.OrganizationNode createOperationsOrganizationProject(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationProjectCreateRequest request);
    OperationBindingTypes.Wire.OrganizationNode createOperationsOrganizationRegion(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeCreateRequest request);
    OperationBindingTypes.Wire.OrganizationStore createOperationsOrganizationStore(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreCreateRequest request);
    OperationBindingTypes.Wire.Tenant createOperationsOrganizationTenant(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TenantCreateRequest request);
    OperationBindingTypes.Wire.Brand getOperationsOrganizationBrand(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.BrandPage getOperationsOrganizationBrands(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionDefinition getOperationsOrganizationBusinessEntityExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationCandidatePage getOperationsOrganizationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.HeadCompanyPage getOperationsOrganizationHeadCompanies(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.HeadCompany getOperationsOrganizationHeadCompany(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationHierarchySnapshot getOperationsOrganizationHierarchy(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionDefinition getOperationsOrganizationHierarchyExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationStore getOperationsOrganizationStore(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.ExtensionDefinition getOperationsOrganizationStoreExtensionDefinition(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationStorePage getOperationsOrganizationStores(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.Tenant getOperationsOrganizationTenant(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.TenantPage getOperationsOrganizationTenants(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationStore getOperationsStoreProfile(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationCandidatePage getPlatformOrganizationCandidates(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationHierarchyTree getPlatformOrganizationHierarchyTree(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationOverviewItem getPlatformOrganizationOverviewDetail(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.OrganizationOverviewPage getPlatformOrganizationOverviewPage(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.CommercialGroupRoot initializeCommercialGroup(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.CommercialGroupInitializeRequest request);
    OperationBindingTypes.Wire.NoContent removeOperationsOrganizationHeadCompanyBrandAuthorization(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.NoBody request);
    OperationBindingTypes.Wire.Brand transitionOperationsOrganizationBrandStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request);
    OperationBindingTypes.Wire.HeadCompany transitionOperationsOrganizationHeadCompanyStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request);
    OperationBindingTypes.Wire.OrganizationNode transitionOperationsOrganizationNodeStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeStatusTransitionRequest request);
    OperationBindingTypes.Wire.OrganizationStore transitionOperationsOrganizationStoreStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreStatusRequest request);
    OperationBindingTypes.Wire.Tenant transitionOperationsOrganizationTenantStatus(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request);
    OperationBindingTypes.Wire.CommercialGroupRoot updateOperationsCommercialGroup(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CommercialGroupUpdateRequest request);
    OperationBindingTypes.Wire.Brand updateOperationsOrganizationBrand(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandUpdateRequest request);
    OperationBindingTypes.Wire.HeadCompany updateOperationsOrganizationHeadCompany(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyUpdateRequest request);
    OperationBindingTypes.Wire.OrganizationNode updateOperationsOrganizationNode(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeUpdateRequest request);
    OperationBindingTypes.Wire.OrganizationStore updateOperationsOrganizationStore(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreUpdateRequest request);
    OperationBindingTypes.Wire.Tenant updateOperationsOrganizationTenant(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TenantUpdateRequest request);
  }

  private final OwnerLocalAdapters adapters;

  public OrganizationOperationBindings(OwnerLocalAdapters adapters) {
    this.adapters = Objects.requireNonNull(adapters, "adapters");
  }

  public static final OperationBindingTypes.OperationDescriptor ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("addOperationsOrganizationHeadCompanyBrandAuthorization", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationBrand", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationHeadCompany", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_PROJECT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationProject", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_REGION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationRegion", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationStore", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor CREATE_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("createOperationsOrganizationTenant", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationBrand", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_BRANDS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationBrands", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationBusinessEntityExtensionDefinition", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationCandidates", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_HEAD_COMPANIES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationHeadCompanies", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationHeadCompany", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_HIERARCHY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationHierarchy", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_HIERARCHY_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationHierarchyExtensionDefinition", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationStore", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_STORE_EXTENSION_DEFINITION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationStoreExtensionDefinition", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_STORES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationStores", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationTenant", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_ORGANIZATION_TENANTS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsOrganizationTenants", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_OPERATIONS_STORE_PROFILE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getOperationsStoreProfile", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ORGANIZATION_CANDIDATES_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformOrganizationCandidates", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ORGANIZATION_HIERARCHY_TREE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformOrganizationHierarchyTree", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ORGANIZATION_OVERVIEW_DETAIL_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformOrganizationOverviewDetail", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor GET_PLATFORM_ORGANIZATION_OVERVIEW_PAGE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("getPlatformOrganizationOverviewPage", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor INITIALIZE_COMMERCIAL_GROUP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("initializeCommercialGroup", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("removeOperationsOrganizationHeadCompanyBrandAuthorization", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_ORGANIZATION_BRAND_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsOrganizationBrandStatus", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsOrganizationHeadCompanyStatus", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsOrganizationNodeStatus", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_ORGANIZATION_STORE_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsOrganizationStoreStatus", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor TRANSITION_OPERATIONS_ORGANIZATION_TENANT_STATUS_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("transitionOperationsOrganizationTenantStatus", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_COMMERCIAL_GROUP_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsCommercialGroup", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOrganizationBrand", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOrganizationHeadCompany", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_ORGANIZATION_NODE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOrganizationNode", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOrganizationStore", "organization", "edge-face");
  public static final OperationBindingTypes.OperationDescriptor UPDATE_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR = new OperationBindingTypes.OperationDescriptor("updateOperationsOrganizationTenant", "organization", "edge-face");

  private static void requireReadDescriptor(OperationBindingTypes.OperationDescriptor descriptor) {
    if (descriptor == null) throw new IllegalArgumentException("descriptor is required");
    switch (descriptor.operationId()) {
      case "getOperationsOrganizationBrand" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationBrands" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_BRANDS_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationBusinessEntityExtensionDefinition" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationCandidates" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_CANDIDATES_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationHeadCompanies" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_HEAD_COMPANIES_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationHeadCompany" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationHierarchy" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_HIERARCHY_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationHierarchyExtensionDefinition" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_HIERARCHY_EXTENSION_DEFINITION_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationStore" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationStoreExtensionDefinition" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_STORE_EXTENSION_DEFINITION_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationStores" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_STORES_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationTenant" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsOrganizationTenants" -> { if (descriptor != GET_OPERATIONS_ORGANIZATION_TENANTS_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getOperationsStoreProfile" -> { if (descriptor != GET_OPERATIONS_STORE_PROFILE_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformOrganizationCandidates" -> { if (descriptor != GET_PLATFORM_ORGANIZATION_CANDIDATES_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformOrganizationHierarchyTree" -> { if (descriptor != GET_PLATFORM_ORGANIZATION_HIERARCHY_TREE_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformOrganizationOverviewDetail" -> { if (descriptor != GET_PLATFORM_ORGANIZATION_OVERVIEW_DETAIL_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      case "getPlatformOrganizationOverviewPage" -> { if (descriptor != GET_PLATFORM_ORGANIZATION_OVERVIEW_PAGE_DESCRIPTOR || !"organization".equals(descriptor.owner()) || !"edge-face".equals(descriptor.routeRegistry())) throw new IllegalArgumentException("foreign descriptor"); }
      default -> throw new IllegalArgumentException("unsupported descriptor");
    }
  }

  /** Generated closed read branch; Object is confined to this read boundary. */
  public Object invoke(OperationBindingTypes.OperationDescriptor descriptor, OperationBindingTypes.ReadContext context, Object request) {
    requireReadDescriptor(descriptor);
    return switch (descriptor.operationId()) {
      case "getOperationsOrganizationBrand" -> adapters.getOperationsOrganizationBrand(GET_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationBrands" -> adapters.getOperationsOrganizationBrands(GET_OPERATIONS_ORGANIZATION_BRANDS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationBusinessEntityExtensionDefinition" -> adapters.getOperationsOrganizationBusinessEntityExtensionDefinition(GET_OPERATIONS_ORGANIZATION_BUSINESS_ENTITY_EXTENSION_DEFINITION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationCandidates" -> adapters.getOperationsOrganizationCandidates(GET_OPERATIONS_ORGANIZATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationHeadCompanies" -> adapters.getOperationsOrganizationHeadCompanies(GET_OPERATIONS_ORGANIZATION_HEAD_COMPANIES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationHeadCompany" -> adapters.getOperationsOrganizationHeadCompany(GET_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationHierarchy" -> adapters.getOperationsOrganizationHierarchy(GET_OPERATIONS_ORGANIZATION_HIERARCHY_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationHierarchyExtensionDefinition" -> adapters.getOperationsOrganizationHierarchyExtensionDefinition(GET_OPERATIONS_ORGANIZATION_HIERARCHY_EXTENSION_DEFINITION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationStore" -> adapters.getOperationsOrganizationStore(GET_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationStoreExtensionDefinition" -> adapters.getOperationsOrganizationStoreExtensionDefinition(GET_OPERATIONS_ORGANIZATION_STORE_EXTENSION_DEFINITION_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationStores" -> adapters.getOperationsOrganizationStores(GET_OPERATIONS_ORGANIZATION_STORES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationTenant" -> adapters.getOperationsOrganizationTenant(GET_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsOrganizationTenants" -> adapters.getOperationsOrganizationTenants(GET_OPERATIONS_ORGANIZATION_TENANTS_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getOperationsStoreProfile" -> adapters.getOperationsStoreProfile(GET_OPERATIONS_STORE_PROFILE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformOrganizationCandidates" -> adapters.getPlatformOrganizationCandidates(GET_PLATFORM_ORGANIZATION_CANDIDATES_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformOrganizationHierarchyTree" -> adapters.getPlatformOrganizationHierarchyTree(GET_PLATFORM_ORGANIZATION_HIERARCHY_TREE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformOrganizationOverviewDetail" -> adapters.getPlatformOrganizationOverviewDetail(GET_PLATFORM_ORGANIZATION_OVERVIEW_DETAIL_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      case "getPlatformOrganizationOverviewPage" -> adapters.getPlatformOrganizationOverviewPage(GET_PLATFORM_ORGANIZATION_OVERVIEW_PAGE_DESCRIPTOR, context, (OperationBindingTypes.Wire.NoBody) request);
      default -> throw new IllegalArgumentException("Unsupported read operation: " + descriptor.operationId());
    };
  }


  public OperationBindingTypes.Wire.NoContent addOperationsOrganizationHeadCompanyBrandAuthorization(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyBrandAuthorizationAddRequest request) {
    return adapters.addOperationsOrganizationHeadCompanyBrandAuthorization(ADD_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Brand createOperationsOrganizationBrand(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandCreateRequest request) {
    return adapters.createOperationsOrganizationBrand(CREATE_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.HeadCompany createOperationsOrganizationHeadCompany(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyCreateRequest request) {
    return adapters.createOperationsOrganizationHeadCompany(CREATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationNode createOperationsOrganizationProject(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationProjectCreateRequest request) {
    return adapters.createOperationsOrganizationProject(CREATE_OPERATIONS_ORGANIZATION_PROJECT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationNode createOperationsOrganizationRegion(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeCreateRequest request) {
    return adapters.createOperationsOrganizationRegion(CREATE_OPERATIONS_ORGANIZATION_REGION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationStore createOperationsOrganizationStore(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreCreateRequest request) {
    return adapters.createOperationsOrganizationStore(CREATE_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Tenant createOperationsOrganizationTenant(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TenantCreateRequest request) {
    return adapters.createOperationsOrganizationTenant(CREATE_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CommercialGroupRoot initializeCommercialGroup(OperationBindingTypes.PlatformCommandContext context, OperationBindingTypes.Wire.CommercialGroupInitializeRequest request) {
    return adapters.initializeCommercialGroup(INITIALIZE_COMMERCIAL_GROUP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.NoContent removeOperationsOrganizationHeadCompanyBrandAuthorization(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.NoBody request) {
    return adapters.removeOperationsOrganizationHeadCompanyBrandAuthorization(REMOVE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Brand transitionOperationsOrganizationBrandStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request) {
    return adapters.transitionOperationsOrganizationBrandStatus(TRANSITION_OPERATIONS_ORGANIZATION_BRAND_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.HeadCompany transitionOperationsOrganizationHeadCompanyStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request) {
    return adapters.transitionOperationsOrganizationHeadCompanyStatus(TRANSITION_OPERATIONS_ORGANIZATION_HEAD_COMPANY_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationNode transitionOperationsOrganizationNodeStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeStatusTransitionRequest request) {
    return adapters.transitionOperationsOrganizationNodeStatus(TRANSITION_OPERATIONS_ORGANIZATION_NODE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationStore transitionOperationsOrganizationStoreStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreStatusRequest request) {
    return adapters.transitionOperationsOrganizationStoreStatus(TRANSITION_OPERATIONS_ORGANIZATION_STORE_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Tenant transitionOperationsOrganizationTenantStatus(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BusinessEntityStatusRequest request) {
    return adapters.transitionOperationsOrganizationTenantStatus(TRANSITION_OPERATIONS_ORGANIZATION_TENANT_STATUS_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.CommercialGroupRoot updateOperationsCommercialGroup(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.CommercialGroupUpdateRequest request) {
    return adapters.updateOperationsCommercialGroup(UPDATE_OPERATIONS_COMMERCIAL_GROUP_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Brand updateOperationsOrganizationBrand(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.BrandUpdateRequest request) {
    return adapters.updateOperationsOrganizationBrand(UPDATE_OPERATIONS_ORGANIZATION_BRAND_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.HeadCompany updateOperationsOrganizationHeadCompany(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.HeadCompanyUpdateRequest request) {
    return adapters.updateOperationsOrganizationHeadCompany(UPDATE_OPERATIONS_ORGANIZATION_HEAD_COMPANY_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationNode updateOperationsOrganizationNode(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationNodeUpdateRequest request) {
    return adapters.updateOperationsOrganizationNode(UPDATE_OPERATIONS_ORGANIZATION_NODE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.OrganizationStore updateOperationsOrganizationStore(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.OrganizationStoreUpdateRequest request) {
    return adapters.updateOperationsOrganizationStore(UPDATE_OPERATIONS_ORGANIZATION_STORE_DESCRIPTOR, context, request);
  }

  public OperationBindingTypes.Wire.Tenant updateOperationsOrganizationTenant(OperationBindingTypes.WorkspaceExecutionContext context, OperationBindingTypes.Wire.TenantUpdateRequest request) {
    return adapters.updateOperationsOrganizationTenant(UPDATE_OPERATIONS_ORGANIZATION_TENANT_DESCRIPTOR, context, request);
  }
}
