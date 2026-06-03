import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { Router } from "express";
import multer from "multer";

import { env } from "../../config/env";
import { asyncHandler } from "../../middlewares/async-handler.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

export const uploadsRoot = path.resolve(process.cwd(), "uploads");
const imagesUploadDir = path.join(uploadsRoot, "images");
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

fs.mkdirSync(imagesUploadDir, { recursive: true });

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function sanitizeFileBaseName(filename: string): string {
  const parsedName = path.parse(filename).name;
  return parsedName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, imagesUploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const baseName = sanitizeFileBaseName(file.originalname) || "court-image";
      callback(null, `${Date.now()}-${randomUUID()}-${baseName}${extension}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, "Only JPEG, PNG, WEBP, or GIF images are allowed", "INVALID_IMAGE_FILE"));
      return;
    }

    callback(null, true);
  }
});

export function createUploadsRouter(): Router {
  const router = Router();

  router.post(
    "/images",
    requireAuth,
    requireRole(["ADMIN"]),
    imageUpload.single("image"),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new AppError(400, "Image file is required", "IMAGE_FILE_REQUIRED");
      }

      const publicUrl = `${trimTrailingSlash(env.BACKEND_PUBLIC_BASE_URL)}/uploads/images/${req.file.filename}`;

      res.status(201).json({
        file: {
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: publicUrl
        }
      });
    })
  );

  return router;
}

export default createUploadsRouter();
