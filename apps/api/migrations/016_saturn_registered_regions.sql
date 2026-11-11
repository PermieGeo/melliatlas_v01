-- Feature IDs: SOURCES.DOCUMENT_HISTORY
-- Explicit operator-seeded source region allowlist; no region is enabled by migration alone.
CREATE TABLE source_saturn_regions (
  subject_code TEXT PRIMARY KEY CHECK (subject_code ~ '^[1-9][0-9]{0,5}$'),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 250)
);

-- Preserve existing directory data while supporting independent per-region catalogs.
ALTER TABLE source_saturn_district_catalog
  DROP CONSTRAINT source_saturn_district_catalog_subject_code_check;
ALTER TABLE source_saturn_district_catalog
  ADD CONSTRAINT source_saturn_district_catalog_subject_code_check
    CHECK (subject_code ~ '^[1-9][0-9]{0,5}$');
ALTER TABLE source_saturn_district_catalog
  DROP CONSTRAINT source_saturn_district_catalog_pkey;
ALTER TABLE source_saturn_district_catalog
  ADD PRIMARY KEY (source_id, subject_code);

-- Old request attempts remain readable with unknown region identity.
ALTER TABLE source_saturn_request_log
  ADD COLUMN subject_code TEXT CHECK (subject_code IS NULL OR subject_code ~ '^[1-9][0-9]{0,5}$');
