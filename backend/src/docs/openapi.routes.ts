import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "./openapi";

const router = Router();

router.get("/openapi.json", (_req, res) => {
  res.status(200).json(openApiDocument);
});

router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "CourtSphere API Docs",
    swaggerOptions: {
      persistAuthorization: true
    }
  })
);

export default router;
