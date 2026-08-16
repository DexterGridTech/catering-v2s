package com.catering.v2s.platform.command;

/**
 * The single source for the catalog write capability bound to a data-node type. Owner modules still decide whether and
 * how a grant is valid for their command.
 */
public final class CatalogTargetCapability {
    private CatalogTargetCapability() {}

    public static String forDataNodeType(String dataNodeType) {
        return switch (dataNodeType) {
            case "HEAD_COMPANY" -> "EDIT_HEAD_COMPANY_CATALOG";
            case "STORE" -> "EDIT_STORE_CATALOG";
            default -> null;
        };
    }
}
