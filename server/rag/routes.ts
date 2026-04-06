import express from "express";
import { config } from "../config.js";
import { buildAssistantActorContext } from "./acl.js";
import {
  assistantQueryEnvelopeSchema,
  assistantQueryResultEnvelopeSchema,
  assistantSourceOpenEnvelopeSchema,
  assistantSourcePreviewEnvelopeSchema,
} from "./schemas.js";
import {
  AssistantAuthorizationError,
  executeAssistantQuery,
  getAssistantHealth,
  getAssistantSourceOpen,
  getAssistantSourcePreview,
} from "./service.js";

function asyncHandler(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>,
): express.RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function sendError(res: express.Response, status: number, message: string) {
  return res.status(status).json({ message });
}

export function createAssistantRouter() {
  const router = express.Router();

  router.get("/health", asyncHandler(async (_req, res) => {
    const health = await getAssistantHealth();
    res.status(health.available ? 200 : 503).json(health);
  }));

  router.post("/query", asyncHandler(async (req, res) => {
    if (!config.assistant.enabled) {
      return sendError(res, 503, "Assistant search is disabled in this environment.");
    }

    const parsed = assistantQueryEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "Invalid assistant query payload.");
    }

    const actor = buildAssistantActorContext(res.locals.currentUser);
    const result = await executeAssistantQuery(actor, parsed.data.query);
    const contract = assistantQueryResultEnvelopeSchema.parse({ result });
    return res.json(contract);
  }));

  router.post("/source-preview", asyncHandler(async (req, res) => {
    if (!config.assistant.enabled) {
      return sendError(res, 503, "Assistant search is disabled in this environment.");
    }

    const parsed = assistantSourcePreviewEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "Invalid assistant source preview payload.");
    }

    const actor = buildAssistantActorContext(res.locals.currentUser);

    try {
      const preview = await getAssistantSourcePreview(actor, parsed.data.preview.source);
      return res.json(preview);
    } catch (error) {
      if (error instanceof AssistantAuthorizationError) {
        return sendError(res, 403, error.message);
      }
      throw error;
    }
  }));

  router.post("/source-open", asyncHandler(async (req, res) => {
    if (!config.assistant.enabled) {
      return sendError(res, 503, "Assistant search is disabled in this environment.");
    }

    const parsed = assistantSourceOpenEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "Invalid assistant source open payload.");
    }

    const actor = buildAssistantActorContext(res.locals.currentUser);

    try {
      const open = await getAssistantSourceOpen(actor, parsed.data.open.source);
      return res.json(open);
    } catch (error) {
      if (error instanceof AssistantAuthorizationError) {
        return sendError(res, 403, error.message);
      }
      throw error;
    }
  }));

  return router;
}
