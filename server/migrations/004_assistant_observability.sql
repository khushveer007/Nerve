CREATE TABLE IF NOT EXISTS assistant_request_telemetry (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('query', 'source-preview', 'source-open')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  actor_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  requested_mode TEXT
    CHECK (requested_mode IN ('auto', 'search', 'ask')),
  resolved_mode TEXT
    CHECK (resolved_mode IN ('search', 'ask')),
  authorization_outcome TEXT NOT NULL DEFAULT 'allowed'
    CHECK (authorization_outcome IN ('allowed', 'denied')),
  outcome TEXT NOT NULL
    CHECK (
      outcome IN (
        'search_results',
        'grounded_answer',
        'no_answer',
        'provider_fallback',
        'permission_denied',
        'preview_served',
        'source_opened',
        'request_failed'
      )
    ),
  failure_classification TEXT NOT NULL DEFAULT 'none'
    CHECK (failure_classification IN ('none', 'retrieval_failure', 'permission_failure', 'provider_failure')),
  failure_subtype TEXT,
  grounded BOOLEAN NOT NULL DEFAULT FALSE,
  enough_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  no_answer BOOLEAN NOT NULL DEFAULT FALSE,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  filter_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage_timings JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_request_telemetry_request_id_idx
  ON assistant_request_telemetry (request_id);

CREATE INDEX IF NOT EXISTS assistant_request_telemetry_recent_idx
  ON assistant_request_telemetry (created_at DESC);

CREATE INDEX IF NOT EXISTS assistant_request_telemetry_failure_group_idx
  ON assistant_request_telemetry (failure_classification, outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS assistant_request_telemetry_action_recent_idx
  ON assistant_request_telemetry (action, created_at DESC);

CREATE TABLE IF NOT EXISTS assistant_job_telemetry (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  asset_id TEXT,
  asset_version_id TEXT,
  source_id TEXT,
  job_type TEXT,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('enqueue', 'claimed', 'stale_lock_recovered', 'succeeded', 'retry', 'dead_letter')),
  status TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  failure_classification TEXT NOT NULL DEFAULT 'none'
    CHECK (failure_classification IN ('none', 'retrieval_failure', 'permission_failure', 'provider_failure')),
  failure_subtype TEXT,
  latency_ms INTEGER,
  retry_delay_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_job_telemetry_job_id_idx
  ON assistant_job_telemetry (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS assistant_job_telemetry_recent_idx
  ON assistant_job_telemetry (created_at DESC);

CREATE INDEX IF NOT EXISTS assistant_job_telemetry_event_recent_idx
  ON assistant_job_telemetry (event_type, created_at DESC);
