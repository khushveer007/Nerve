CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_assets (
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('entry', 'uploaded_file', 'branding_record')),
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  media_type TEXT NOT NULL CHECK (media_type IN ('text', 'pdf', 'image', 'doc')),
  storage_backend TEXT NOT NULL DEFAULT 'database',
  storage_key TEXT NOT NULL DEFAULT '',
  sha256 TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  visibility_scope TEXT NOT NULL DEFAULT 'authenticated'
    CHECK (visibility_scope IN ('authenticated', 'team', 'owner', 'explicit_acl')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'deleted')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id)
);

CREATE TABLE IF NOT EXISTS knowledge_asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  extractor_model TEXT NOT NULL DEFAULT 'entry-phase-1',
  extraction_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (extraction_status IN ('processing', 'ready', 'failed', 'superseded')),
  normalized_markdown TEXT NOT NULL DEFAULT '',
  normalized_text TEXT NOT NULL DEFAULT '',
  page_count INTEGER,
  language_code TEXT NOT NULL DEFAULT 'en',
  structural_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, version_no)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  asset_version_id TEXT NOT NULL REFERENCES knowledge_asset_versions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  chunk_no INTEGER NOT NULL,
  chunk_type TEXT NOT NULL DEFAULT 'body'
    CHECK (chunk_type IN ('body', 'table', 'caption', 'summary', 'metadata')),
  heading_path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  page_from INTEGER,
  page_to INTEGER,
  char_start INTEGER NOT NULL DEFAULT 0,
  char_end INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  search_vector TSVECTOR,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  citation_locator JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_version_id, chunk_no)
);

CREATE TABLE IF NOT EXISTS knowledge_acl_principals (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'team', 'role')),
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_jobs (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  asset_version_id TEXT REFERENCES knowledge_asset_versions(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('extract', 'normalize', 'chunk', 'embed', 'reindex', 'delete')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
