-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- Coverage records describe a completed provider listing, never inferred spatial coverage.
CREATE TABLE source_district_cache (
  source_id TEXT NOT NULL REFERENCES source_catalog(id),
  source_revision TEXT NOT NULL,
  district_provider_id INTEGER NOT NULL CHECK (district_provider_id > 0),
  filter_hash CHAR(64) NOT NULL CHECK (filter_hash ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL CHECK (state IN ('running', 'paused', 'completed', 'failed')),
  next_page INTEGER NOT NULL DEFAULT 0 CHECK (next_page BETWEEN 0 AND 2000),
  pages_fetched INTEGER NOT NULL DEFAULT 0 CHECK (pages_fetched >= 0),
  records_received INTEGER NOT NULL DEFAULT 0 CHECK (records_received >= 0),
  records_stored INTEGER NOT NULL DEFAULT 0 CHECK (records_stored >= 0),
  total_elements INTEGER CHECK (total_elements >= 0),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_revision, district_provider_id, filter_hash),
  CHECK ((completed_at IS NULL) = (expires_at IS NULL)),
  CHECK (state <> 'completed' OR (completed_at IS NOT NULL AND next_page = 0))
);
CREATE INDEX idx_source_district_cache_freshness
  ON source_district_cache (source_id, expires_at DESC);
