-- Feature IDs: SOURCES.SAFE_FETCH, SOURCES.PROVIDER_CONFIGURATION
-- Permit explicit review of structured treatment feeds without approving any existing row.
ALTER TABLE source_catalog DROP CONSTRAINT source_catalog_approved_access_check;
ALTER TABLE source_catalog ADD CONSTRAINT source_catalog_approved_access_check
  CHECK (
    access_decision <> 'approved' OR (
      kind IN ('municipal_notice', 'treatment')
      AND (kind <> 'treatment' OR api_request_config IS NOT NULL)
      AND lifecycle = 'configured'
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
