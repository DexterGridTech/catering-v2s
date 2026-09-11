-- DINE_IN form is an owner fact: internal channels use a platform terminal form,
-- while a STORE-owned external channel is provided by the external system itself.
-- Keep the previously executed migration immutable; this additive migration
-- replaces only the obsolete database check.
ALTER TABLE business_channel.business_channel_template
    DROP CONSTRAINT ck_business_channel_template_dine_in_form;

ALTER TABLE business_channel.business_channel_template
    ADD CONSTRAINT ck_business_channel_template_dine_in_form CHECK (
        (
            order_kind = 'DINE_IN'
            AND access_kind = 'INTERNAL'
            AND dine_in_form IS NOT NULL
            AND dine_in_form IN ('POS', 'QR', 'KIOSK')
        )
        OR (
            order_kind = 'DINE_IN'
            AND access_kind = 'EXTERNAL'
            AND operator_kind = 'STORE'
            AND dine_in_form IS NULL
        )
        OR (order_kind <> 'DINE_IN' AND dine_in_form IS NULL)
    );
