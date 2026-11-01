-- Feature IDs: SOURCES.SATURN_CONFIGURATION
-- A candidate endpoint is not an access approval and cannot start collection.
ALTER TABLE source_catalog
  ADD COLUMN api_request_config JSONB;

ALTER TABLE source_catalog
  ADD CONSTRAINT source_catalog_api_request_config_object
    CHECK (api_request_config IS NULL OR jsonb_typeof(api_request_config) = 'object');

INSERT INTO source_catalog (
  id, name, kind, lifecycle, url, terms_review, access_decision,
  api_request_config, data_purpose
)
VALUES (
  'saturn', 'FGIS Saturn Beekeeper Portal', 'treatment', 'under_review',
  'https://bee-saturn.ru/', 'pending', 'pending',
  '{"endpoint":"https://bee-saturn.ru/backend/beemaster/planapplybees","request":{"method":"POST","regionParameter":"subject","regionCode":55,"parameters":{}}}'::jsonb,
  'Potential publication of planned pesticide treatments; endpoint and access require verification'
)
ON CONFLICT (id) DO NOTHING;
