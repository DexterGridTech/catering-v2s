package com.catering.v2s.salesmenu.application.persistence;

/** SQL fragments for the sales-menu collection persistence execution points. */
public final class SalesMenuCollectionPersistenceSql {
    public static final String SALES_MENU_COLLECTION_LOCK_SUFFIX = " FOR UPDATE OF c";
    public static final String SELECT_COLLECTION_REF_WS_UUID_001 =
            "SELECT c.collection_ref,c.workspace_uuid,c.group_workspace_key,c.store_ref,c.name,";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_ARCHIVED_AT_EPOCH_MILLIS =
            "c.archived_at_epoch_millis,c.version,c.current_draft_version_ref,c.latest_published_version_ref,";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_REVISION =
            "d.revision draft_revision,d.schedule_kind draft_schedule_kind,d.schedule_start_local_time ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_DRAFT_START =
            "draft_start,d.schedule_end_local_time draft_end,p.revision published_revision,";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_PUBLICATION =
            "publication.source_draft_revision latest_published_source_draft_revision,";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_SCHEDULE_KIND =
            "p.schedule_kind published_schedule_kind,p.schedule_start_local_time published_start,";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_SCHEDULE_END_LOCAL_TIME_PUBLISHED_END =
            "p.schedule_end_local_time published_end ";
    public static final String FROM_CLAUSE_SALES_COLLECTION_FROM_002 = "FROM sales_menu.sales_collection c ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_JOIN_SALES_COLLECTION_VERSION =
            "JOIN sales_menu.sales_collection_version d ON d.version_ref=c.current_draft_version_ref ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_COLLECTION_REF =
            "AND d.collection_ref=c.collection_ref ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_SALES_COLLECTION_VERSION =
            "LEFT JOIN sales_menu.sales_collection_version p ON p.version_ref=c.latest_published_version_ref ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_COLLECTION_REF_ALTERNATE_A =
            "AND p.collection_ref=c.collection_ref ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_SALES_PUBLICATION_PUBLICATION =
            "LEFT JOIN sales_menu.sales_publication publication ";
    public static final String JOIN_CONDITION_PUBLICATION_PUBLISHED_VER_003 =
            "ON publication.published_version_ref=p.version_ref ";
    public static final String SALES_MENU_COLLECTION_PERSISTENCE_CONDITION_PUBLICATION_COLLECTION_REF =
            "AND publication.collection_ref=c.collection_ref ";
    public static final String WHERE_COLLECTION_REF_WS_UUID_004 =
            "WHERE c.collection_ref=? AND c.workspace_uuid=? AND c.group_workspace_key=? AND c.store_ref=?";
    public static final String UPDATE_SALES_COLLECTION_VER_COLLECTION_005 =
            "UPDATE sales_menu.sales_collection SET version=version+1 WHERE collection_ref=? ";
    public static final String CONDITION_WS_UUID_GRP_WS_006 =
            "AND workspace_uuid=? AND group_workspace_key=? AND store_ref=? AND version=?";
}
