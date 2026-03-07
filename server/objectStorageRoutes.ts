import type { Express, Request } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Allowed MIME types for uploads
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'video/mp4', 'video/quicktime', 'video/webm',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

async function getAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user?.id) return user.id;
  } catch {}
  return null;
}

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  // Request a signed URL for file upload (requires authentication).
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const userId = await getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Validate file size
      if (size && Number(size) > MAX_FILE_SIZE) {
        return res.status(400).json({ error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }

      // Validate content type
      if (contentType && !ALLOWED_CONTENT_TYPES.has(contentType)) {
        return res.status(400).json({ error: "File type not allowed" });
      }

      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Serve uploaded objects via signed URL redirect.
  // No auth required — paths contain unguessable UUIDs and the redirect target
  // is a short-lived Supabase signed URL. Browsers navigate here directly
  // (img src, anchor clicks, new tabs) so they can't send Bearer tokens.
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const storagePath = objectStorageService.resolveStoragePath(req.path);
      await objectStorageService.serveObject(storagePath, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
