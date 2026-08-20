-- Repair legacy internal channels created before INTERNAL creation was made immediately effective.
-- Only rows with no binding, no stop reason, and an enabled internal template are safe to promote.
UPDATE business_channel.business_channel AS channel
SET status = 'EFFECTIVE',
    version = channel.version + 1,
    updated_at_epoch_millis = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint
FROM business_channel.business_channel_template AS template
WHERE channel.template_ref = template.template_ref
  AND template.access_kind = 'INTERNAL'
  AND template.status = 'ENABLED'
  AND channel.status = 'DRAFT'
  AND channel.binding_ref IS NULL
  AND cardinality(channel.stop_reasons) = 0;
