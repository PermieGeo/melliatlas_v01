-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- A complete map-index viewport is not complete district/treatment/polygon coverage.
CREATE TABLE source_viewport_index_progress (
  source_id TEXT NOT NULL REFERENCES source_catalog(id) ON DELETE RESTRICT,
  source_revision TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  first_request JSONB NOT NULL CHECK (jsonb_typeof(first_request) = 'object'),
  district_provider_id INTEGER NOT NULL CHECK (district_provider_id > 0),
  state TEXT NOT NULL DEFAULT 'partial'
    CHECK (state IN ('partial', 'viewport_index_complete')),
  next_page INTEGER CHECK (next_page BETWEEN 0 AND 1999),
  pages_fetched INTEGER NOT NULL DEFAULT 0 CHECK (pages_fetched BETWEEN 0 AND 2000),
  entries_received INTEGER NOT NULL DEFAULT 0 CHECK (entries_received BETWEEN 0 AND 20000),
  total_pages INTEGER CHECK (total_pages BETWEEN 0 AND 2000),
  total_elements INTEGER CHECK (total_elements BETWEEN 0 AND 20000),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_revision, request_hash),
  CHECK ((total_pages IS NULL) = (total_elements IS NULL)),
  CHECK (total_elements IS NULL OR entries_received <= total_elements),
  CHECK (pages_fetched = 0 OR total_pages IS NOT NULL),
  CHECK (
    (state = 'partial' AND next_page = pages_fetched AND completed_at IS NULL) OR
    (state = 'viewport_index_complete' AND next_page IS NULL
      AND total_pages IS NOT NULL AND total_elements IS NOT NULL
      AND completed_at IS NOT NULL AND pages_fetched = GREATEST(1, total_pages)
      AND entries_received = total_elements)
  )
);

CREATE TABLE source_viewport_index_pages (
  source_id TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 0 AND 1999),
  source_path TEXT NOT NULL DEFAULT '/backend/beemaster/query'
    CHECK (source_path = '/backend/beemaster/query'),
  response_text TEXT NOT NULL CHECK (octet_length(response_text) <= 1000000),
  response_json JSONB NOT NULL CHECK (jsonb_typeof(response_json) = 'object'),
  response_sha256 CHAR(64) NOT NULL CHECK (response_sha256 ~ '^[0-9a-f]{64}$'),
  stored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, source_revision, request_hash, page_number),
  FOREIGN KEY (source_id, source_revision, request_hash)
    REFERENCES source_viewport_index_progress(source_id, source_revision, request_hash)
    ON DELETE RESTRICT
);

-- Preserve the exact application-serialized JSON used to compute its digest.
CREATE FUNCTION source_viewport_page_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Viewport page evidence is immutable';
END;
$$;
CREATE TRIGGER source_viewport_page_evidence_immutable
BEFORE UPDATE OR DELETE ON source_viewport_index_pages
FOR EACH ROW EXECUTE FUNCTION source_viewport_page_immutable();

CREATE TABLE source_viewport_index_features (
  source_id TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  page_number INTEGER NOT NULL,
  feature_id BIGINT NOT NULL CHECK (feature_id > 0),
  plan_id BIGINT NOT NULL CHECK (plan_id > 0),
  center GEOMETRY(Point, 4326) NOT NULL,
  PRIMARY KEY (source_id, source_revision, request_hash, feature_id),
  FOREIGN KEY (source_id, source_revision, request_hash, page_number)
    REFERENCES source_viewport_index_pages(source_id, source_revision, request_hash, page_number)
    ON DELETE RESTRICT
);
CREATE INDEX idx_source_viewport_index_features_center
  ON source_viewport_index_features USING gist (center);
