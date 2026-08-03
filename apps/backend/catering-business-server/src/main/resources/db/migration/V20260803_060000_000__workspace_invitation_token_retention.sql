-- Invitations retain their opaque token so the permanent platform invitation
-- list can reopen the existing public page; public progression still requires
-- the invitation-bound mobile verification flow.
ALTER TABLE workspace_iam.invitation
    ADD COLUMN invitation_token VARCHAR(128);
