-- Invitation issuer is a creation-time owner fact, not a derivation from mutable audit history.
ALTER TABLE workspace_iam.invitation
    ADD COLUMN issuer_display_name_snapshot VARCHAR(160) NOT NULL DEFAULT '历史记录未提供';

