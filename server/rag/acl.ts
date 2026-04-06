import type {
  AssistantActorContext,
  AssistantSourceReference,
} from "./types.js";

interface AccessClauseOptions {
  assetAlias?: string;
  startIndex?: number;
}

export interface KnowledgeAssetAccessClause {
  sql: string;
  params: [boolean, string | null, string, AssistantActorContext["role"]];
}

export function buildAssistantActorContext(user: {
  id: string;
  role: AssistantActorContext["role"];
  team: string | null;
}): AssistantActorContext {
  return {
    authenticated: true,
    user_id: user.id,
    role: user.role,
    team_id: user.team,
  };
}

export function buildKnowledgeAssetAccessClause(
  actor: AssistantActorContext,
  options: AccessClauseOptions = {},
): KnowledgeAssetAccessClause {
  const assetAlias = options.assetAlias ?? "ka";
  const startIndex = options.startIndex ?? 1;
  const authenticatedIndex = startIndex;
  const teamIndex = startIndex + 1;
  const userIndex = startIndex + 2;
  const roleIndex = startIndex + 3;

  return {
    sql: `(
      $${authenticatedIndex}::boolean = true
      AND (
        ${assetAlias}.visibility_scope = 'authenticated'
        OR (
          ${assetAlias}.visibility_scope = 'team'
          AND $${teamIndex}::text IS NOT NULL
          AND ${assetAlias}.owner_team_id = $${teamIndex}::text
        )
        OR (
          ${assetAlias}.visibility_scope = 'owner'
          AND ${assetAlias}.owner_user_id = $${userIndex}::text
        )
        OR (
          ${assetAlias}.visibility_scope = 'explicit_acl'
          AND EXISTS (
            SELECT 1
              FROM knowledge_acl_principals kap
             WHERE kap.asset_id = ${assetAlias}.id
               AND kap.permission = 'read'
               AND (
                 (kap.principal_type = 'user' AND kap.principal_id = $${userIndex}::text)
                 OR (kap.principal_type = 'team' AND $${teamIndex}::text IS NOT NULL AND kap.principal_id = $${teamIndex}::text)
                 OR (kap.principal_type = 'role' AND kap.principal_id = $${roleIndex}::text)
               )
          )
        )
      )
    )`,
    params: [actor.authenticated, actor.team_id, actor.user_id, actor.role],
  };
}

export function buildAssistantSourceOpenPath(source: AssistantSourceReference) {
  const params = new URLSearchParams({
    assistantAssetId: source.asset_id,
    assistantAssetVersionId: source.asset_version_id,
    assistantChunkId: source.chunk_id,
    assistantEntryId: source.entry_id,
    assistantSourceKind: source.source_kind,
  });

  return `/browse/source?${params.toString()}`;
}
