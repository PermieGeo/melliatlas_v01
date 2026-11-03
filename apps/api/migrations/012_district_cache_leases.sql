-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- Lease ownership is persisted so a crashed process cannot claim permanent ownership.
ALTER TABLE source_district_cache
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ;

ALTER TABLE source_district_cache
  ADD CONSTRAINT source_district_cache_lease_pair
    CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL));

-- Existing running rows from migration 011 have no owner and are reclaimable.
