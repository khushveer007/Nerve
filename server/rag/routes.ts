import express from "express";
import { config } from "../config.js";
import { assistantQueryEnvelopeSchema } from "./schemas.js";
import { executeAssistantQuery, getAssistantHealth } from "./service.js";

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

    const result = await executeAssistantQuery(parsed.data.query);
    return res.json({ result });
  }));

  return router;
}
