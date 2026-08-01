package com.catering.v2s.organization.api;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;

/** Narrow cross-owner history read for the commercial-group initialization fact only. */
public interface CommercialGroupInitializationAuditLookup {
    AuditHistoryPage readInitializationForGroupWorkspace(
        AuditReadScope scope,
        String groupWorkspaceEntityRef,
        long page,
        long pageSize
    );
}
