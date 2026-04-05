CREATE INDEX IF NOT EXISTS knowledge_jobs_queue_idx
  ON knowledge_jobs (status, run_after, created_at);

CREATE INDEX IF NOT EXISTS knowledge_jobs_asset_idx
  ON knowledge_jobs (asset_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_jobs_active_reindex_idx
  ON knowledge_jobs (asset_id, job_type)
  WHERE status IN ('queued', 'running') AND job_type = 'reindex';

CREATE INDEX IF NOT EXISTS knowledge_acl_principals_lookup_idx
  ON knowledge_acl_principals (asset_id, principal_type, principal_id);
