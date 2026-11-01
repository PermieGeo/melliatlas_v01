-- Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.MAP_OVERLAY
-- Duplicate processing of the same document version must not duplicate extracted rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_treatment_document_record
  ON source_observations(source_document_id, ((attributes->>'recordIndex')))
  WHERE observation_type = 'treatment_plan';

-- Store operator verification provenance instead of treating a token as a reviewer identity.
CREATE TABLE IF NOT EXISTS source_observation_reviews (
  id BIGSERIAL PRIMARY KEY,
  observation_id UUID NOT NULL REFERENCES source_observations(id),
  reviewer TEXT NOT NULL CHECK (length(btrim(reviewer)) >= 2),
  decision TEXT NOT NULL CHECK (decision IN ('verified', 'rejected')),
  evidence_note TEXT NOT NULL CHECK (length(btrim(evidence_note)) >= 20),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(observation_id)
);
