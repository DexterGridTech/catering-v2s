-- P3 invitation completion is a persisted transactional intermediate state.
ALTER TABLE workspace_iam.invitation
    DROP CONSTRAINT ck_invitation_status,
    ADD CONSTRAINT ck_invitation_status CHECK (status IN (
        'PENDING', 'ACCEPT_INTENT_RECORDED', 'MOBILE_VERIFIED', 'CREDENTIAL_READY', 'COMPLETING',
        'COMPLETED', 'CANCELLED', 'EXPIRED', 'REISSUED', 'CONSENTED'
    ));
