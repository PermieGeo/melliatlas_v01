-- Feature IDs: SOURCES.PROVIDER_CONFIGURATION, SOURCES.DOCUMENT_HISTORY
-- Migration 004 copied the legacy portal homepage URL but retained the full API endpoint
-- in api_request_config. Migration 008 deliberately skipped that mismatched row.
-- Reconcile only the exact, untouched legacy bootstrap; do not change operator edits,
-- disabled sources, stored credentials, or historical permission decisions.
UPDATE source_catalog
   SET url = api_request_config->>'endpoint',
       lifecycle = 'configured'
 WHERE id = 'treatment-feed'
   AND name = 'External treatment provider'
   AND kind = 'treatment'
   AND lifecycle = 'under_review'
   AND access_decision = 'pending'
   AND terms_review = 'pending'
   AND disabled_reason IS NULL
   AND api_key IS NULL
   AND source_cursor IS NULL
   AND url = 'https://bee-saturn.ru/'
   AND api_request_config = '{
     "endpoint": "https://bee-saturn.ru/backend/beemaster/planapplybees",
     "request": {
       "method": "POST",
       "regionParameter": "subject",
       "regionContainer": "beekeperSearchFilter",
       "regionCode": 55,
       "parameters": {
         "pageNumber": 0,
         "pageSize": 40,
         "sortColumn": "datePublishing",
         "sortDirection": "desc"
       }
     }
   }'::jsonb;
