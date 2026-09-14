package com.catering.v2s.workspace.iam.application.persistence;

/** SQL text fragments owned by WorkspaceIamSummaryReadService; B3 relocates text only and does not change execution. */
public final class WorkspaceIamSummaryReadServiceSql {
    public static final String WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ACCOUNT_WORKSPACE_UUID = "SELECT (SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=?) AS ";
    public static final String WORKSPACE_IAM_SUMMARY_READ_SERVICE_CONTINUATION_ACCOUNT_COUNT = "account_count, ";
    public static final String WORKSPACE_IAM_SUMMARY_READ_SERVICE_OPEN_PAREN_WORKSPACE_ROLE_WORKSPACE_UUID_ROLE_COUNT = "(SELECT count(*) FROM workspace_iam.workspace_role WHERE workspace_uuid=?) AS role_count";
    public static final String WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ACCOUNT_WORKSPACE_UUID_ALTERNATE_A = "SELECT count(*) FROM workspace_iam.workspace_account WHERE workspace_uuid=?";
    public static final String WORKSPACE_IAM_SUMMARY_READ_SERVICE_SELECT_WORKSPACE_ROLE_WORKSPACE_UUID = "SELECT count(*) FROM workspace_iam.workspace_role WHERE workspace_uuid=?";
}
