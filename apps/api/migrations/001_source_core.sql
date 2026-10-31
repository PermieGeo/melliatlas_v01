CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS source_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('weather', 'basemap', 'municipal_notice', 'treatment', 'imagery')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('configured', 'disabled', 'under_review')),
  url TEXT NOT NULL,
  terms_review TEXT NOT NULL DEFAULT 'pending' CHECK (terms_review IN ('pending', 'reviewed')),
  last_successful_ingest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO source_catalog (id, name, kind, lifecycle, url, terms_review)
VALUES
  ('open-meteo', 'Open-Meteo forecast', 'weather', 'configured', 'https://api.open-meteo.com/v1/forecast', 'pending'),
  ('openstreetmap', 'OpenStreetMap tiles', 'basemap', 'configured', 'https://tile.openstreetmap.org', 'pending')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES source_catalog(id),
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  error_code TEXT,
  CHECK ((status = 'started') = (completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_started
  ON ingestion_runs (source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES source_catalog(id),
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_runs(id),
  canonical_url TEXT NOT NULL,
  external_id TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL,
  content_hash_sha256 CHAR(64) NOT NULL,
  content_type TEXT NOT NULL,
  raw_text TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, canonical_url, content_hash_sha256),
  CHECK (raw_text IS NOT NULL OR raw_json IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_source_published
  ON source_documents (source_id, published_at DESC);

CREATE TABLE IF NOT EXISTS source_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES source_documents(id),
  observation_type TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  geometry GEOMETRY(Geometry, 4326),
  spatial_precision TEXT NOT NULL CHECK (spatial_precision IN ('exact_polygon', 'approximate_area', 'text_only')),
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('structured', 'model', 'human')),
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'verified', 'rejected')),
  attributes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CHECK ((geometry IS NULL) = (spatial_precision = 'text_only'))
);

CREATE INDEX IF NOT EXISTS idx_source_observations_geom
  ON source_observations USING gist (geometry);
CREATE INDEX IF NOT EXISTS idx_source_observations_status_time
  ON source_observations (review_status, start_at);
