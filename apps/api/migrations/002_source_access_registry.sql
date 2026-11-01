-- Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH
-- Existing source registrations remain pending; this migration grants no fetch permission.
ALTER TABLE source_catalog
  ADD COLUMN access_decision TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN allowed_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN refresh_interval_ms BIGINT NOT NULL DEFAULT 60000,
  ADD COLUMN reviewed_by TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN permission_evidence_url TEXT,
  ADD COLUMN permission_basis TEXT,
  ADD COLUMN parser_version TEXT,
  ADD COLUMN fetch_policy JSONB,
  ADD COLUMN source_cursor JSONB,
  ADD COLUMN disabled_reason TEXT,
  ADD COLUMN data_purpose TEXT,
  ADD COLUMN registry_revision BIGINT NOT NULL DEFAULT 1;

ALTER TABLE source_catalog
  ADD CONSTRAINT source_catalog_access_decision_check
    CHECK (access_decision IN ('pending', 'approved', 'denied')),
  ADD CONSTRAINT source_catalog_locations_array_check
    CHECK (jsonb_typeof(allowed_locations) = 'array'),
  ADD CONSTRAINT source_catalog_fetch_policy_object_check
    CHECK (fetch_policy IS NULL OR jsonb_typeof(fetch_policy) = 'object'),
  ADD CONSTRAINT source_catalog_refresh_interval_check
    CHECK (refresh_interval_ms BETWEEN 1000 AND 604800000),
  ADD CONSTRAINT source_catalog_registry_revision_check
    CHECK (registry_revision > 0),
  ADD CONSTRAINT source_catalog_approved_access_check
    CHECK (
      access_decision <> 'approved' OR (
        kind = 'municipal_notice'
        AND terms_review = 'reviewed'
        AND allowed_locations <> '[]'::jsonb
        AND fetch_policy IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND NULLIF(BTRIM(reviewed_by), '') IS NOT NULL
        AND NULLIF(BTRIM(permission_evidence_url), '') IS NOT NULL
        AND NULLIF(BTRIM(permission_basis), '') IS NOT NULL
        AND NULLIF(BTRIM(parser_version), '') IS NOT NULL
        AND NULLIF(BTRIM(data_purpose), '') IS NOT NULL
      )
    );

CREATE TABLE source_catalog_versions (
  source_id TEXT NOT NULL REFERENCES source_catalog(id) ON DELETE RESTRICT,
  registry_revision BIGINT NOT NULL CHECK (registry_revision > 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL,
  PRIMARY KEY (source_id, registry_revision)
);

CREATE FUNCTION source_catalog_set_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.registry_revision := 1;
    RETURN NEW;
  END IF;
  IF (
    to_jsonb(NEW) - 'updated_at' - 'registry_revision' - 'last_successful_ingest_at' - 'source_cursor'
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - 'updated_at' - 'registry_revision' - 'last_successful_ingest_at' - 'source_cursor'
  ) THEN
    NEW.registry_revision := OLD.registry_revision + 1;
    NEW.updated_at := now();
  ELSE
    NEW.registry_revision := OLD.registry_revision;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_catalog_revision_update
BEFORE INSERT OR UPDATE ON source_catalog
FOR EACH ROW EXECUTE FUNCTION source_catalog_set_revision();

CREATE FUNCTION source_catalog_record_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO source_catalog_versions (source_id, registry_revision, snapshot)
    VALUES (
      NEW.id,
      NEW.registry_revision,
      to_jsonb(NEW) - 'last_successful_ingest_at' - 'source_cursor'
    );
  ELSIF NEW.registry_revision IS DISTINCT FROM OLD.registry_revision THEN
    INSERT INTO source_catalog_versions (source_id, registry_revision, snapshot)
    VALUES (
      NEW.id,
      NEW.registry_revision,
      to_jsonb(NEW) - 'last_successful_ingest_at' - 'source_cursor'
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER source_catalog_version_record
AFTER INSERT OR UPDATE ON source_catalog
FOR EACH ROW EXECUTE FUNCTION source_catalog_record_version();

CREATE FUNCTION source_catalog_prevent_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Source catalog history is append-only';
END;
$$;

CREATE TRIGGER source_catalog_version_immutable
BEFORE UPDATE OR DELETE ON source_catalog_versions
FOR EACH ROW EXECUTE FUNCTION source_catalog_prevent_version_mutation();

-- Record the original revision for every source created by migration 001.
INSERT INTO source_catalog_versions (source_id, registry_revision, snapshot)
SELECT id, registry_revision, to_jsonb(source_catalog) - 'last_successful_ingest_at' - 'source_cursor'
FROM source_catalog;
