-- Base-1 read-time cascade facts. The derived stop-reason array is retired.
-- All downstream lifecycle status remains owned by the downstream row itself;
-- related statuses are read as independent dimensions by the owner.
ALTER TABLE business_channel.business_channel
    DROP COLUMN stop_reasons;
