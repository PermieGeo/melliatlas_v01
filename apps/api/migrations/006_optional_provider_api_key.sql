-- Feature IDs: SOURCES.PROVIDER_CONFIGURATION
-- Provider credentials are never copied to the append-only policy revision snapshots.
ALTER TABLE source_catalog
  ADD COLUMN api_key TEXT;

ALTER TABLE source_catalog
  ADD CONSTRAINT source_catalog_api_key_limit CHECK (api_key IS NULL OR length(api_key) BETWEEN 1 AND 4096);

CREATE OR REPLACE FUNCTION source_catalog_record_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO source_catalog_versions (source_id, registry_revision, snapshot)
    VALUES (
      NEW.id,
      NEW.registry_revision,
      to_jsonb(NEW) - 'last_successful_ingest_at' - 'source_cursor' - 'api_key'
    );
  ELSIF NEW.registry_revision IS DISTINCT FROM OLD.registry_revision THEN
    INSERT INTO source_catalog_versions (source_id, registry_revision, snapshot)
    VALUES (
      NEW.id,
      NEW.registry_revision,
      to_jsonb(NEW) - 'last_successful_ingest_at' - 'source_cursor' - 'api_key'
    );
  END IF;
  RETURN NULL;
END;
$$;
