-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- The district directory is provider metadata, not proof of district boundary coverage.
CREATE TABLE source_saturn_district_catalog (
  source_id TEXT PRIMARY KEY REFERENCES source_catalog(id) ON DELETE RESTRICT,
  source_revision TEXT NOT NULL,
  subject_code TEXT NOT NULL CHECK (subject_code = '55'),
  catalog JSONB NOT NULL CHECK (jsonb_typeof(catalog) = 'array'),
  catalog_sha256 CHAR(64) NOT NULL CHECK (catalog_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit only explicit attempts. Never record apiary coordinates, tokens or source bodies.
CREATE TABLE source_saturn_request_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source_catalog(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('viewport_page', 'district_directory')),
  initiator TEXT NOT NULL CHECK (initiator IN ('web', 'admin')),
  district_provider_id INTEGER,
  request_hash CHAR(64),
  page_number INTEGER,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'throttled', 'cache_hit')),
  received_count INTEGER CHECK (received_count BETWEEN 0 AND 20000),
  error_code TEXT CHECK (length(error_code) <= 80),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CHECK (district_provider_id IS NULL OR district_provider_id > 0),
  CHECK (page_number IS NULL OR page_number BETWEEN 0 AND 1999),
  CHECK ((status = 'started') = (finished_at IS NULL))
);
CREATE INDEX idx_saturn_request_log_time ON source_saturn_request_log (started_at DESC, id DESC);

CREATE INDEX idx_source_viewport_district_lookup
  ON source_viewport_index_progress (district_provider_id, updated_at DESC);
