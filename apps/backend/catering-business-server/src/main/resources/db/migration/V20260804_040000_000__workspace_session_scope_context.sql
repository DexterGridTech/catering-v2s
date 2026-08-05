ALTER TABLE workspace_iam.workspace_session
    ADD COLUMN selected_region_id UUID,
    ADD COLUMN selected_project_id UUID,
    ADD COLUMN selected_store_id UUID,
    ADD COLUMN selected_head_company_id UUID;
