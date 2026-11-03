-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- A consumed slot is retained after failed fetches and across process restarts.
CREATE TABLE source_request_throttle (
  source_id TEXT PRIMARY KEY REFERENCES source_catalog(id),
  next_allowed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
