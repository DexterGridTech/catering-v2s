package com.catering.v2s.platform.command;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Generated, immutable operation policy used only to bind a command resolver to a finite catalog-inventory operation.
 * It deliberately has no public constructor and never accepts an operation id from a request.
 */
public final class WorkspaceCommandOperationToken {
    /**
     * The source of a copy is operation policy, not a client-controlled data-node reference. COPY_TARGET alone only
     * says which side receives the result; it does not say how a source is resolved.
     */
    public enum CopySourcePolicy {
        NONE,
        TARGET_SCOPE,
        CATALOG_ITEM,
        ORGANIZATION_JUDGMENT
    }

    private final String operationId;
    private final String owner;
    private final String requirementId;
    private final List<String> allowedDataNodeTypes;
    private final Map<String, String> capabilityByDataNodeType;
    private final String copyRole;
    private final CopySourcePolicy copySourcePolicy;
    private final String storeOperatingRuleKey;

    WorkspaceCommandOperationToken(
            String operationId,
            String owner,
            String requirementId,
            List<String> allowedDataNodeTypes,
            Map<String, String> capabilityByDataNodeType,
            String copyRole,
            CopySourcePolicy copySourcePolicy,
            String storeOperatingRuleKey) {
        this.operationId = required(operationId, "operationId");
        this.owner = required(owner, "owner");
        this.requirementId = required(requirementId, "requirementId");
        this.allowedDataNodeTypes = List.copyOf(allowedDataNodeTypes);
        this.capabilityByDataNodeType = Map.copyOf(capabilityByDataNodeType);
        this.copyRole = required(copyRole, "copyRole");
        this.copySourcePolicy = Objects.requireNonNull(copySourcePolicy, "copySourcePolicy");
        this.storeOperatingRuleKey = storeOperatingRuleKey;
    }

    public String operationId() {
        return operationId;
    }

    public String owner() {
        return owner;
    }

    public String requirementId() {
        return requirementId;
    }

    public List<String> allowedDataNodeTypes() {
        return allowedDataNodeTypes;
    }

    public String capabilityFor(String dataNodeType) {
        return capabilityByDataNodeType.get(dataNodeType);
    }

    public String copyRole() {
        return copyRole;
    }

    public CopySourcePolicy copySourcePolicy() {
        return copySourcePolicy;
    }

    public String storeOperatingRuleKey() {
        return storeOperatingRuleKey;
    }

    public boolean isFor(String operationId, String owner) {
        return Objects.equals(this.operationId, operationId) && Objects.equals(this.owner, owner);
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " must not be blank");
        return value;
    }
}
