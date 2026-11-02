-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- Preserve immutable first-retrieval evidence while tracking when identical source JSON was last observed.
ALTER TABLE source_documents ADD COLUMN last_seen_at TIMESTAMPTZ;
UPDATE source_documents SET last_seen_at = retrieved_at;
ALTER TABLE source_documents ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE source_documents ALTER COLUMN last_seen_at SET DEFAULT now();
