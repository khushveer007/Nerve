CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS knowledge_assets_source_lookup_idx
  ON knowledge_assets (source_table, source_id);

CREATE INDEX IF NOT EXISTS knowledge_assets_status_scope_idx
  ON knowledge_assets (status, source_kind, visibility_scope);

CREATE INDEX IF NOT EXISTS knowledge_assets_title_trgm_idx
  ON knowledge_assets
  USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_assets_metadata_gin_idx
  ON knowledge_assets
  USING gin (metadata);

CREATE INDEX IF NOT EXISTS knowledge_asset_versions_current_idx
  ON knowledge_asset_versions (asset_id, superseded_at, version_no DESC);

CREATE INDEX IF NOT EXISTS knowledge_chunks_asset_version_idx
  ON knowledge_chunks (asset_id, asset_version_id, chunk_no);

CREATE INDEX IF NOT EXISTS knowledge_chunks_search_vector_idx
  ON knowledge_chunks
  USING gin (search_vector);

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS knowledge_chunks_metadata_gin_idx
  ON knowledge_chunks
  USING gin (metadata);
