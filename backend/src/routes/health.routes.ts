import { Router } from "express";

import { env } from "../config/env";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "courtsphere-backend",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

export default router;
