-- Store-template visibility is a business-channel owner fact. Store references
-- remain opaque cross-owner identities; organization.store is deliberately not
-- referenced by a database foreign key.
ALTER TABLE business_channel.business_channel_template
    ADD COLUMN store_visibility_scope VARCHAR(32);

UPDATE business_channel.business_channel_template
   SET store_visibility_scope = 'ALL_PROJECT_STORES'
 WHERE operator_kind = 'STORE';

ALTER TABLE business_channel.business_channel_template
    ADD CONSTRAINT ck_business_channel_template_store_visibility_scope
    CHECK (
        (operator_kind = 'PROJECT' AND store_visibility_scope IS NULL)
        OR (operator_kind = 'STORE' AND store_visibility_scope IN ('ALL_PROJECT_STORES', 'SELECTED_PROJECT_STORES'))
    );

CREATE TABLE business_channel.business_channel_template_store_visibility (
    template_ref UUID NOT NULL,
    store_ref UUID NOT NULL,
    CONSTRAINT pk_business_channel_template_store_visibility PRIMARY KEY (template_ref, store_ref),
    CONSTRAINT fk_business_channel_template_store_visibility_template
        FOREIGN KEY (template_ref)
        REFERENCES business_channel.business_channel_template(template_ref)
);

CREATE INDEX idx_business_channel_template_store_visibility_store
    ON business_channel.business_channel_template_store_visibility (store_ref, template_ref);
