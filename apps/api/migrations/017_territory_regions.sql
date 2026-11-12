-- Feature IDs: SOURCES.CATALOG, SOURCES.DOCUMENT_HISTORY
-- Navigation regions are local geographic references, not source allowlists or administrative polygons.
CREATE TABLE territory_regions (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  country_code CHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 250)
);

-- Keep provider-specific region codes out of public territory IDs.
CREATE TABLE territory_region_source_codes (
  region_id TEXT NOT NULL REFERENCES territory_regions(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL CHECK (provider_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  external_code TEXT NOT NULL CHECK (length(external_code) BETWEEN 1 AND 64),
  PRIMARY KEY (region_id, provider_key),
  UNIQUE (provider_key, external_code)
);

-- The pilot region is a local navigation entry, not a claim of district coverage.
INSERT INTO territory_regions (id, country_code, display_name)
VALUES ('ru-smolensk', 'RU', 'Смоленская область');
INSERT INTO territory_region_source_codes (region_id, provider_key, external_code)
VALUES ('ru-smolensk', 'saturn', '55');

-- Register the observed provider code for operator selection without enabling network access.
-- Preserve any operator-edited display name and the independent access/permission gate.
INSERT INTO source_saturn_regions (subject_code, display_name)
VALUES ('55', 'Смоленская область')
ON CONFLICT (subject_code) DO NOTHING;
