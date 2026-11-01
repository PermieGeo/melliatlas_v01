-- Feature IDs: SOURCES.PROVIDER_CONFIGURATION, SOURCES.DOCUMENT_HISTORY
-- Permit operator-triggered fetches from the configured treatment endpoint without a separate access-review record.
-- Existing historical approvals remain in the immutable catalog audit history.
UPDATE source_catalog
   SET lifecycle = 'configured', access_decision = 'pending'
 WHERE id = 'treatment-feed'
   AND kind = 'treatment'
   AND lifecycle = 'under_review'
   AND api_request_config IS NOT NULL
   AND url = api_request_config->>'endpoint';
