package com.catering.v2s.organization.api;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Organization-owned facts for platform group-workspace task reads. */
public interface OrganizationGroupWorkspaceInitializationLookup {
    record InitializationState(String groupWorkspaceKey, boolean commercialGroupInitialized) { }

    Map<String, InitializationState> listInitializationFacts(List<String> groupWorkspaceKeys);

    Optional<CommercialGroupReadback> initializationFact(String groupWorkspaceKey);
}
