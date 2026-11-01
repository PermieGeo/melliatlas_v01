-- Feature IDs: SOURCES.PROVIDER_CONFIGURATION
-- Keep immutable legacy source history while migrating the active connection to a neutral source ID.
INSERT INTO source_catalog (
  id, name, kind, lifecycle, url, terms_review, access_decision,
  api_request_config, data_purpose
)
SELECT
  'treatment-feed',
  CASE WHEN name = 'FGIS Saturn Beekeeper Portal' THEN 'External treatment provider' ELSE name END,
  'treatment', 'under_review', url, 'pending', 'pending',
  CASE
    WHEN name = 'FGIS Saturn Beekeeper Portal'
      AND api_request_config->'request'->'parameters' = '{}'::jsonb
      AND api_request_config->'request'->>'regionParameter' = 'subject'
      AND api_request_config->'request'->>'regionCode' = '55'
      AND api_request_config->'request'->>'method' = 'POST'
    THEN jsonb_set(
      api_request_config,
      '{request}',
      '{"method":"POST","regionParameter":"subject","regionContainer":"beekeperSearchFilter","regionCode":55,"parameters":{"pageNumber":0,"pageSize":40,"sortColumn":"datePublishing","sortDirection":"desc"}}'::jsonb
    )
    ELSE api_request_config
  END,
  'Configurable source of published treatment plans; access review required' 
FROM source_catalog WHERE id = 'saturn'
ON CONFLICT (id) DO NOTHING;

UPDATE source_catalog
SET lifecycle = 'disabled', disabled_reason = 'superseded-by-configurable-provider'
WHERE id = 'saturn' AND lifecycle <> 'disabled';
