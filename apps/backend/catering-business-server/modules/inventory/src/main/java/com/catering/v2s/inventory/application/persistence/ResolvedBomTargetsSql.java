package com.catering.v2s.inventory.application.persistence;

/** SQL text fragments owned by ResolvedBomTargets; B3 relocates text only and does not change execution. */
public final class ResolvedBomTargetsSql {
    public static final String RESOLVED_BOM_TARGETS_SELECT_TARGET_REF_DEFINITION_STATUS_COMPONENT_ELIGIBLE = "SELECT target_ref,definition_status,component_eligible,";
    public static final String RESOLVED_BOM_TARGETS_CONTINUATION_STOCK_TARGET_CONSUMPTION_UNIT_REF = "consumption_unit_ref FROM inventory.stock_target ";
    public static final String RESOLVED_BOM_TARGETS_WHERE_DATA_NODE_REF_BRAND_REF_TARGET_REF = "WHERE data_node_ref=? AND brand_ref=? AND target_ref = ANY(?::uuid[])";
}
